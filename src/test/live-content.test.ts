import { describe, expect, it } from "vitest";

import { defaultContent, mergeSiteContent } from "@/services/contentService";
import { reviewToTestimonial } from "@/services/liveStories";
import type { AdminReview } from "@/services/adminContentService";

describe("mergeSiteContent", () => {
  it("returns the built-in copy when nothing is stored", () => {
    expect(mergeSiteContent(null)).toEqual(defaultContent());
    expect(mergeSiteContent("garbage")).toEqual(defaultContent());
    expect(mergeSiteContent(42)).toEqual(defaultContent());
  });

  it("overrides only the stored parts and keeps the rest", () => {
    const merged = mergeSiteContent({ announcement: { enabled: true, text: "New launches this week" } });
    expect(merged.announcement).toEqual({ enabled: true, text: "New launches this week" });
    expect(merged.faqs).toEqual(defaultContent().faqs);
    expect(merged.contact).toEqual(defaultContent().contact);
  });

  it("drops wrongly-shaped sections instead of breaking the page", () => {
    const merged = mergeSiteContent({ faqs: "not-a-list", sections: "nope", about: { story: "not-a-list" } });
    expect(merged.faqs).toEqual(defaultContent().faqs);
    expect(merged.sections).toEqual(defaultContent().sections);
    expect(merged.about.story).toEqual(defaultContent().about.story);
  });

  it("keeps only well-formed FAQ entries", () => {
    const merged = mergeSiteContent({ faqs: [{ q: "Q?", a: "A." }, { q: 1, a: "bad" }, "junk"] });
    expect(merged.faqs).toEqual([{ q: "Q?", a: "A." }]);
  });
});

const baseReview: AdminReview = {
  id: "r1", authorName: "Meera J.", body: "My skin feels calmer after a month.", rating: 5,
  productId: null, category: "skin", city: "Pune", verifiedPurchase: true, consentGiven: true,
  status: "PUBLISHED", placements: ["home", "explore"], media: [], createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

describe("reviewToTestimonial", () => {
  it("maps a published, consented, verified story to a public testimonial", () => {
    const t = reviewToTestimonial(baseReview);
    expect(t).toMatchObject({ id: "r1", name: "Meera J.", city: "Pune", quote: baseReview.body, rating: 5, category: "Skin", verified: true, consent: true, published: true, type: "text" });
    expect(t.placements).toEqual(["home", "explore"]);
  });

  it("matches categories case-insensitively and falls back to General Experience", () => {
    expect(reviewToTestimonial({ ...baseReview, category: "DE-TAN" }).category).toBe("De-Tan");
    expect(reviewToTestimonial({ ...baseReview, category: "Something else" }).category).toBe("General Experience");
    expect(reviewToTestimonial({ ...baseReview, category: null }).category).toBe("General Experience");
  });

  it("maps video, poster and before/after media into the display fields", () => {
    const t = reviewToTestimonial({
      ...baseReview,
      media: [
        { type: "video", url: "/api/media/v1", mediaId: "v1" },
        { type: "photo", url: "/api/media/p1", mediaId: "p1", role: "poster" },
        { type: "photo", url: "/api/media/b1", mediaId: "b1", role: "before" },
        { type: "photo", url: "/api/media/a1", mediaId: "a1", role: "after" },
      ],
    });
    expect(t.type).toBe("video");
    expect(t.videoUrl).toBe("/api/media/v1");
    expect(t.poster).toBe("/api/media/p1");
    expect(t.beforePhoto).toBe("/api/media/b1");
    expect(t.afterPhoto).toBe("/api/media/a1");
  });

  it("is not public unless the server says PUBLISHED, and defaults to the homepage", () => {
    const pending = reviewToTestimonial({ ...baseReview, status: "PENDING", placements: null });
    expect(pending.published).toBe(false);
    expect(pending.placements).toEqual(["home"]);
  });
});
