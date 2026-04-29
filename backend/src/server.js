import express from "express";
import cors from "cors";
import cron from "node-cron";
import { fetchAllSources } from "./aggregator.js";
import { TRUSTED_SOURCES, getRuntimeSources } from "./sources.js";
import { addSearchMetadata, searchNewsHybrid } from "./search.js";
import { DEFAULT_PROFILE, applyProfile } from "./profile.js";
import { loadStore, saveStore } from "./persistence.js";
import { enqueueRefresh } from "./queue.js";
import { notifyCriticalAlerts, notifyDigest, subscribeAlerts } from "./notifications.js";
import { getCveDetails } from "./cveService.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

const store = {
  articles: [],
  sourceErrors: [],
  sourceConfig: {},
  sourceHealth: {},
  profiles: {},
  bookmarks: {},
  loading: false,
  lastUpdatedAt: null,
  nextRefreshAtMs: 0
};
let refreshTimer = null;

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function scheduleNextRefresh() {
  // Random interval between 5 and 10 minutes
  store.nextRefreshAtMs = Date.now() + randomIntInclusive(5, 10) * 60 * 1000;
}

function severityWeight(severity) {
  if (severity === "critical") return 1;
  if (severity === "high") return 0.75;
  return 0.55;
}

function recencyWeight(publishedAt) {
  const ageHours = Math.max((Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60), 0.1);
  return Math.max(0.2, 1 / Math.sqrt(ageHours));
}

function scoreArticle(article) {
  const trust = article.sourceTrustScore || 0.7;
  const clusterBoost = Math.min((article.clusterSize || 1) * 0.06, 0.3);
  const score = trust * 0.45 + severityWeight(article.severity) * 0.35 + recencyWeight(article.publishedAt) * 0.2 + clusterBoost;
  return Number(score.toFixed(3));
}

function withinQuietHours(quietHours) {
  if (!quietHours?.enabled) return false;
  const hour = new Date().getHours();
  const start = Number(quietHours.startHour ?? 22);
  const end = Number(quietHours.endHour ?? 7);
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

async function refreshNewsInternal() {
  if (store.loading) return;
  store.loading = true;
  try {
    const runtimeSources = getRuntimeSources(store.sourceConfig);
    const { articles, sourceErrors, sourceHealth } = await fetchAllSources(runtimeSources, store.sourceHealth);
    const enriched = addSearchMetadata(
      articles.map((article) => {
        const source = TRUSTED_SOURCES.find((value) => value.id === article.sourceId);
        return {
          ...article,
          sourceSectors: source?.sectors || [],
          sourceTrustScore: source?.trustScore ?? article.sourceTrustScore,
          rankingScore: 0
        };
      })
    );
    enriched.forEach((item) => {
      item.rankingScore = scoreArticle(item);
    });
    store.articles = enriched;
    store.sourceErrors = sourceErrors;
    store.sourceHealth = sourceHealth;
    store.lastUpdatedAt = new Date().toISOString();
    await saveStore(store);
    notifyCriticalAlerts(enriched);
    console.log(`[refresh] loaded=${articles.length} errors=${sourceErrors.length}`);
  } catch (error) {
    console.error("[refresh] failed", error.message);
  } finally {
    store.loading = false;
    // Update the next refresh target even if the fetch failed.
    scheduleNextRefresh();
  }
}

async function refreshNews() {
  await enqueueRefresh(refreshNewsInternal);
}

function scheduleRefreshLoop() {
  const delayMs = randomIntInclusive(5, 10) * 60 * 1000;
  store.nextRefreshAtMs = Date.now() + delayMs;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = setTimeout(async () => {
    await refreshNews();
    scheduleRefreshLoop();
  }, delayMs);
}

function getProfile(userId = "default") {
  return store.profiles[userId] || DEFAULT_PROFILE;
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    loading: store.loading,
    totalArticles: store.articles.length,
    lastUpdatedAt: store.lastUpdatedAt,
    nextRefreshAt: store.nextRefreshAtMs ? new Date(store.nextRefreshAtMs).toISOString() : null,
    sourceErrors: store.sourceErrors
  });
});

