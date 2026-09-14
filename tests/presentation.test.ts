import { describe, expect, it } from "vitest";
import { folderName, pretty, splitCommaSeparated, splitLines, taskName } from "../desktop/renderer/src/utils/presentation.js";
import type { DesktopSnapshot } from "../desktop/contracts.js";

describe("renderer presentation helpers", () => {
  it("normalizes labels and form lists consistently", () => {
    expect(pretty("awaiting_approval")).toBe("Awaiting Approval");
    expect(splitCommaSeparated("git, node, git")).toEqual(["git", "node", "git"]);
    expect(splitLines("Tests pass\n\n Build succeeds ")).toEqual(["Tests pass", "Build succeeds"]);
    expect(folderName("C:\\work\\customer-portal\\")).toBe("customer-portal");
  });

  it("resolves task names across active and archived collections", () => {
    const data: DesktopSnapshot = {
      projects: [],
      tasks: [],
      archivedTasks: [{ id: "archived", projectId: null, title: "Old task", source: "manual", status: "completed", updatedAt: new Date() }],
      roles: [],
      providers: [],
      runs: [],
      approvals: [],
      notifications: [],
      pendingCrm: 0,
      pendingTracker: 0,
    };
    expect(taskName(data, "archived")).toBe("Old task");
    expect(taskName(data, "missing")).toBe("Unknown task");
  });
});
