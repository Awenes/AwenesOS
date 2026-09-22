import { useEffect, useRef, useState } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import type { WorkflowStage } from "../../../../src/domain/workflow";

export type RunAction =
  | "next"
  | "pause"
  | "resume"
  | "cancel"
  | "archive"
  | "restore"
  | "delete";

/**
 * Owns the run-inspector's state and its async actions. Guards against
 * stale responses when the user selects a different run before a slower
 * `open` call resolves — otherwise a fast double-click could leave Commit,
 * Push, or Cancel pointed at the wrong run.
 */
export function useRunActions(
  data: DesktopSnapshot,
  refresh: () => Promise<void>,
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>,
  reviewTarget: { id: string; request: number } | null,
  onScopeChange: (scope: "active" | "archived") => void,
) {
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [executingStage, setExecutingStage] = useState<WorkflowStage | null>(null);
  const [executionSeconds, setExecutionSeconds] = useState(0);
  const openRequest = useRef(0);

  useEffect(() => {
    if (!executingStage) return;
    setExecutionSeconds(0);
    const timer = window.setInterval(
      () => setExecutionSeconds((value) => value + 1),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [executingStage]);

  async function open(id: string) {
    setSelected(id);
    const request = ++openRequest.current;
    const result = await window.awenes.runDetails(id);
    if (request === openRequest.current) setDetails(result);
  }

  useEffect(() => {
    if (!reviewTarget) return;
    onScopeChange(
      data.archivedRuns.some((run) => run.id === reviewTarget.id)
        ? "archived"
        : "active",
    );
    void open(reviewTarget.id);
    // `open` and `onScopeChange` close over values that change every render;
    // this effect should fire only when a new reviewTarget is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewTarget]);

  async function action(runId: string, action: RunAction) {
    setBusy(true);
    if (action === "next") setExecutingStage(details?.run.currentStage ?? null);
    try {
      await window.awenes.runAction({ runId, action });
      await refresh();
      await open(runId);
    } finally {
      setExecutingStage(null);
      setBusy(false);
    }
  }

  async function remove(runId: string, action: "archive" | "restore" | "delete") {
    if (
      action === "delete" &&
      !(await confirm("Delete this run? Its audit tombstone will be retained.", "Delete"))
    )
      return;
    setBusy(true);
    try {
      await window.awenes.runAction({ runId, action });
      setSelected(null);
      setDetails(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function git(
    runId: string,
    action: "review" | "commit" | "push",
    commitMessage?: string,
  ) {
    setBusy(true);
    try {
      if (action === "review")
        setDetails({
          ...details,
          delivery: await window.awenes.gitReview(runId),
        });
      else if (action === "commit")
        await window.awenes.gitCommit({ runId, message: commitMessage ?? "" });
      else await window.awenes.gitPush(runId);
      await refresh();
      await open(runId);
    } finally {
      setBusy(false);
    }
  }

  async function allowProviderAndResume(runId: string, projectId: string) {
    setBusy(true);
    try {
      const policy = await window.awenes.executionPolicy(projectId);
      const providerCommands = data.providers
        .filter((provider) => provider.status === "ready" && provider.command)
        .map((provider) => provider.command!);
      await window.awenes.saveExecutionPolicy({
        projectId,
        policy: {
          ...policy,
          networkAccess: "public",
          commandAllowlist: [
            ...new Set([...policy.commandAllowlist, ...providerCommands]),
          ],
          environmentAllowlist: [
            ...new Set([
              ...policy.environmentAllowlist,
              "PATH",
              "Path",
              "PATHEXT",
              "SystemRoot",
            ]),
          ],
        },
      });
      await window.awenes.runAction({ runId, action: "resume" });
      await refresh();
      await open(runId);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setSelected(null);
    setDetails(null);
  }

  return {
    selected,
    details,
    busy,
    executingStage,
    executionSeconds,
    open,
    clear,
    action,
    remove,
    git,
    allowProviderAndResume,
  };
}
