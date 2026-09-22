import { describe, expect, it } from "vitest";
import { badgeTone } from "../desktop/renderer/src/utils/presentation.js";

describe("badgeTone", () => {
  it("does not classify an unverified state as success just because it contains the word verified", () => {
    expect(badgeTone("Unverified")).toBe("neutral");
  });
  it("classifies an error state as danger", () => {
    expect(badgeTone("Error")).toBe("danger");
  });
  it("still classifies genuinely verified/ready/complete states as success", () => {
    expect(badgeTone("Verified")).toBe("success");
    expect(badgeTone("Ready To Complete")).toBe("success");
    expect(badgeTone("Completed")).toBe("success");
  });
  it("still classifies failure and rejection as danger", () => {
    expect(badgeTone("Failed")).toBe("danger");
    expect(badgeTone("Rejected")).toBe("danger");
  });
  it("still classifies pending/paused/approval states as warning", () => {
    expect(badgeTone("Sync Pending")).toBe("warning");
    expect(badgeTone("Paused")).toBe("warning");
    expect(badgeTone("Awaiting Approval")).toBe("warning");
  });
  it("falls back to neutral for arbitrary non-status text like branch names", () => {
    expect(badgeTone("main")).toBe("neutral");
    expect(badgeTone("Plan")).toBe("neutral");
  });
});
