import { describe, expect, it } from "vitest";
import {
  folderName,
  pretty,
  splitCommaSeparated,
  splitLines,
  taskName,
  viewDescription,
} from "../desktop/renderer/src/utils/presentation.js";
import type { DesktopSnapshot } from "../desktop/contracts.js";

describe("renderer presentation helpers", () => {
  it("provides concise context for command-center views", () => {
    expect(viewDescription("runs")).toContain("agent progress");
    expect(viewDescription("safety")).toContain("network boundaries");
  });

  it("normalizes labels and form lists consistently", () => {
    expect(pretty("awaiting_approval")).toBe("Awaiting Approval");
    expect(splitCommaSeparated("git, node, git")).toEqual([
      "git",
      "node",
      "git",
    ]);
    expect(splitLines("Tests pass\n\n Build succeeds ")).toEqual([
      "Tests pass",
      "Build succeeds",
    ]);
    expect(folderName("C:\\work\\customer-portal\\")).toBe("customer-portal");
  });

  it("resolves task names across active and archived collections", () => {
    const data: DesktopSnapshot = {
      projects: [],
      tasks: [],
      archivedTasks: [
        {
          id: "archived",
          projectId: null,
          title: "Old task",
          source: "manual",
          status: "completed",
          updatedAt: new Date(),
        },
      ],
      roles: [],
      providers: [],
      runs: [],
      archivedRuns: [],
      approvals: [],
      notifications: [],
    };
    expect(taskName(data, "archived")).toBe("Old task");
    expect(taskName(data, "missing")).toBe("Unknown task");
  });
});
