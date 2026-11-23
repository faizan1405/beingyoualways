// Real customer media already published by the brand on beingyoualways.com (migrated as-is).
// No quotes or result claims are attached — only what the original site showed.
import story1 from "@/assets/testimonials/story-1.webp";
import story2 from "@/assets/testimonials/story-2.webp";
import story3 from "@/assets/testimonials/story-3.webp";
import v1 from "@/assets/videos/customer-video-1.mp4";
import v2 from "@/assets/videos/customer-video-2.mp4";
import v3 from "@/assets/videos/customer-video-3.mp4";
import v4 from "@/assets/videos/customer-video-4.mp4";
import v5 from "@/assets/videos/customer-video-5.mp4";
import v6 from "@/assets/videos/customer-video-6.mp4";
import v7 from "@/assets/videos/customer-video-7.mp4";
import v8 from "@/assets/videos/customer-video-8.mp4";
import v9 from "@/assets/videos/customer-video-9.mp4";
import v10 from "@/assets/videos/customer-video-10.mp4";
import p1 from "@/assets/videos/customer-video-1-poster.webp";
import p2 from "@/assets/videos/customer-video-2-poster.webp";
import p3 from "@/assets/videos/customer-video-3-poster.webp";
import p4 from "@/assets/videos/customer-video-4-poster.webp";
import p5 from "@/assets/videos/customer-video-5-poster.webp";
import p6 from "@/assets/videos/customer-video-6-poster.webp";
import p7 from "@/assets/videos/customer-video-7-poster.webp";
import p8 from "@/assets/videos/customer-video-8-poster.webp";
import p9 from "@/assets/videos/customer-video-9-poster.webp";
import p10 from "@/assets/videos/customer-video-10-poster.webp";

export const MEDIA_SOURCE = "Published on beingyoualways.com";

export interface PhotoStory {
  id: string;
  city: string;
  photos: { src: string; label: string; alt: string }[];
  source: string;
  consent: boolean; // brand already published it publicly
  published: boolean;
}

export interface VideoReview {
  id: string;
  title: string;
  src: string;
  poster: string;
  source: string;
  consent: boolean;
  published: boolean;
}

export const seedPhotoStories: PhotoStory[] = [
  {
    id: "navsari-journey",
    city: "Navsari",
    photos: [
      { src: story1, label: "Then", alt: "Customer from Navsari smiling while holding a rose" },
      { src: story2, label: "Along the way", alt: "The same customer laughing, in a striped top" },
      { src: story3, label: "Now", alt: "The same customer smiling in a close-up portrait" },
    ],
    source: MEDIA_SOURCE,
    consent: true,
    published: true,
  },
];

const vids: [string, string, string][] = [
  ["Customer review", v10, p10], ["Body scrub review", v1, p1], ["Customer review", v7, p7],
  ["Customer review", v9, p9], ["Customer review", v8, p8], ["Customer review", v2, p2],
  ["Customer review", v3, p3], ["Customer review", v4, p4], ["Customer review", v5, p5],
  ["Customer review", v6, p6],
];

export const seedVideoReviews: VideoReview[] = vids.map(([title, v, p], i) => ({
  id: `video-${i + 1}`, title, src: v, poster: p, source: MEDIA_SOURCE, consent: true, published: true,
}));
