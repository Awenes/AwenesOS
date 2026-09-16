import type { View } from "../utils/presentation";
import type { ReactNode } from "react";

export function NavigationIcon({ view }: { view: View }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<View, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    projects: <><path d="M3 7h7l2 2h9v11H3z"/><path d="M3 7V4h7l2 3"/></>,
    tasks: <><rect x="4" y="4" width="16" height="17" rx="2"/><path d="m8 12 2 2 4-4M8 18h8"/></>,
    runs: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></>,
    approvals: <><path d="M12 2 3 6v6c0 5 3.5 8 9 10 5.5-2 9-5 9-10V6z"/><path d="m8 12 3 3 5-6"/></>,
    agents: <><rect x="5" y="6" width="14" height="13" rx="3"/><path d="M12 3v3M9 11h.01M15 11h.01M9 15h6"/></>,
    providers: <><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m9 11 6-4M9 13l6 4"/></>,
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/></>,
    safety: <><path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6z"/><path d="M9 12h6M12 9v6"/></>,
  };
  return <svg {...common} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">{paths[view]}</svg>;
}
