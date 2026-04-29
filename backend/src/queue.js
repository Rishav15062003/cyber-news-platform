let fallbackQueue = Promise.resolve();

export async function enqueueRefresh(taskFn) {
  // Graceful fallback queue: serializes refresh jobs even without Redis/BullMQ.
  fallbackQueue = fallbackQueue.then(taskFn).catch(() => undefined);
  return fallbackQueue;
}
