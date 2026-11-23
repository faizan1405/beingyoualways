import type { AdminContext } from "./services/authService.js";
import type { CustomerContext } from "./services/customerAuthService.js";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminContext;
      customer?: CustomerContext;
    }
  }
}
export {};
