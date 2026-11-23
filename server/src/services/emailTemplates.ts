/**
 * Account emails the store sends. Each template returns plain text (always) and a simple, escaped HTML
 * version. Wording stays factual: no offers, no promotions — these are account messages only.
 */
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const BRAND = "Being You – Always";
const GREEN = "#263B31";
const CHARCOAL = "#252722";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const greeting = (name: string | null | undefined) => {
  const n = (name ?? "").trim();
  return n ? `Hi ${n},` : "Hi,";
};

interface Layout {
  name: string | null | undefined;
  paragraphs: string[];
  button?: { label: string; url: string };
  footer: string;
}

function render(subject: string, l: Layout): EmailContent {
  const lines = [greeting(l.name), "", ...l.paragraphs.flatMap((p) => [p, ""])];
  if (l.button) lines.push(l.button.url, "");
  lines.push(l.footer, "", `— ${BRAND}`);

  const p = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${CHARCOAL}">${escapeHtml(t)}</p>`;
  const button = l.button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(l.button.url)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:15px">${escapeHtml(l.button.label)}</a></p>` +
      `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#6b6f68">If the button doesn't work, copy this link into your browser:<br>${escapeHtml(l.button.url)}</p>`
    : "";
  const html =
    `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px 24px">` +
    `<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;color:${GREEN}">${escapeHtml(BRAND)}</p>` +
    p(greeting(l.name)) +
    l.paragraphs.map(p).join("") +
    button +
    `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b6f68">${escapeHtml(l.footer)}</p>` +
    `</div></body></html>`;
  return { subject, text: lines.join("\n"), html };
}

export function verifyEmailTemplate(input: { name?: string | null; link: string; hours: number }): EmailContent {
  return render(`Confirm your email — ${BRAND}`, {
    name: input.name,
    paragraphs: ["Confirm this email address to finish setting up your account."],
    button: { label: "Confirm my email", url: input.link },
    footer: `The link works for ${input.hours} hours. If you didn't create an account, you can ignore this email.`,
  });
}

export function passwordResetTemplate(input: { name?: string | null; link: string; minutes: number }): EmailContent {
  return render(`Reset your password — ${BRAND}`, {
    name: input.name,
    paragraphs: ["Use the button below to choose a new password for your account."],
    button: { label: "Choose a new password", url: input.link },
    footer: `The link works once and expires in ${input.minutes} minutes. If you didn't ask for this, nothing needs doing — your password stays the same.`,
  });
}

export function passwordChangedTemplate(input: { name?: string | null; signInUrl: string; how: "changed" | "reset" }): EmailContent {
  return render(`Your password was ${input.how} — ${BRAND}`, {
    name: input.name,
    paragraphs: [
      input.how === "reset"
        ? "Your account password was just reset, and every device that was signed in has been signed out."
        : "Your account password was just changed. Other devices that were signed in have been signed out.",
      "If this was you, there's nothing else to do.",
    ],
    footer: `If this wasn't you, reset your password straight away from ${input.signInUrl} and contact the store.`,
  });
}

export function accountDeletedTemplate(input: { name?: string | null }): EmailContent {
  return render(`Your account was deleted — ${BRAND}`, {
    name: input.name,
    paragraphs: [
      "Your account has been deleted and you have been signed out everywhere. Your name, email, phone number and saved addresses are no longer linked to it.",
      "Records of orders you placed are kept, because the store must keep its own sales records.",
    ],
    footer: "If you didn't ask for this, please contact the store.",
  });
}
