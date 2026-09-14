import { describe, expect, it } from "vitest";
import { paginate } from "../src/domain/pagination.js";

describe("pagination", () => {
  it("slices every item exactly once across pages", () => {
    const values = Array.from({ length: 19 }, (_, index) => index + 1);
    expect([1, 2, 3].flatMap((page) => paginate(values, page, 8).items)).toEqual(values);
    expect(paginate(values, 3, 8)).toMatchObject({ page: 3, total: 19, totalPages: 3, items: [17, 18, 19] });
  });

  it("clamps stale pages after a filtered list shrinks", () => {
    expect(paginate(["only"], 4, 8)).toMatchObject({ page: 1, items: ["only"] });
    expect(() => paginate([], 1, 0)).toThrow("positive integer");
  });
});
