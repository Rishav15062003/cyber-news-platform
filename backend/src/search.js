function normalize(value = "") {
  return String(value).toLowerCase().trim();
}

async function searchWithExternalEngine(query, limit) {
  const engine = process.env.SEARCH_ENGINE || "local";
  if (engine === "meilisearch" && process.env.MEILI_HOST && process.env.MEILI_API_KEY) {
    try {
      const response = await fetch(`${process.env.MEILI_HOST}/indexes/cyber_news/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MEILI_API_KEY}`
        },
        body: JSON.stringify({ q: query, limit })
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.hits || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function searchNews(items, query = "") {
  const q = normalize(query);
  if (!q) return items;
  const terms = q.split(/\s+/).filter(Boolean);
  return items
    .map((item) => {
      const hay = normalize(`${item.title} ${item.summary} ${item.category} ${(item.tags || []).join(" ")}`);
      const score = terms.reduce((acc, term) => acc + (hay.includes(term) ? 1 : 0), 0);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

export async function searchNewsHybrid(items, query = "", limit = 80) {
  const external = await searchWithExternalEngine(query, limit);
  if (external && external.length) return external;
  return searchNews(items, query).slice(0, limit);
}

export function addSearchMetadata(items) {
  return items.map((item) => ({
    ...item,
    searchText: `${item.title} ${item.summary} ${(item.tags || []).join(" ")}`
  }));
}
