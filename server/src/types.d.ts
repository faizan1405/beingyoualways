import type { AdminContext } from "./services/authService.js";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminContext;
    }
  }
}
export {};