app.get("/api/news/sources", (req, res) => {
  const runtimeSources = getRuntimeSources(store.sourceConfig);
  res.json(
    runtimeSources.map((source) => ({
      ...source,
      health: store.sourceHealth[source.id] || {
        status: source.enabled === false ? "disabled" : "unknown",
        lastFetchAt: null,
        error: null,
        usedUrl: source.url,
        fallbackUsed: false,
        consecutiveFailures: 0
      }
    }))
  );
});

app.get("/api/news/sources/status", (req, res) => {
  const runtimeSources = getRuntimeSources(store.sourceConfig);
  const normalized = runtimeSources.map((source) => {
    const health = store.sourceHealth[source.id] || {
      status: source.enabled === false ? "disabled" : "unknown",
      lastFetchAt: null,
      error: null,
      usedUrl: source.url,
      fallbackUsed: false,
      consecutiveFailures: 0
    };
    return {
      id: source.id,
      name: source.name,
      enabled: source.enabled !== false,
      status: health.status,
      lastFetchAt: health.lastFetchAt,
      error: health.error,
      usedUrl: health.usedUrl,
      fallbackUsed: health.fallbackUsed,
      consecutiveFailures: health.consecutiveFailures
    };
  });

  res.json({
    total: normalized.length,
    up: normalized.filter((s) => s.status === "up").length,
    down: normalized.filter((s) => s.status === "down").length,
    disabled: normalized.filter((s) => s.status === "disabled").length,
    unknown: normalized.filter((s) => s.status === "unknown").length,
    items: normalized
  });
});

app.put("/api/news/sources/:sourceId", async (req, res) => {
  const sourceId = req.params.sourceId;
  const source = TRUSTED_SOURCES.find((item) => item.id === sourceId);
  if (!source) {
    return res.status(404).json({ message: "Source not found" });
  }
  const enabled = Boolean(req.body?.enabled);
  store.sourceConfig[sourceId] = {
    ...(store.sourceConfig[sourceId] || {}),
    enabled
  };
  await saveStore(store);
  await refreshNews();
  const runtimeSource = getRuntimeSources(store.sourceConfig).find((item) => item.id === sourceId);
  res.json({
    ...runtimeSource,
    health: store.sourceHealth[sourceId] || null
  });
});

app.get("/api/news", async (req, res) => {
  const {
    limit = "60",
    severity,
    category,
    source,
    q = "",
    userId = "default",
    sort = "time_desc"
  } = req.query;

  const max = Math.min(Math.max(Number(limit) || 60, 1), 200);
  let result = applyProfile([...store.articles], getProfile(String(userId)));

  if (severity) {
    result = result.filter((item) => item.severity === severity);
  }
  if (category) {
    result = result.filter((item) => item.category === category);
  }
  if (source) {
    result = result.filter((item) => item.sourceId === source);
  }
  if (q) {
    result = await searchNewsHybrid(result, String(q), max);
  }
  if (sort === "time_desc") {
    result.sort((a, b) => (b.publishedTs || 0) - (a.publishedTs || 0));
  } else if (sort === "time_asc") {
    result.sort((a, b) => (a.publishedTs || 0) - (b.publishedTs || 0));
  } else {
    result.sort((a, b) => b.rankingScore - a.rankingScore);
  }

  res.json({
    total: result.length,
    lastUpdatedAt: store.lastUpdatedAt,
    nextRefreshAt: store.nextRefreshAtMs ? new Date(store.nextRefreshAtMs).toISOString() : null,
    sourceErrors: store.sourceErrors,
    profile: getProfile(String(userId)),
    items: result.slice(0, max)
  });
});

