export const TRUSTED_SOURCES = [
  {
    id: "the-hacker-news",
    name: "The Hacker News",
    type: "rss",
    url: "https://feeds.feedburner.com/TheHackersNews",
    trustScore: 0.9,
    sectors: ["general", "enterprise", "soc"],
    mirrors: [],
    enabled: true
  },
  {
    id: "bleeping-computer",
    name: "BleepingComputer",
    type: "rss",
    url: "https://www.bleepingcomputer.com/feed/",
    trustScore: 0.88,
    sectors: ["general", "endpoint", "windows"],
    mirrors: [],
    enabled: true
  },
  {
    id: "krebs-on-security",
    name: "Krebs on Security",
    type: "rss",
    url: "https://krebsonsecurity.com/feed/",
    trustScore: 0.95,
    sectors: ["investigations", "policy", "threat-intel"],
    mirrors: [],
    enabled: true
  },
  {
    id: "cisa-alerts",
    name: "CISA Alerts",
    type: "rss",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    trustScore: 0.99,
    sectors: ["critical-infra", "government", "soc"],
    mirrors: [],
    enabled: true
  },
  {
    id: "us-cert",
    name: "US-CERT",
    type: "rss",
    url: "https://www.cisa.gov/news.xml",
    trustScore: 0.97,
    sectors: ["critical-infra", "government"],
    mirrors: ["https://www.cisa.gov/cybersecurity-advisories/all.xml"],
    enabled: true
  },
  {
    id: "dark-reading",
    name: "Dark Reading",
    type: "rss",
    url: "https://www.darkreading.com/rss.xml",
    trustScore: 0.87,
    sectors: ["enterprise", "soc", "cloud"],
    mirrors: [],
    enabled: true
  },
  {
    id: "securityweek",
    name: "SecurityWeek",
    type: "rss",
    url: "https://www.securityweek.com/feed/",
    trustScore: 0.88,
    sectors: ["enterprise", "general", "threat-intel"],
    mirrors: [],
    enabled: true
  },
  {
    id: "schneier-security",
    name: "Schneier on Security",
    type: "rss",
    url: "https://www.schneier.com/blog/atom.xml",
    trustScore: 0.93,
    sectors: ["policy", "strategy", "general"],
    mirrors: [],
    enabled: true
  },
  {
    id: "google-cloud-security",
    name: "Google Cloud Security Blog",
    type: "rss",
    url: "https://cloudblog.withgoogle.com/topics/security/rss/",
    trustScore: 0.94,
    sectors: ["cloud", "enterprise", "engineering"],
    mirrors: [],
    enabled: true
  },
  {
    id: "microsoft-security-blog",
    name: "Microsoft Security Blog",
    type: "rss",
    url: "https://www.microsoft.com/en-us/security/blog/feed/",
    trustScore: 0.95,
    sectors: ["windows", "cloud", "enterprise"],
    mirrors: [],
    enabled: true
  },
  {
    id: "talos-intelligence",
    name: "Cisco Talos",
    type: "rss",
    url: "https://feeds.feedburner.com/feedburner/Talos",
    trustScore: 0.94,
    sectors: ["threat-intel", "network", "soc"],
    mirrors: [
      "https://blog.talosintelligence.com/feeds/posts/default?alt=rss",
      "https://blog.talosintelligence.com/feeds/posts/default?alt=rss&start-index=1&max-results=20",
      "https://feeds.feedburner.com/feedburner/Talos"
    ],
    enabled: true
  },
  {
    id: "paloalto-unit42",
    name: "Palo Alto Unit 42",
    type: "rss",
    url: "https://unit42.paloaltonetworks.com/feed/",
    trustScore: 0.93,
    sectors: ["threat-intel", "cloud", "enterprise"],
    mirrors: [],
    enabled: true
  },
  {
    id: "crowdstrike-blog",
    name: "CrowdStrike Blog",
    type: "rss",
    url: "https://www.crowdstrike.com/blog/feed/",
    trustScore: 0.92,
    sectors: ["endpoint", "threat-intel", "soc"],
    mirrors: [],
    enabled: true
  },
  {
    id: "sentinelone-labs",
    name: "SentinelLabs",
    type: "rss",
    url: "https://www.sentinelone.com/labs/feed/",
    trustScore: 0.91,
    sectors: ["malware", "endpoint", "research"],
    mirrors: [],
    enabled: true
  },
  {
    id: "rapid7-blog",
    name: "Rapid7 Blog",
    type: "rss",
    url: "https://www.rapid7.com/blog/rss/",
    trustScore: 0.9,
    sectors: ["vulnerability", "soc", "cloud"],
    mirrors: [],
    enabled: true
  },
  {
    id: "trendmicro-research",
    name: "Trend Micro Research",
    type: "rss",
    url: "https://www.trendmicro.com/en_us/research.html?feed=all",
    trustScore: 0.9,
    sectors: ["malware", "endpoint", "threat-intel"],
    mirrors: [],
    enabled: true
  },
  {
    id: "cloudflare-blog",
    name: "Cloudflare Blog (Security)",
    type: "rss",
    url: "https://blog.cloudflare.com/tag/security/rss/",
    trustScore: 0.91,
    sectors: ["network", "ddos", "cloud"],
    mirrors: [],
    enabled: true
  },
  {
    id: "sans-isc",
    name: "SANS Internet Storm Center",
    type: "rss",
    url: "https://isc.sans.edu/rssfeed.xml",
    trustScore: 0.92,
    sectors: ["soc", "malware", "incident-response"],
    mirrors: [],
    enabled: true
  },
  {
    id: "cert-eu",
    name: "CERT-EU",
    type: "rss",
    url: "https://cert.europa.eu/publications/security-advisories-rss",
    trustScore: 0.96,
    sectors: ["government", "critical-infra", "policy"],
    mirrors: ["https://cert.europa.eu/publications/security-advisories-rss"],
    enabled: true
  },
  {
    id: "naked-security",
    name: "Sophos Naked Security",
    type: "rss",
    url: "https://nakedsecurity.sophos.com/feed/",
    trustScore: 0.88,
    sectors: ["endpoint", "general", "awareness"],
    mirrors: [
      "https://nakedsecurity.sophos.com/feed/?output=rss2",
      "https://nakedsecurity.sophos.com/feed/atom/",
      "https://nakedsecurity.sophos.com/feed/?output=atom"
    ],
    enabled: true
  },
  {
    id: "cert-in-advisories",
    name: "CERT-In Advisories",
    type: "rss",
    url: "https://www.cert-in.org.in/s2cMainServlet?pageid=PUBADV01&id=0",
    trustScore: 0.99,
    sectors: ["government", "critical-infra", "india", "soc"],
    mirrors: [],
    enabled: false
  },
  {
    id: "nciipc",
    name: "NCIIPC",
    type: "rss",
    url: "https://nciipc.gov.in/alerts_advisories.html",
    trustScore: 0.97,
    sectors: ["critical-infra", "government", "india"],
    mirrors: [],
    enabled: false
  },
  {
    id: "cyberpeace-foundation",
    name: "CyberPeace Foundation",
    type: "rss",
    url: "https://www.cyberpeace.org/feed/",
    trustScore: 0.86,
    sectors: ["awareness", "policy", "india"],
    mirrors: [],
    enabled: false
  },
  {
    id: "inc42-cybersecurity",
    name: "Inc42 Cybersecurity",
    type: "rss",
    url: "https://inc42.com/buzz/topic/cybersecurity/feed/",
    trustScore: 0.83,
    sectors: ["startup", "policy", "india"],
    mirrors: [],
    enabled: false
  }
];

export function getSourceById(sourceId) {
  return TRUSTED_SOURCES.find((source) => source.id === sourceId);
}

export function getRuntimeSources(sourceConfig = {}) {
  return TRUSTED_SOURCES.map((source) => ({
    ...source,
    enabled: sourceConfig[source.id]?.enabled ?? source.enabled ?? true
  }));
}
