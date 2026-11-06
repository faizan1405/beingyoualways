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

import { chapterProgress, momentAt, transformAt } from "../concerns/ConcernStory";

describe("concern chapter (sticky)", () => {
  it("holds Before for the first 25%", () => expect(transformAt(0.25)).toBe(0));
  it("is fully After by 85% and held to the end", () => {
    expect(transformAt(0.85)).toBe(1);
    expect(transformAt(chapterProgress(-1700, 2080, 800))).toBe(1);
  });
  it("moves through four moments and reverses", () => {
    expect([0.1, 0.3, 0.6, 0.9].map(momentAt)).toEqual([0, 1, 2, 3]);
    expect(momentAt(chapterProgress(0, 2080, 800))).toBe(0);
  });
});