app.get("/api/news/incidents", (req, res) => {
  const clusters = new Map();
  for (const article of store.articles) {
    const key = article.clusterId || article.id;
    if (!clusters.has(key)) {
      clusters.set(key, {
        clusterId: key,
        representativeTitle: article.title,
        category: article.category,
        severity: article.severity,
        sourceCount: 0,
        sources: new Set(),
        confidenceScore: article.confidenceScore,
        latestPublishedAt: article.publishedAt
      });
    }
    const cluster = clusters.get(key);
    cluster.sources.add(article.source);
    cluster.sourceCount = cluster.sources.size;
    cluster.confidenceScore = Math.max(cluster.confidenceScore, article.confidenceScore);
    if (new Date(article.publishedAt).getTime() > new Date(cluster.latestPublishedAt).getTime()) {
      cluster.latestPublishedAt = article.publishedAt;
    }
  }

  const incidents = [...clusters.values()]
    .map((cluster) => ({
      ...cluster,
      sources: [...cluster.sources]
    }))
    .sort((a, b) => b.sourceCount - a.sourceCount);

  res.json({ total: incidents.length, items: incidents });
});

app.get("/api/news/incidents/:clusterId", (req, res) => {
  const clusterId = req.params.clusterId;
  const items = store.articles
    .filter((article) => (article.clusterId || article.id) === clusterId)
    .sort((a, b) => (a.publishedTs || 0) - (b.publishedTs || 0));

  if (!items.length) {
    return res.status(404).json({ message: "Incident not found" });
  }

  const uniqueSources = [...new Set(items.map((item) => item.source))];
  const confidence = Math.max(...items.map((item) => item.confidenceScore || 0));

  res.json({
    clusterId,
    timeline: items.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      publishedAt: item.publishedAt,
      publishedFromNow: item.publishedFromNow,
      severity: item.severity,
      confidenceScore: item.confidenceScore,
      url: item.url
    })),
    summary: {
      representativeTitle: items[items.length - 1].title,
      category: items[0].category,
      severity: items[0].severity,
      sourceCount: uniqueSources.length,
      sources: uniqueSources,
      confidenceScore: confidence,
      explanation: {
        sourceTrust: "Confidence includes configured source trust weighting.",
        multiSource: "Confidence improves when multiple trusted sources report same incident.",
        recency: "More recent reports contribute to higher ranking priority."
      }
    }
  });
});

app.get("/api/cves", async (req, res) => {
  const idsRaw = String(req.query.ids || "");
  const ids = idsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 10);
  if (!ids.length) {
    return res.json({ items: [] });
  }
  const items = await getCveDetails(ids);
  res.json({ items });
});

app.get("/api/alerts/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`event: ready\ndata: {"ok":true}\n\n`);
  subscribeAlerts(res);
});

app.post("/api/users/:userId/digest", (req, res) => {
  const userId = req.params.userId;
  const profile = getProfile(userId);
  const scoped = applyProfile([...store.articles], profile).slice(0, 8);
  const digest = {
    userId,
    ts: new Date().toISOString(),
    topStories: scoped.map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity,
      category: item.category,
      source: item.source,
      quick: item.aiSummary?.quick
    }))
  };
  notifyDigest({ type: "digest", ...digest });
  res.json(digest);
});

app.get("/api/users/:userId/profile", (req, res) => {
  res.json(getProfile(req.params.userId));
});

app.put("/api/users/:userId/profile", async (req, res) => {
  const userId = req.params.userId;
  const previous = getProfile(userId);
  const nextProfile = {
    topics: Array.isArray(req.body?.topics) ? req.body.topics : [],
    sectors: Array.isArray(req.body?.sectors) ? req.body.sectors : [],
    role: req.body?.role || previous.role || "analyst",
    riskProfile: req.body?.riskProfile || previous.riskProfile || "balanced",
    alertPolicy: req.body?.alertPolicy || previous.alertPolicy || "critical",
    quietHours: {
      enabled: Boolean(req.body?.quietHours?.enabled ?? previous.quietHours?.enabled),
      startHour: Number(req.body?.quietHours?.startHour ?? previous.quietHours?.startHour ?? 22),
      endHour: Number(req.body?.quietHours?.endHour ?? previous.quietHours?.endHour ?? 7)
    }
  };
  store.profiles[userId] = nextProfile;
  await saveStore(store);
  res.json(nextProfile);
});

