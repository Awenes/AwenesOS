import type { ReactNode } from "react";

export type StatusIconState = "ready" | "attention" | "optional" | "empty";

export function StatusIcon({ state, className }: { state: StatusIconState; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<StatusIconState, ReactNode> = {
    ready: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    attention: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v6M12 16.5h.01" /></>,
    optional: <><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></>,
    empty: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h5" /></>,
  };
  return (
    <svg
      {...common}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths[state]}
    </svg>
  );
}
