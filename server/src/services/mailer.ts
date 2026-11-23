import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import nodemailer from "nodemailer";

import type { Config } from "../config.js";
import type { Logger } from "../logger.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  /** true only when the message was handed to the mail server. */
  delivered: boolean;
  transport: "smtp" | "outbox";
  /** mail server receipt, or the outbox file the message was written to */
  detail: string;
}

/**
 * Transactional email. When SMTP is configured the message is handed to that server; otherwise it is
 * written to `<MEDIA_ROOT>/outbox` so the text is real and inspectable — a link is never reported as
 * sent when nothing was sent.
 */
/** true when `to` is listed exactly or its domain is listed as "@domain". */
export function mailAllowed(allow: string[], to: string): boolean {
  const addr = to.trim().toLowerCase();
  const at = addr.lastIndexOf("@");
  if (at < 1) return false;
  return allow.includes(addr) || allow.includes(addr.slice(at));
}

export function createMailer(config: Config, logger: Logger) {
  const transporter = config.mail
    ? nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.port === 465,
        auth: { user: config.mail.user, pass: config.mail.password },
      })
    : null;

  async function toOutbox(msg: MailMessage, note?: string): Promise<MailResult> {
    const dir = join(config.media.root, "outbox");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${Date.now()}-${msg.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.txt`);
    await writeFile(file, `To: ${msg.to}\nSubject: ${msg.subject}\n${note ? `Held: ${note}\n` : ""}\n${msg.text}\n`, "utf8");
    return { delivered: false, transport: "outbox", detail: file };
  }

  async function send(msg: MailMessage): Promise<MailResult> {
    // Staging never emails real customers: only the listed test inboxes get SMTP mail, the rest stays in the outbox.
    if (transporter && config.deployment === "staging" && !mailAllowed(config.mailAllowList, msg.to)) {
      return toOutbox(msg, "staging store — this address isn't in MAIL_ALLOWED_RECIPIENTS, so it was not sent");
    }
    if (transporter && config.mail) {
      try {
        const info = await transporter.sendMail({
          from: config.mail.from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          ...(msg.html ? { html: msg.html } : {}),
        });
        return { delivered: true, transport: "smtp", detail: String(info.messageId ?? "accepted") };
      } catch (e) {
        // The address is personal data: log the failure, never the recipient.
        logger.error("mail send failed", { error: e instanceof Error ? e.message : String(e), subject: msg.subject });
        return { delivered: false, transport: "smtp", detail: "the mail server refused the message" };
      }
    }
    return toOutbox(msg);
  }

  return {
    /** false until SMTP is configured — the approvals checklist reads this. */
    configured: Boolean(transporter),
    send,
  };
}

export type Mailer = ReturnType<typeof createMailer>;
