import { Router, type CookieOptions } from "express";
import { z } from "zod";

import type { Config } from "../config.js";
import { requireAdmin } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/security.js";
import type { AuthService } from "../services/authService.js";

const loginBody = z.object({ email: z.string().trim().max(191), password: z.string().min(1).max(200) });

export function authRoutes(auth: AuthService, config: Config) {
  const r = Router();
  const cookie = (maxAge?: number): CookieOptions => ({
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: "/",
    ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
    ...(maxAge !== undefined ? { maxAge } : {}),
  });

  r.post("/login", loginLimiter(), async (req, res) => {
    const { email, password } = loginBody.parse(req.body);
    const out = await auth.login(email, password, { ip: req.ip, userAgent: req.get("user-agent") });
    res.cookie(config.cookie.name, out.token, cookie(out.expiresAt.getTime() - Date.now()));
    res.setHeader("Cache-Control", "no-store");
    res.json({ user: out.user, expiresAt: out.expiresAt.toISOString() });
  });

  r.post("/logout", async (req, res) => {
    if (req.admin) await auth.logout(req.admin, req.ip);
    res.clearCookie(config.cookie.name, cookie());
    res.json({ ok: true });
  });

  r.get("/me", requireAdmin, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ user: req.admin!.user });
  });
  return r;
}
