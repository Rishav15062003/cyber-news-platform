import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator
} from "react-native";

// Replace with your machine LAN IP while testing on physical device.
const API_BASE_URL = "http://localhost:4000";
const USER_ID = "default";

const severityColor = {
  critical: "#fca5a5",
  high: "#fdba74",
  medium: "#93c5fd"
};

function NewsItem({ item, onOpenBrief, isBookmarked, onToggleBookmark }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onOpenBrief(item)}>
      <View style={styles.topRow}>
        <Text style={[styles.severity, { color: severityColor[item.severity] || "#93c5fd" }]}>
          {item.severity.toUpperCase()}
        </Text>
        <Text style={styles.source}>{item.source}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.summary} numberOfLines={3}>
        {item.aiSummary?.quick || item.summary || "No summary available"}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{item.category}</Text>
        <Text style={styles.footerText}>{item.publishedFromNow}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.saveBtn, isBookmarked ? styles.saveBtnActive : null]}
          onPress={() => onToggleBookmark(item.id)}
        >
          <Text style={styles.saveBtnText}>{isBookmarked ? "Saved" : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookmarkIds, setBookmarkIds] = useState(new Set());
  const [activeBrief, setActiveBrief] = useState(null);
  const [briefCves, setBriefCves] = useState([]);
  const [briefCvesLoading, setBriefCvesLoading] = useState(false);

  const endpoint = useMemo(() => `${API_BASE_URL}/api/news?limit=60&sort=time_desc&userId=${encodeURIComponent(USER_ID)}`, []);

  async function loadBookmarks() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(USER_ID)}/bookmarks`);
      if (!response.ok) return;
      const data = await response.json();
      setBookmarkIds(new Set(data.itemIds || []));
    } catch {
      // no-op
    }
  }

  async function loadFeed(isBackground = false) {
    if (!isBackground) setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      setError("Unable to load feed. Check backend URL/IP.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
    loadBookmarks();

    let cancelled = false;
    const scheduleNext = () => {
      const delayMs = (5 + Math.floor(Math.random() * 6)) * 60 * 1000; // 5–10 minutes
      setTimeout(async () => {
        if (cancelled) return;
        await loadFeed(true);
        scheduleNext();
      }, delayMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  async function openAiBrief(item) {
    setActiveBrief(item);
    setBriefCves([]);

    const cves = Array.isArray(item.cves) ? item.cves : [];
    if (!cves.length) return;

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
    if (bookmarkIds.has(itemId)) {
      try {
        await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(USER_ID)}/bookmarks/${encodeURIComponent(itemId)}`, {
          method: "DELETE"
        });
      } catch {
        // no-op
      }
      const next = new Set(bookmarkIds);
      next.delete(itemId);
      setBookmarkIds(next);
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(USER_ID)}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId })
      });
    } catch {
      // no-op
    }

    const next = new Set(bookmarkIds);
    next.add(itemId);
    setBookmarkIds(next);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.heading}>CyberPulse Mobile</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => loadFeed(false)}>
          <Text style={styles.refreshTxt}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading && <Text style={styles.status}>Loading feed...</Text>}
      {!!error && <Text style={[styles.status, styles.error]}>{error}</Text>}

      <FlatList
        data={items}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        renderItem={({ item }) => (
          <NewsItem
            item={item}
            onOpenBrief={openAiBrief}
            isBookmarked={bookmarkIds.has(item.id)}
            onToggleBookmark={toggleBookmark}
          />
        )}
        contentContainerStyle={styles.list}
      />

      <Modal visible={!!activeBrief} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>AI Brief</Text>
              <TouchableOpacity onPress={() => setActiveBrief(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 620 }}>
              {!!activeBrief && (
                <>
                  <Text style={styles.modalHeadline}>{activeBrief.title}</Text>
                  <View style={styles.modalMetaRow}>
                    <Text style={styles.modalMeta}>{activeBrief.severity}</Text>
                    <Text style={styles.modalMeta}>{activeBrief.category}</Text>
                    <Text style={styles.modalMeta}>conf {activeBrief.confidenceScore != null ? `${Math.round(activeBrief.confidenceScore * 100)}%` : "n/a"}</Text>
                  </View>

                  <View style={styles.modalBlock}>
                    <Text style={styles.modalBlockHead}>Quick Summary</Text>
                    <Text style={styles.modalText}>{activeBrief.aiSummary?.quick || activeBrief.summary || "Summary unavailable."}</Text>
                  </View>

                  <View style={styles.modalBlock}>
                    <Text style={styles.modalBlockHead}>Technical Summary</Text>
                    <Text style={styles.modalText}>{activeBrief.aiSummary?.technical || "Technical summary unavailable."}</Text>
                  </View>

                  <View style={styles.modalBlock}>
                    <Text style={styles.modalBlockHead}>CVE Intelligence</Text>
                    {(!Array.isArray(activeBrief.cves) || !activeBrief.cves.length) && (
                      <Text style={styles.modalText}>No CVE mentioned in this article.</Text>
                    )}
                    {!!Array.isArray(activeBrief.cves) && !!activeBrief.cves.length && briefCvesLoading && (
                      <View style={{ marginTop: 6 }}>
                        <ActivityIndicator color="#93c5fd" />
                        <Text style={styles.modalText}>Loading CVE details...</Text>
                      </View>
                    )}
                    {!!Array.isArray(activeBrief.cves) && !!activeBrief.cves.length && !briefCvesLoading && briefCves.length === 0 && (
                      <Text style={styles.modalText}>CVE IDs found, but details could not be loaded right now.</Text>
                    )}

                    {briefCves.map((cve) => (
                      <View key={cve.cveId} style={styles.cveItem}>
                        <View style={styles.cveHead}>
                          <Text style={styles.cveId}>{cve.cveId}</Text>
                          <Text style={styles.cveSeverity}>
                            {cve.severity}
                            {cve.cvssScore != null ? ` | CVSS ${cve.cvssScore}` : ""}
                          </Text>
                        </View>
                        <Text style={styles.cveDesc}>{cve.description}</Text>
                        <View style={styles.cveMeta}>
                          <Text style={styles.cveMetaText}>
                            {cve.publishedAt ? new Date(cve.publishedAt).toLocaleDateString() : "date n/a"}
                          </Text>
                          {!!cve.reference && <Text style={styles.cveMetaText}>ref available</Text>}
                        </View>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.openArticleBtn}
                    onPress={() => {
                      if (activeBrief?.url) Linking.openURL(activeBrief.url);
                    }}
                  >
                    <Text style={styles.openArticleBtnText}>Open Full Article</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050a13" },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  heading: { color: "#e5edff", fontSize: 22, fontWeight: "700" },
  refreshBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  refreshTxt: { color: "white", fontWeight: "700" },
  status: { color: "#94a3b8", paddingHorizontal: 14, paddingBottom: 6 },
  error: { color: "#fecaca" },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  card: {
    backgroundColor: "#0d1728",
    borderColor: "#1f3353",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  severity: { fontSize: 12, fontWeight: "700" },
  source: { color: "#8ea5c8", fontSize: 12 },
  title: { color: "#e5edff", fontWeight: "700", fontSize: 15, lineHeight: 20 },
  summary: { color: "#b7c7e2", marginTop: 8, lineHeight: 20 },
  footer: { marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  footerText: { color: "#8ea5c8", fontSize: 12 },
  cardActions: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },
  saveBtn: { backgroundColor: "#0b3b7a", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  saveBtnActive: { backgroundColor: "#2563eb" },
  saveBtnText: { color: "white", fontWeight: "700", fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 14 },
  modalCard: { backgroundColor: "#07111f", borderRadius: 14, borderWidth: 1, borderColor: "#1f3353", padding: 14 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { color: "#e5edff", fontSize: 18, fontWeight: "800" },
  closeBtn: { backgroundColor: "#12233f", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  closeBtnText: { color: "#e5edff", fontWeight: "700" },
  modalHeadline: { color: "#e5edff", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  modalMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  modalMeta: { color: "#93c5fd", fontSize: 12, fontWeight: "700", marginRight: 10 },
  modalBlock: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#1f3353" },
  modalBlockHead: { color: "#e5edff", fontSize: 13, fontWeight: "900", marginBottom: 6 },
  modalText: { color: "#b7c7e2", fontSize: 13, lineHeight: 18 },

  cveItem: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: "#0d1728", borderWidth: 1, borderColor: "#1f3353" },
  cveHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cveId: { color: "#e5edff", fontWeight: "900", fontSize: 13 },
  cveSeverity: { color: "#93c5fd", fontSize: 12, fontWeight: "700", flex: 1, marginLeft: 10 },
  cveDesc: { color: "#b7c7e2", fontSize: 13, marginTop: 6, lineHeight: 18 },
  cveMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  cveMetaText: { color: "#8ea5c8", fontSize: 12 },

  openArticleBtn: { marginTop: 16, backgroundColor: "#2563eb", borderRadius: 12, padding: 12, alignItems: "center" },
  openArticleBtnText: { color: "white", fontWeight: "800" }
});
