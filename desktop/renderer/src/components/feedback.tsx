export type ToastMessage = { message: string; tone: "success" | "error" };

export function ActivityIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <div className="activity" role="status" aria-live="polite"><span className="spinner" />Working…</div>;
}

export function Toast({ value, dismiss }: { value: ToastMessage | null; dismiss: () => void }) {
  if (!value) return null;
  return <div className={`toast ${value.tone}`} role="status" aria-live="polite"><span>{value.tone === "success" ? "✓" : "!"}</span>{value.message}<button aria-label="Dismiss notification" onClick={dismiss}>×</button></div>;
}
