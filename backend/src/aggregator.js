import Parser from "rss-parser";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { TRUSTED_SOURCES, getSourceById } from "./sources.js";

dayjs.extend(relativeTime);

const parser = new Parser({
  timeout: 60000,
  customFields: {
    item: ["category", "creator"]
  }
});

const CRITICAL_KEYWORDS = [
  "zero-day",
  "0day",
  "ransomware",
  "active exploit",
  "actively exploited",
  "critical vulnerability",
  "data breach"
];

const HIGH_KEYWORDS = [
  "cve-",
  "malware",
  "phishing",
  "ddos",
  "botnet",
  "breach",
  "exploit"
];

const CATEGORY_RULES = [
  { category: "vulnerability", keywords: ["cve", "vulnerability", "patch"] },
  { category: "malware", keywords: ["malware", "ransomware", "trojan"] },
  { category: "breach", keywords: ["breach", "leak", "stolen", "exposed"] },
  { category: "threat-intel", keywords: ["apt", "campaign", "threat actor"] },
  { category: "policy", keywords: ["advisory", "guidance", "compliance", "law"] }
];

function normalizeText(value = "") {
  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text = "") {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length >= 4)
    .slice(0, 24);
}

function extractCves(text = "") {
  const matches = normalizeText(text).match(/cve\s?\d{4}\s?\d{4,7}/g) || [];
  return matches.map((value) => value.replace(/\s+/g, "-"));
}

function extractNamedEntities(text = "") {
  const normalized = normalizeText(text);
  const vendors = [
    "microsoft",
    "google",
    "apple",
    "cisco",
    "oracle",
    "fortinet",
    "ivanti",
    "palo alto",
    "vmware",
    "linux",
    "windows",
    "android",
    "ios"
  ];
  return vendors.filter((vendor) => normalized.includes(vendor));
}

function classifySeverity(text) {
  const normalized = normalizeText(text);
  if (CRITICAL_KEYWORDS.some((k) => normalized.includes(k))) {
    return "critical";
  }
  if (HIGH_KEYWORDS.some((k) => normalized.includes(k))) {
    return "high";
  }
  return "medium";
}

function classifyCategory(text) {
  const normalized = normalizeText(text);
  const match = CATEGORY_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword))
  );
  return match ? match.category : "general";
}

function generateSummaries(title, summary, category) {
  const baseText = `${title}. ${summary}`.replace(/\s+/g, " ").trim();
  const quick = baseText.length > 170 ? `${baseText.slice(0, 167)}...` : baseText;
  const technical = `Category=${category}; Signal=${classifySeverity(baseText)}; Brief=${summary
    .slice(0, 220)
    .replace(/\s+/g, " ")
    .trim()}`;
  return { quick, technical };
}

function makeFingerprint(title, source) {
  const normalizedTitle = normalizeText(title)
    .replace(/\b(update|report|analysis|new|latest)\b/g, "")
    .trim();
  return `${normalizedTitle}::${source}`;
}

function normalizePublishedAt(item) {
  const candidates = [item.isoDate, item.pubDate, item.published, item.updated].filter(Boolean);
  for (const candidate of candidates) {
    const ts = Date.parse(candidate);
    if (Number.isFinite(ts)) {
      return {
        publishedAt: new Date(ts).toISOString(),
        publishedTs: ts
      };
    }
  }
  const fallbackTs = Date.now();
  return {
    publishedAt: new Date(fallbackTs).toISOString(),
    publishedTs: fallbackTs
  };
}

function toArticle(item, sourceName, sourceId) {
  const title = item.title || "Untitled";
  const summary = item.contentSnippet || item.content || "";
  const { publishedAt, publishedTs } = normalizePublishedAt(item);
  const joinedText = `${title} ${summary}`;
  const severity = classifySeverity(joinedText);
  const category = classifyCategory(joinedText);
  const sourceMeta = getSourceById(sourceId);
  const aiSummary = generateSummaries(title, summary, category);
  const cves = extractCves(joinedText);
  const entities = extractNamedEntities(joinedText);

  return {
    id: makeFingerprint(title, sourceId),
    title,
    summary: summary.slice(0, 260),
    aiSummary,
    url: item.link,
    source: sourceName,
    sourceId,
    severity,
    category,
    publishedAt,
    publishedTs,
    publishedFromNow: dayjs(publishedAt).fromNow(),
    tags: Array.isArray(item.categories) ? item.categories.slice(0, 4) : [],
    sourceTrustScore: sourceMeta?.trustScore ?? 0.75,
    confidenceScore: Math.min(
      0.99,
      Number(((sourceMeta?.trustScore ?? 0.75) * (severity === "critical" ? 0.95 : 0.85)).toFixed(2))
    ),
    cves,
    entities,
    clusterId: null,
    clusterSize: 1,
    incidentSignature: `${category}:${cves[0] || entities[0] || tokenize(title).slice(0, 4).join("-")}`
  };
}

function dedupeArticles(articles) {
  const map = new Map();
  for (const article of articles) {
    const key = normalizeText(article.title);
    if (!map.has(key)) {
      map.set(key, article);
      continue;
    }
    const existing = map.get(key);
    const existingTime = existing.publishedTs || new Date(existing.publishedAt).getTime() || 0;
    const nextTime = article.publishedTs || new Date(article.publishedAt).getTime() || 0;
    if (nextTime > existingTime) {
      map.set(key, article);
    }
  }
  return [...map.values()];
}

