import { useEffect, useState } from "react";
import type { DesktopSnapshot } from "../../../contracts.js";
import type { ToastMessage } from "../components/feedback.js";
import { errorMessage } from "../utils/presentation.js";

const emptySnapshot: DesktopSnapshot = {
  projects: [],
  tasks: [],
  archivedTasks: [],
  roles: [],
  providers: [],
  runs: [],
  archivedRuns: [],
  approvals: [],
  notifications: [],
};

export function useDesktopState() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  async function refresh(announce = false) {
    setLoading(true);
    try {
      setSnapshot(await window.awenes.snapshot());
      setError("");
      if (announce)
        setToast({ message: "Everything is up to date", tone: "success" });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => window.awenes.onActivity(setPendingOperations), []);
  useEffect(() => window.awenes.onFeedback(setToast), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3_200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 6_000);
    return () => window.clearTimeout(timer);
  }, [error]);
  useEffect(() => {
    void refresh();
  }, []);

  const workflowActive = snapshot.runs.some(
    (run) => run.status === "running" && run.stepStatus === "running",
  );
  useEffect(() => {
    if (!workflowActive) return;
    const timer = window.setInterval(async () => {
      try {
        setSnapshot(await window.awenes.snapshot());
      } catch (cause) {
        setError(errorMessage(cause));
      }
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [workflowActive]);

  useEffect(() => {
    const rejected = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      setError(errorMessage(event.reason));
    };
    window.addEventListener("unhandledrejection", rejected);
    return () => window.removeEventListener("unhandledrejection", rejected);
  }, []);

  return {
    snapshot,
    loading,
    pendingOperations,
    error,
    toast,
    dismissToast: () => setToast(null),
    dismissError: () => setError(""),
    refresh,
  };
}
