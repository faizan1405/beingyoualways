import { describe, expect, it } from "vitest";
import { stageAt, stages } from "./ScrollStory";

describe("scroll story stages", () => {
  it("has four stages in order", () => expect(stages.map((s) => s.k)).toEqual(["Discover", "Care", "Nourish", "Express"]));
  it("starts on Discover and ends on Express", () => {
    expect(stageAt(0).active).toBe(0);
    expect(stageAt(1).active).toBe(3);
  });
  it("reaches Care and Nourish in between, and reverses", () => {
    expect(stageAt(1 / 3).active).toBe(1);
    expect(stageAt(2 / 3).active).toBe(2);
    expect(stageAt(0.05).active).toBe(0);
  });
});
