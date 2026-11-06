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

import { sectionProgress } from "./ScrollStory";
import { concernProgress, momentAt } from "../concerns/ConcernStory";

describe("horizontal story progress", () => {
  it("is 0 before the section is reached and 1 after it has passed", () => {
    expect(sectionProgress(800, 900, 800)).toBe(0);
    expect(sectionProgress(-900, 900, 800)).toBe(1);
  });
});

describe("concern transformation", () => {
  it("starts at Before and ends at After", () => {
    expect(concernProgress(800, 1000, 800)).toBe(0);
    expect(concernProgress(-500, 1000, 800)).toBe(1);
    expect(momentAt(0)).toBe(0);
    expect(momentAt(0.5)).toBe(1);
    expect(momentAt(1)).toBe(2);
  });
});
