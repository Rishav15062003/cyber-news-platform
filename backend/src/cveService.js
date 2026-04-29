import axios from "axios";

const cveCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function normalizeCveId(value = "") {
  return String(value).toUpperCase().replace(/\s+/g, "-").trim();
}

function fromCache(cveId) {
  const entry = cveCache.get(cveId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cveCache.delete(cveId);
    return null;
  }
  return entry.value;
}

function setCache(cveId, value) {
  cveCache.set(cveId, {
    cachedAt: Date.now(),
    value
  });
}

async function fetchFromCircl(cveId) {
  const response = await axios.get(`https://cve.circl.lu/api/cve/${encodeURIComponent(cveId)}`, {
    timeout: 10000
  });
  const data = response.data || {};
  return {
    cveId,
    description: data.summary || "No description available.",
    cvssScore: data.cvss ?? null,
    severity: data.cvss ? (Number(data.cvss) >= 9 ? "critical" : Number(data.cvss) >= 7 ? "high" : "medium") : "unknown",
    publishedAt: data.Published || data.published || null,
    reference: Array.isArray(data.references) && data.references.length ? data.references[0] : null,
    source: "cve.circl.lu"
  };
}

async function fetchFromNvd(cveId) {
  const response = await axios.get("https://services.nvd.nist.gov/rest/json/cves/2.0", {
    timeout: 12000,
    params: { cveId }
  });
  const item = response.data?.vulnerabilities?.[0]?.cve;
  if (!item) return null;
  const metrics = item.metrics || {};
  const v31 = metrics.cvssMetricV31?.[0]?.cvssData;
  const v30 = metrics.cvssMetricV30?.[0]?.cvssData;
  const v2 = metrics.cvssMetricV2?.[0]?.cvssData;
  const cvss = v31 || v30 || v2 || {};
  const description = item.descriptions?.find((desc) => desc.lang === "en")?.value || "No description available.";
  const refs = item.references || [];

  return {
    cveId,
    description,
    cvssScore: cvss.baseScore ?? null,
    severity: (cvss.baseSeverity || "unknown").toLowerCase(),
    publishedAt: item.published || null,
    reference: refs[0]?.url || null,
    source: "nvd.nist.gov"
  };
}

export async function getCveDetails(inputIds = []) {
  const ids = [...new Set(inputIds.map(normalizeCveId))].filter((id) => /^CVE-\d{4}-\d{4,7}$/.test(id));
  const results = [];

  for (const cveId of ids) {
    const cached = fromCache(cveId);
    if (cached) {
      results.push(cached);
      continue;
    }

    let detail = null;
    try {
      detail = await fetchFromNvd(cveId);
    } catch {
      detail = null;
    }
    if (!detail) {
      try {
        detail = await fetchFromCircl(cveId);
      } catch {
        detail = {
          cveId,
          description: "Unable to fetch CVE details at the moment.",
          cvssScore: null,
          severity: "unknown",
          publishedAt: null,
          reference: null,
          source: "unavailable"
        };
      }
    }
    setCache(cveId, detail);
    results.push(detail);
  }

  return results;
}
