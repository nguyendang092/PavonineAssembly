import { describe, expect, it } from "vitest";
import { findNeighborNavCell } from "./s90dInputCellNav";

const GRID = [
  { id: "r0c0", col: 6 },
  { id: "r0c1", col: 10 },
  { id: "r0c2", col: 11 },
  { id: "r1c0", col: 6 },
  { id: "r1c1", col: 10 },
  { id: "r1c2", col: 11 },
];

describe("findNeighborNavCell", () => {
  it("moves left and right along document order, including wrapping to the next row", () => {
    expect(findNeighborNavCell(GRID, "r0c2", "right")?.id).toBe("r1c0");
    expect(findNeighborNavCell(GRID, "r1c0", "left")?.id).toBe("r0c2");
    expect(findNeighborNavCell(GRID, "r0c0", "left")).toBeNull();
    expect(findNeighborNavCell(GRID, "r1c2", "right")).toBeNull();
  });

  it("moves up and down within the same column", () => {
    expect(findNeighborNavCell(GRID, "r0c1", "down")?.id).toBe("r1c1");
    expect(findNeighborNavCell(GRID, "r1c1", "up")?.id).toBe("r0c1");
    expect(findNeighborNavCell(GRID, "r0c0", "up")).toBeNull();
    expect(findNeighborNavCell(GRID, "r1c2", "down")).toBeNull();
  });
});
