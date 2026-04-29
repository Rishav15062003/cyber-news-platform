export const DEFAULT_PROFILE = {
  topics: [],
  sectors: [],
  role: "analyst",
  riskProfile: "balanced",
  alertPolicy: "critical",
  quietHours: {
    enabled: false,
    startHour: 22,
    endHour: 7
  }
};

export function applyProfile(items, profile = DEFAULT_PROFILE) {
  const topics = new Set((profile.topics || []).map((v) => String(v).toLowerCase()));
  const sectors = new Set((profile.sectors || []).map((v) => String(v).toLowerCase()));
  const riskProfile = profile.riskProfile || "balanced";

  if (!topics.size && !sectors.size && riskProfile === "balanced") {
    return items;
  }

  const severityAllowList =
    riskProfile === "strict" ? new Set(["critical", "high"]) : new Set(["critical", "high", "medium"]);

  return items.filter((item) => {
    if (!severityAllowList.has(item.severity)) return false;
    const matchTopic = !topics.size || topics.has(item.category) || item.tags.some((tag) => topics.has(String(tag).toLowerCase()));
    const matchSector =
      !sectors.size ||
      (item.sourceSectors || []).some((sector) => sectors.has(String(sector).toLowerCase()));
    return matchTopic && matchSector;
  });
}