app.get("/api/users/:userId/bookmarks", (req, res) => {
  const userId = req.params.userId;
  res.json({ userId, itemIds: store.bookmarks[userId] || [] });
});

app.post("/api/users/:userId/bookmarks", async (req, res) => {
  const userId = req.params.userId;
  const itemId = String(req.body?.itemId || "");
  if (!itemId) {
    return res.status(400).json({ message: "itemId is required" });
  }
  const existing = new Set(store.bookmarks[userId] || []);
  existing.add(itemId);
  store.bookmarks[userId] = [...existing];
  await saveStore(store);
  res.json({ userId, itemIds: store.bookmarks[userId] });
});

app.delete("/api/users/:userId/bookmarks/:itemId", async (req, res) => {
  const userId = req.params.userId;
  const itemId = req.params.itemId;
  const existing = new Set(store.bookmarks[userId] || []);
  existing.delete(itemId);
  store.bookmarks[userId] = [...existing];
  await saveStore(store);
  res.json({ userId, itemIds: store.bookmarks[userId] });
});

app.get("/api/users/:userId/bookmarks/export", (req, res) => {
  const userId = req.params.userId;
  const format = String(req.query.format || "markdown");
  const ids = new Set(store.bookmarks[userId] || []);
  const rows = store.articles.filter((item) => ids.has(item.id));

  if (format === "csv") {
    const csv = [
      "title,source,severity,category,url",
      ...rows.map((r) =>
        `"${r.title.replace(/"/g, '""')}","${r.source}","${r.severity}","${r.category}","${r.url}"`
      )
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    return res.send(csv);
  }

  const md = [
    "# CyberPulse Saved Articles",
    "",
    ...rows.map((r, idx) => `${idx + 1}. [${r.title}](${r.url}) - ${r.source} (${r.severity}/${r.category})`)
  ].join("\n");
  res.setHeader("Content-Type", "text/markdown");
  res.send(md);
});

app.get("/", (req, res) => {
  res.send("CyberPulse API is running");
});

async function boot() {
  const persisted = await loadStore();
  store.articles = persisted.articles || [];
  store.sourceErrors = persisted.sourceErrors || [];
  store.sourceConfig = persisted.sourceConfig || {};
  store.sourceHealth = persisted.sourceHealth || {};
  store.profiles = persisted.profiles || {};
  store.bookmarks = persisted.bookmarks || {};
  store.lastUpdatedAt = persisted.lastUpdatedAt || null;
  store.nextRefreshAtMs = 0; // allow immediate refresh on boot
  await refreshNews();
  // Send digest notifications once every 6 hours if user opted in and outside quiet hours.
  cron.schedule("0 */6 * * *", () => {
    Object.entries(store.profiles).forEach(([userId, profile]) => {
      if (profile.alertPolicy !== "digest") return;
      if (withinQuietHours(profile.quietHours)) return;
      const scoped = applyProfile([...store.articles], profile).slice(0, 6);
      notifyDigest({
        type: "scheduled_digest",
        userId,
        ts: new Date().toISOString(),
        topStories: scoped.map((item) => ({
          title: item.title,
          severity: item.severity,
          source: item.source
        }))
      });
    });
  });
  // News refreshes in a true randomized 5–10 minute loop.
  scheduleRefreshLoop();
}

boot();

app.listen(PORT, () => {
  console.log(`CyberPulse backend listening at http://localhost:${PORT}`);
});
