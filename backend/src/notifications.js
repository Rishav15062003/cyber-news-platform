const subscribers = new Set();

export function subscribeAlerts(res) {
  subscribers.add(res);
  res.on("close", () => subscribers.delete(res));
}

export function notifyCriticalAlerts(items) {
  const criticalItems = items.filter((item) => item.severity === "critical").slice(0, 10);
  if (!criticalItems.length) return;
  const payload = JSON.stringify({
    type: "critical_alerts",
    ts: new Date().toISOString(),
    items: criticalItems
  });

  subscribers.forEach((res) => {
    res.write(`event: critical\n`);
    res.write(`data: ${payload}\n\n`);
  });
}

export function notifyDigest(payloadObject) {
  const payload = JSON.stringify(payloadObject);
  subscribers.forEach((res) => {
    res.write(`event: digest\n`);
    res.write(`data: ${payload}\n\n`);
  });
}