function similarity(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / Math.max(a.size, b.size, 1);
}

function overlapScore(aValues = [], bValues = []) {
  if (!aValues.length || !bValues.length) return 0;
  const a = new Set(aValues);
  const b = new Set(bValues);
  const overlap = [...a].filter((value) => b.has(value)).length;
  return overlap / Math.max(a.size, b.size, 1);
}

function clusterArticles(articles) {
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < articles.length; i += 1) {
    if (assigned.has(i)) continue;
    const seed = articles[i];
    const seedTokens = tokenize(`${seed.title} ${seed.summary}`);
    const members = [i];
    assigned.add(i);

    for (let j = i + 1; j < articles.length; j += 1) {
      if (assigned.has(j)) continue;
      const candidate = articles[j];
      const candidateTokens = tokenize(`${candidate.title} ${candidate.summary}`);
      const lexical = similarity(seedTokens, candidateTokens);
      const cveMatch = overlapScore(seed.cves, candidate.cves);
      const entityMatch = overlapScore(seed.entities, candidate.entities);
      const timeDistanceHours =
        Math.abs((seed.publishedTs || 0) - (candidate.publishedTs || 0)) / (1000 * 60 * 60);
      const recencyBoost = timeDistanceHours <= 48 ? 0.1 : 0;
      const signatureMatch = seed.incidentSignature === candidate.incidentSignature ? 0.2 : 0;
      const weightedScore = lexical * 0.5 + cveMatch * 0.25 + entityMatch * 0.15 + recencyBoost + signatureMatch;
      const sameCategory = seed.category === candidate.category;
      const shouldGroup = sameCategory && (cveMatch >= 0.9 || weightedScore >= 0.52);
      if (shouldGroup) {
        members.push(j);
        assigned.add(j);
      }
    }
    clusters.push(members);
  }

  clusters.forEach((members, index) => {
    const clusterId = `cluster-${index + 1}`;
    const uniqueSources = new Set();
    members.forEach((memberIndex) => {
      const article = articles[memberIndex];
      uniqueSources.add(article.sourceId);
      article.clusterId = clusterId;
      article.clusterSize = members.length;
      article.confidenceScore = Math.min(
        0.99,
        Number((article.confidenceScore + Math.min(uniqueSources.size * 0.02, 0.14)).toFixed(2))
      );
      article.incidentSignature = `${clusterId}:${article.incidentSignature}`;
    });
  });

  return articles;
}

async function fetchSourceWithFallback(source) {
  const attempts = [source.url, ...(source.mirrors || [])];
  let lastError = null;
  let usedUrl = source.url;
  for (const url of attempts) {
    try {
      const feed = await parser.parseURL(url);
      usedUrl = url;
      return { items: (feed.items || []).slice(0, 20), usedUrl, usedMirror: url !== source.url };
    } catch (error) {
      lastError = error;
    }
  }
  throw Object.assign(new Error(lastError?.message || "Unable to fetch source"), { usedUrl });
}

export async function fetchAllSources(runtimeSources = TRUSTED_SOURCES, previousHealth = {}) {
  const activeSources = runtimeSources.filter((source) => source.enabled !== false);
  const results = await Promise.allSettled(
    activeSources.map(async (source) => {
      const { items, usedUrl, usedMirror } = await fetchSourceWithFallback(source);
      return {
        sourceId: source.id,
        sourceName: source.name,
        usedUrl,
        usedMirror,
        articles: items.map((item) => toArticle(item, source.name, source.id))
      };
    })
  );

  const collected = [];
  const sourceErrors = [];
  const sourceHealth = {};

  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const source = activeSources[i];
    if (result.status === "fulfilled") {
      collected.push(...result.value.articles);
      sourceHealth[source.id] = {
        status: "up",
        lastFetchAt: new Date().toISOString(),
        error: null,
        usedUrl: result.value.usedUrl,
        fallbackUsed: result.value.usedMirror,
        consecutiveFailures: 0
      };
    } else {
      sourceErrors.push({
        source: source.name,
        message: result.reason?.message || "Unknown fetch error"
      });
      sourceHealth[source.id] = {
        status: "down",
        lastFetchAt: previousHealth[source.id]?.lastFetchAt || null,
        error: result.reason?.message || "Unknown fetch error",
        usedUrl: source.url,
        fallbackUsed: false,
        consecutiveFailures: (previousHealth[source.id]?.consecutiveFailures || 0) + 1
      };
    }
  }

  for (const source of runtimeSources) {
    if (source.enabled === false) {
      sourceHealth[source.id] = {
        status: "disabled",
        lastFetchAt: previousHealth[source.id]?.lastFetchAt || null,
        error: null,
        usedUrl: source.url,
        fallbackUsed: false,
        consecutiveFailures: 0
      };
    }
  }

  const deduped = dedupeArticles(collected);
  const clustered = clusterArticles(deduped).sort(
    (a, b) => (b.publishedTs || 0) - (a.publishedTs || 0)
  );

  return {
    articles: clustered,
    sourceErrors,
    sourceHealth
  };
}
