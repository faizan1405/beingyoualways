// Admin media library, customer stories, website wording and the approvals checklist on the
// Hostinger server. Every change is permission-checked and logged on the server; files are
// stored on the server's own disk with their metadata in MySQL.
import { API_ENDPOINTS, apiRequest, apiUpload, toQuery, withId } from "./api";

export type MediaKind = "PRODUCT_IMAGE" | "GALLERY_SLIDE" | "REVIEW_PHOTO" | "REVIEW_VIDEO" | "POSTER" | "CONTENT_IMAGE";

export interface AdminMedia {
  id: string; kind: MediaKind; url: string; originalName: string; mime: string; bytes: number;
  width: number | null; height: number | null; alt: string | null; status: "ACTIVE" | "ARCHIVED";
  position: number; productId: string | null; reviewId: string | null;
  createdAt: string; updatedAt: string; archivedAt: string | null;
}

export interface ReviewMediaItem { type: "photo" | "video"; url: string; mediaId?: string; role?: "before" | "after" | "poster" }
export type ReviewStatus = "PENDING" | "PUBLISHED" | "HIDDEN";

export interface AdminReview {
  id: string; authorName: string; body: string; rating: number | null; productId: string | null;
  category: string | null; city: string | null; verifiedPurchase: boolean; consentGiven: boolean;
  status: ReviewStatus; placements: ("home" | "explore")[] | null; media: ReviewMediaItem[];
  createdAt: string; updatedAt: string;
}
export type ReviewInput = Omit<AdminReview, "id" | "createdAt" | "updatedAt">;

export interface ApprovalItem { key: string; label: string; confirmed: boolean; detail: string }
export interface ApprovalChecklist { items: ApprovalItem[]; confirmed: number; total: number }

const post = <T,>(path: string, body: unknown, method: "POST" | "PUT" | "PATCH" = "POST") => apiRequest<T>(path, { method, body });

export const adminContent = {
  // ── Media library ──
  listMedia: (f: { productId?: string; reviewId?: string; status?: "ACTIVE" | "ARCHIVED"; kind?: MediaKind } = {}) =>
    apiRequest<{ media: AdminMedia[] }>(API_ENDPOINTS.media + toQuery(f)).then((r) => r.media),
  uploadMedia: (file: File, q: { kind: MediaKind; productId?: string; reviewId?: string; alt?: string; position?: number; attach?: boolean }, onProgress?: (pct: number) => void) =>
    apiUpload<{ media: AdminMedia }>(API_ENDPOINTS.mediaUpload, file, {
      kind: q.kind, productId: q.productId, reviewId: q.reviewId, alt: q.alt,
      position: q.position, attach: q.attach ? "true" : undefined,
    }, onProgress).then((r) => r.media),
  updateMedia: (id: string, b: { alt?: string; position?: number }) =>
    post<{ media: AdminMedia }>(withId(API_ENDPOINTS.mediaItem, id), b, "PATCH").then((r) => r.media),
  archiveMedia: (id: string) =>
    post<{ media: AdminMedia }>(`${withId(API_ENDPOINTS.mediaItem, id)}/delete`, {}).then((r) => r.media),
  purgeMedia: (id: string) => post<{ purged: boolean }>(`${withId(API_ENDPOINTS.mediaItem, id)}/purge`, {}),

  // ── Customer stories ──
  listReviews: (f: { status?: ReviewStatus; productId?: string } = {}) =>
    apiRequest<{ reviews: AdminReview[] }>(API_ENDPOINTS.reviews + toQuery(f)).then((r) => r.reviews),
  createReview: (r: ReviewInput) => post<{ review: AdminReview }>(API_ENDPOINTS.reviews, r).then((x) => x.review),
  updateReview: (id: string, r: Partial<ReviewInput>) => post<{ review: AdminReview }>(withId(API_ENDPOINTS.reviewItem, id), r, "PATCH").then((x) => x.review),
  deleteReview: (id: string) => post<{ deleted: boolean }>(`${withId(API_ENDPOINTS.reviewItem, id)}/delete`, {}),

  // ── Website wording ──
  readContent: () => apiRequest<{ content: Record<string, unknown> }>(API_ENDPOINTS.content).then((r) => r.content),
  saveContent: (items: Record<string, unknown>) => post<{ saved: number }>(API_ENDPOINTS.content, { items }, "PUT"),
  removeContent: (key: string) => post<{ removed: string }>(`${withId(API_ENDPOINTS.contentKey, key)}/delete`, {}),

  // ── Pre-launch checklist ──
  approvals: () => apiRequest<ApprovalChecklist>(API_ENDPOINTS.approvals),
};

/** The one content key the storefront wording lives under (merged over the built-in copy). */
export const SITE_CONTENT_KEY = "site.content";
/** Set to true when the owner has read the wording through — feeds the approvals checklist. */
export const CONTENT_REVIEWED_KEY = "content.reviewed";
