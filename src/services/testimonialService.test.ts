import { describe, expect, it } from "vitest";
import { testimonialService } from "./testimonialService";

const base = { id: "t1", category: "Skin" as const, name: "A", city: "B", quote: "Q", verified: true, consent: true, published: true };

describe("testimonials", () => {
  it("hides a review that is not verified", () => {
    testimonialService.save({ ...base, id: "x1", verified: false });
    expect(testimonialService.publicList().some((t) => t.id === "x1")).toBe(false);
  });
  it("hides a review without customer consent", () => {
    testimonialService.save({ ...base, id: "x2", consent: false });
    expect(testimonialService.publicList().some((t) => t.id === "x2")).toBe(false);
  });
  it("shows a verified, consented, published review", () => {
    testimonialService.save({ ...base, id: "x3" });
    expect(testimonialService.publicList().some((t) => t.id === "x3")).toBe(true);
  });
});

import { customerMediaService, isPublicMedia } from "./testimonialService";

describe("customer media", () => {
  it("ships the Navsari photo story and 10 customer videos as public", () => {
    expect(customerMediaService.photoStories().filter(isPublicMedia).map((s) => s.city)).toEqual(["Navsari"]);
    expect(customerMediaService.videoReviews().filter(isPublicMedia)).toHaveLength(10);
  });
  it("hides a video once it is unpublished", () => {
    customerMediaService.setVideoPublished("video-1", false);
    expect(customerMediaService.videoReviews().filter(isPublicMedia).some((v) => v.id === "video-1")).toBe(false);
    customerMediaService.setVideoPublished("video-1", true);
  });
});
