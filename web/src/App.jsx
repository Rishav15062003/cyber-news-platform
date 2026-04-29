import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const USER_ID = "default";

const severityOptions = ["all", "critical", "high", "medium"];
const categoryOptions = ["all", "general", "vulnerability", "malware", "breach", "threat-intel", "policy"];
const riskOptions = ["balanced", "strict"];
const roleOptions = ["analyst", "soc", "ciso", "engineer"];
const alertPolicyOptions = ["critical", "high", "digest"];
const topicOptions = ["vulnerability", "malware", "breach", "threat-intel", "policy", "general"];
const sectorOptions = ["enterprise", "soc", "cloud", "government", "critical-infra", "endpoint", "windows"];
const sortOptions = [
  { value: "relevance", label: "relevance" },
  { value: "time_desc", label: "time (newest first)" },
  { value: "time_asc", label: "time (oldest first)" }
];

function severityClass(severity) {
  if (severity === "critical") return "chip chip-critical";
  if (severity === "high") return "chip chip-high";
  return "chip chip-medium";
}

function LoadingSkeleton() {
  return (
    <section className="grid">
      {Array.from({ length: 8 }).map((_, index) => (
        <article className="card skeleton" key={`skeleton-${index}`}>
          <div className="skeleton-line short" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line short" />
        </article>
      ))}
    </section>
  );
}

function NewsCard({ item, summaryMode, bookmarked, onToggleBookmark, onOpenBrief }) {
  return (
    <article className="card">
      <div className="card-top">
        <span className={severityClass(item.severity)}>{item.severity}</span>
        <div className="card-top-right">
          <span className="source">{item.source}</span>
          <button
            className={`bookmark ${bookmarked ? "saved" : ""}`}
            onClick={() => onToggleBookmark(item.id)}
            type="button"
          >
            {bookmarked ? "Saved" : "Save"}
          </button>
        </div>
      </div>
      <button className="title-btn" type="button" onClick={() => onOpenBrief(item)}>
        {item.title}
      </button>
      <p className="summary">
        {summaryMode === "technical" ? item.aiSummary?.technical : item.aiSummary?.quick || item.summary}
      </p>
      <div className="card-actions">
        <button className="toggle small" type="button" onClick={() => onOpenBrief(item)}>
          AI Brief
        </button>
        <a className="toggle small link-btn" href={item.url} target="_blank" rel="noreferrer">
          Open Article
        </a>
      </div>
      <div className="card-footer">
        <span>{item.category} | conf {(item.confidenceScore * 100).toFixed(0)}%</span>
        <span>{item.publishedFromNow}</span>
      </div>
      {item.clusterSize > 1 && <div className="cluster">Same incident seen from {item.clusterSize} sources</div>}
    </article>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState([]);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextRefreshAt, setNextRefreshAt] = useState(null);
  const [refreshEtaText, setRefreshEtaText] = useState("calculating...");
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [sourceId, setSourceId] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("time_desc");
  const [summaryMode, setSummaryMode] = useState("quick");
  const [riskProfile, setRiskProfile] = useState("balanced");
  const [role, setRole] = useState("analyst");
  const [alertPolicy, setAlertPolicy] = useState("critical");
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState(22);
  const [quietEnd, setQuietEnd] = useState(7);
  const [newStories, setNewStories] = useState(0);
  const [density, setDensity] = useState("compact");
  const [toastMessage, setToastMessage] = useState("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentError, setIncidentError] = useState("");
  const [sourceDashboardOpen, setSourceDashboardOpen] = useState(false);
  const [updatingSourceId, setUpdatingSourceId] = useState("");
  const [activeBrief, setActiveBrief] = useState(null);
  const [briefCves, setBriefCves] = useState([]);
  const [briefCvesLoading, setBriefCvesLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "80" });
    if (severity !== "all") params.set("severity", severity);
    if (category !== "all") params.set("category", category);
    if (sourceId !== "all") params.set("source", sourceId);
    if (searchText.trim()) params.set("q", searchText.trim());
    params.set("sort", sortBy);
    params.set("userId", USER_ID);
    return params.toString();
  }, [severity, category, sourceId, searchText, sortBy]);

  const visibleItems = useMemo(() => {
    if (!showSavedOnly) return items;
    return items.filter((item) => bookmarks.has(item.id));
  }, [items, showSavedOnly, bookmarks]);

  async function loadNews(isBackground = false) {
    const previousCount = items.length;
    if (!isBackground) setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/news?${query}`);
      if (!response.ok) throw new Error("Failed to fetch feed");
      const data = await response.json();
      const serverItems = data.items || [];
      const sortedItems = [...serverItems];
      if (sortBy === "time_desc") {
        sortedItems.sort((a, b) => (b.publishedTs || 0) - (a.publishedTs || 0));
      } else if (sortBy === "time_asc") {
        sortedItems.sort((a, b) => (a.publishedTs || 0) - (b.publishedTs || 0));
      }
      setItems(sortedItems);
      setLastUpdated(data.lastUpdatedAt || null);
      setNextRefreshAt(data.nextRefreshAt || null);
      setRiskProfile(data.profile?.riskProfile || "balanced");
      setRole(data.profile?.role || "analyst");
      setAlertPolicy(data.profile?.alertPolicy || "critical");
      setSelectedTopics(data.profile?.topics || []);
      setSelectedSectors(data.profile?.sectors || []);
      setQuietEnabled(Boolean(data.profile?.quietHours?.enabled));
      setQuietStart(Number(data.profile?.quietHours?.startHour ?? 22));
      setQuietEnd(Number(data.profile?.quietHours?.endHour ?? 7));
      if (isBackground && previousCount && (data.items || []).length > previousCount) {
        setNewStories((data.items || []).length - previousCount);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSources() {
    const response = await fetch(`${API_BASE_URL}/api/news/sources`);
    if (!response.ok) return;
    setSources(await response.json());
  }

  async function setSourceEnabled(sourceId, enabled) {
    setUpdatingSourceId(sourceId);
    try {
      await fetch(`${API_BASE_URL}/api/news/sources/${encodeURIComponent(sourceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      await loadSources();
      await loadNews(true);
      setToastMessage(`Source ${enabled ? "enabled" : "disabled"}: ${sourceId}`);
      setTimeout(() => setToastMessage(""), 2200);
    } finally {
      setUpdatingSourceId("");
    }
  }

  async function loadBookmarks() {
    const response = await fetch(`${API_BASE_URL}/api/users/${USER_ID}/bookmarks`);
    if (!response.ok) return;
    const data = await response.json();
    setBookmarks(new Set(data.itemIds || []));
  }

  async function loadIncidents() {
    const response = await fetch(`${API_BASE_URL}/api/news/incidents`);
    if (!response.ok) return;
    const data = await response.json();
    setIncidents((data.items || []).slice(0, 5));
  }

  async function openIncident(clusterId) {
    setIncidentLoading(true);
    setIncidentError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/news/incidents/${encodeURIComponent(clusterId)}`);
      if (!response.ok) throw new Error("Unable to load incident details");
      const data = await response.json();
      setSelectedIncident(data);
    } catch (error) {
      setIncidentError(error.message || "Failed to load incident.");
    } finally {
      setIncidentLoading(false);
    }
  }

  async function openAiBrief(item) {
    setActiveBrief(item);
    const cves = Array.isArray(item.cves) ? item.cves : [];
    if (!cves.length) {
      setBriefCves([]);
      return;
    }
    setBriefCvesLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/cves?ids=${encodeURIComponent(cves.join(","))}`);
      if (!response.ok) throw new Error("Unable to fetch CVE details");
      const data = await response.json();
      setBriefCves(data.items || []);
    } catch {
      setBriefCves([]);
    } finally {
      setBriefCvesLoading(false);
    }
  }

  async function toggleBookmark(itemId) {
    if (bookmarks.has(itemId)) {
      await fetch(`${API_BASE_URL}/api/users/${USER_ID}/bookmarks/${encodeURIComponent(itemId)}`, {
        method: "DELETE"
      });
      const next = new Set(bookmarks);
      next.delete(itemId);
      setBookmarks(next);
      return;
    }
    await fetch(`${API_BASE_URL}/api/users/${USER_ID}/bookmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId })
    });
    const next = new Set(bookmarks);
    next.add(itemId);
    setBookmarks(next);
  }

  async function updateProfile(changes = {}) {
    setSavingProfile(true);
    const body = {
      riskProfile,
      role,
      alertPolicy,
      topics: selectedTopics,
      sectors: selectedSectors,
      quietHours: { enabled: quietEnabled, startHour: quietStart, endHour: quietEnd },
      ...changes
    };
    try {
      await fetch(`${API_BASE_URL}/api/users/${USER_ID}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      setToastMessage("Profile settings saved");
      setTimeout(() => setToastMessage(""), 2000);
      loadNews(true);
    } finally {
      setSavingProfile(false);
    }
  }

  async function requestDigest() {
    const response = await fetch(`${API_BASE_URL}/api/users/${USER_ID}/digest`, { method: "POST" });
    if (!response.ok) return;
    setToastMessage("Digest generated and pushed.");
    setTimeout(() => setToastMessage(""), 2600);
  }

  function exportBookmarks(format) {
    window.open(`${API_BASE_URL}/api/users/${USER_ID}/bookmarks/export?format=${format}`, "_blank");
  }

  useEffect(() => {
    if (!nextRefreshAt) {
      setRefreshEtaText("calculating...");
      return undefined;
    }
    const updateEta = () => {
      const deltaMs = new Date(nextRefreshAt).getTime() - Date.now();
      if (Number.isNaN(deltaMs)) {
        setRefreshEtaText("calculating...");
        return;
      }
      if (deltaMs <= 0) {
        setRefreshEtaText("any moment");
        return;
      }
      const totalSeconds = Math.ceil(deltaMs / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      if (mins > 0) {
        setRefreshEtaText(`${mins}m ${secs}s`);
      } else {
        setRefreshEtaText(`${secs}s`);
      }
    };
    updateEta();
    const timer = setInterval(updateEta, 1000);
    return () => clearInterval(timer);
  }, [nextRefreshAt]);

  useEffect(() => {
    loadSources();
    loadBookmarks();
    loadIncidents();
    loadNews();
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = () => {
      const delayMs = (5 + Math.floor(Math.random() * 6)) * 60_000; // 5–10 minutes
      setTimeout(async () => {
        if (cancelled) return;
        await loadNews(true);
        loadIncidents();
        scheduleNext();
      }, delayMs);
    };

    scheduleNext();
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    const stream = new EventSource(`${API_BASE_URL}/api/alerts/stream`);
    stream.addEventListener("critical", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Notification.permission === "granted" && data?.items?.length) {
          const headline = data.items[0].title;
          new Notification("CyberPulse Critical Alert", {
            body: headline
          });
        }
        setToastMessage("Critical alert received");
        setTimeout(() => setToastMessage(""), 2600);
      } catch {
        // noop
      }
    });
    stream.addEventListener("digest", () => {
      setToastMessage("New digest available");
      setTimeout(() => setToastMessage(""), 2600);
    });
    return () => stream.close();
  }, []);

  useEffect(() => {
    const keyHandler = (event) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        document.getElementById("feed-search")?.focus();
      }
      if (event.key.toLowerCase() === "s") {
        setShowSavedOnly((value) => !value);
      }
      if (event.key.toLowerCase() === "d") {
        setDensity((value) => (value === "compact" ? "comfortable" : "compact"));
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, []);

  return (
    <main className={`container ${density}`}>
      <header className="hero">
        <div>
          <h1>CyberPulse</h1>
          <p>Trusted cybersecurity news, auto-aggregated every 5–10 minutes.</p>
        </div>
        <button className="refresh" onClick={() => loadNews(false)}>
          Refresh now
        </button>
      </header>

      <section className="filters">
        <label>
          Search
          <input
            id="feed-search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search title, CVE, malware..."
          />
        </label>

        <label>
          Severity
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {severityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Source
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="all">all</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          AI Summary
          <select value={summaryMode} onChange={(e) => setSummaryMode(e.target.value)}>
            <option value="quick">quick</option>
            <option value="technical">technical</option>
          </select>
        </label>

        <label>
          Risk Profile
          <select value={riskProfile} onChange={(e) => setRiskProfile(e.target.value)}>
            {riskOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Role
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
            }}
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Alert Policy
          <select
            value={alertPolicy}
            onChange={(e) => {
              setAlertPolicy(e.target.value);
            }}
          >
            {alertPolicyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="updated">
          Last update: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "waiting..."}
        </div>
        <div className="updated">
          Next refresh in: {refreshEtaText}
        </div>
      </section>

      <section className="prefs-head">
        <button className={`toggle ${showProfileSettings ? "active" : ""}`} onClick={() => setShowProfileSettings((v) => !v)}>
          {showProfileSettings ? "Hide Profile Settings" : "Show Profile Settings"}
        </button>
        <button className="toggle" disabled={savingProfile} onClick={() => updateProfile()}>
          {savingProfile ? "Saving..." : "Save Profile Settings"}
        </button>
      </section>

      {showProfileSettings && <section className="prefs">
        <div className="pref-block">
          <strong>Topics</strong>
          <div className="pills">
            {topicOptions.map((topic) => (
              <button
                key={topic}
                className={`pill ${selectedTopics.includes(topic) ? "active" : ""}`}
                onClick={() => {
                  const next = selectedTopics.includes(topic)
                    ? selectedTopics.filter((t) => t !== topic)
                    : [...selectedTopics, topic];
                  setSelectedTopics(next);
                }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        <div className="pref-block">
          <strong>Sectors</strong>
          <div className="pills">
            {sectorOptions.map((sector) => (
              <button
                key={sector}
                className={`pill ${selectedSectors.includes(sector) ? "active" : ""}`}
                onClick={() => {
                  const next = selectedSectors.includes(sector)
                    ? selectedSectors.filter((s) => s !== sector)
                    : [...selectedSectors, sector];
                  setSelectedSectors(next);
                }}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>

        <div className="pref-block inline">
          <label>
            <input
              type="checkbox"
              checked={quietEnabled}
              onChange={(e) => {
                setQuietEnabled(e.target.checked);
              }}
            />
            Quiet Hours
          </label>
          <input
            type="number"
            min="0"
            max="23"
            value={quietStart}
            onChange={(e) => {
              const value = Number(e.target.value || 22);
              setQuietStart(value);
            }}
          />
          <input
            type="number"
            min="0"
            max="23"
            value={quietEnd}
            onChange={(e) => {
              const value = Number(e.target.value || 7);
              setQuietEnd(value);
            }}
          />
        </div>
      </section>}

      <section className="top-actions">
        <button className={`toggle ${showSavedOnly ? "active" : ""}`} onClick={() => setShowSavedOnly((v) => !v)}>
          {showSavedOnly ? "Showing Saved Only" : "Show Saved Only"}
        </button>
        <button className={`toggle ${sourceDashboardOpen ? "active" : ""}`} onClick={() => setSourceDashboardOpen((v) => !v)}>
          {sourceDashboardOpen ? "Hide Source Health" : "Show Source Health"}
        </button>
        <button className="toggle" onClick={() => setDensity((v) => (v === "compact" ? "comfortable" : "compact"))}>
          Density: {density}
        </button>
        <button className="toggle" onClick={() => Notification.requestPermission()}>
          Enable Browser Alerts
        </button>
        <button className="toggle" onClick={requestDigest}>
          Generate Digest
        </button>
        <button className="toggle" onClick={() => exportBookmarks("markdown")}>
          Export Saved (MD)
        </button>
        <button className="toggle" onClick={() => exportBookmarks("csv")}>
          Export Saved (CSV)
        </button>
        {newStories > 0 && (
          <button
            className="toggle active"
            onClick={() => {
              setNewStories(0);
              loadNews();
            }}
          >
            {newStories} new stories
          </button>
        )}
      </section>

      {sourceDashboardOpen && (
        <section className="source-dashboard">
          <div className="source-dashboard-head">
            <h3>Source Health Dashboard</h3>
            <button className="toggle" onClick={() => loadSources()}>
              Refresh Source Health
            </button>
          </div>
          <div className="source-grid">
            {sources.map((source) => {
              const health = source.health || {};
              const isBusy = updatingSourceId === source.id;
              return (
                <article className="source-card" key={source.id}>
                  <div className="source-top">
                    <strong>{source.name}</strong>
                    <span className={`status-pill ${health.status || "unknown"}`}>{health.status || "unknown"}</span>
                  </div>
                  <div className="source-meta">
                    <span>Last fetch: {health.lastFetchAt ? new Date(health.lastFetchAt).toLocaleString() : "n/a"}</span>
                    <span>URL used: {health.usedUrl || source.url}</span>
                    <span>Fallback used: {health.fallbackUsed ? "yes" : "no"}</span>
                    <span>Failures: {health.consecutiveFailures || 0}</span>
                    {!!health.error && <span className="source-error">Error: {health.error}</span>}
                  </div>
                  <div className="source-actions">
                    <button
                      className="toggle"
                      disabled={isBusy || source.enabled}
                      onClick={() => setSourceEnabled(source.id, true)}
                    >
                      {isBusy ? "Updating..." : "Enable"}
                    </button>
                    <button
                      className="toggle"
                      disabled={isBusy || !source.enabled}
                      onClick={() => setSourceEnabled(source.id, false)}
                    >
                      {isBusy ? "Updating..." : "Disable"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="incident-bar">
        {incidents.map((incident) => (
          <button className="incident-pill" key={incident.clusterId} onClick={() => openIncident(incident.clusterId)}>
            Incident: {incident.sourceCount} sources | {incident.representativeTitle.slice(0, 56)}
          </button>
        ))}
      </section>

      {!!incidentError && <div className="status error">{incidentError}</div>}

      {!!selectedIncident && (
        <section className="incident-detail">
          <div className="incident-detail-head">
            <h3>Incident Detail</h3>
            <button className="toggle" onClick={() => setSelectedIncident(null)}>
              Close
            </button>
          </div>
          <p className="incident-title">{selectedIncident.summary.representativeTitle}</p>
          <div className="incident-meta">
            <span>{selectedIncident.summary.category}</span>
            <span>{selectedIncident.summary.severity}</span>
            <span>{selectedIncident.summary.sourceCount} sources</span>
            <span>confidence {(selectedIncident.summary.confidenceScore * 100).toFixed(0)}%</span>
          </div>
          <div className="incident-explain">
            <strong>Confidence Explanation</strong>
            <p>{selectedIncident.summary.explanation.sourceTrust}</p>
            <p>{selectedIncident.summary.explanation.multiSource}</p>
            <p>{selectedIncident.summary.explanation.recency}</p>
          </div>
          <div className="incident-timeline">
            <strong>Timeline</strong>
            {selectedIncident.timeline.map((step) => (
              <div className="timeline-item" key={`${step.id}-${step.publishedAt}`}>
                <div className="timeline-time">{new Date(step.publishedAt).toLocaleString()}</div>
                <a href={step.url} target="_blank" rel="noreferrer">
                  {step.title}
                </a>
                <div className="timeline-meta">
                  {step.source} | {step.severity} | conf {(step.confidenceScore * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {incidentLoading && <div className="status">Loading incident details...</div>}

      {!!activeBrief && (
        <section className="brief-panel">
          <div className="incident-detail-head">
            <h3>AI Brief</h3>
            <button
              className="toggle"
              onClick={() => {
                setActiveBrief(null);
                setBriefCves([]);
              }}
            >
              Close
            </button>
          </div>
          <p className="incident-title">{activeBrief.title}</p>
          <div className="incident-meta">
            <span>{activeBrief.source}</span>
            <span>{activeBrief.category}</span>
            <span>{activeBrief.severity}</span>
            <span>confidence {(activeBrief.confidenceScore * 100).toFixed(0)}%</span>
          </div>
          <div className="brief-block">
            <strong>Quick Summary</strong>
            <p>{activeBrief.aiSummary?.quick || activeBrief.summary || "Summary unavailable."}</p>
          </div>
          <div className="brief-block">
            <strong>Technical Summary</strong>
            <p>{activeBrief.aiSummary?.technical || "Technical summary unavailable."}</p>
          </div>
          <div className="brief-block">
            <strong>CVE Intelligence</strong>
            {!activeBrief.cves?.length && <p>No CVE mentioned in this article.</p>}
            {!!activeBrief.cves?.length && briefCvesLoading && <p>Loading CVE details...</p>}
            {!!activeBrief.cves?.length && !briefCvesLoading && briefCves.length === 0 && (
              <p>CVE IDs found, but details could not be loaded right now.</p>
            )}
            {briefCves.map((cve) => (
              <div key={cve.cveId} className="cve-item">
                <div className="cve-head">
                  <strong>{cve.cveId}</strong>
                  <span>
                    {cve.severity} {cve.cvssScore != null ? `| CVSS ${cve.cvssScore}` : ""}
                  </span>
                </div>
                <p>{cve.description}</p>
                <div className="cve-meta">
                  <span>{cve.publishedAt ? new Date(cve.publishedAt).toLocaleDateString() : "date n/a"}</span>
                  <span>source: {cve.source}</span>
                  {!!cve.reference && (
                    <a href={cve.reference} target="_blank" rel="noreferrer">
                      reference
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="card-actions">
            <a className="toggle small link-btn" href={activeBrief.url} target="_blank" rel="noreferrer">
              Open Full Article
            </a>
          </div>
        </section>
      )}

      {loading && <div className="status">Loading latest cyber feed...</div>}
      {!!toastMessage && <div className="status toast">{toastMessage}</div>}
      {error && <div className="status error">{error}</div>}
      {!loading && !error && visibleItems.length === 0 && <div className="status">No matching articles found.</div>}
      {loading && <LoadingSkeleton />}

      <section className="grid">
        {!loading &&
          visibleItems.map((item) => (
            <NewsCard
              key={item.id + item.publishedAt}
              item={item}
              summaryMode={summaryMode}
              bookmarked={bookmarks.has(item.id)}
              onToggleBookmark={toggleBookmark}
              onOpenBrief={openAiBrief}
            />
          ))}
      </section>
    </main>
  );
}
