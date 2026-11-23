import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleDashed, KeyRound, Server, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Pill } from "@/components/shop/OrderBadges";
import { Button } from "@/components/ui/button";
import { META_WHATSAPP, WHATSAPP_SERVER_ENV } from "@/config/whatsapp";
import { useDemoStore } from "@/hooks/use-demo-store";
import { KNOWN_META_ERRORS, OTP_POLICY, REQUIRED_TEMPLATES, toWhatsAppDigits } from "@/lib/whatsapp-cloud";
import { API_ENDPOINTS, BackendNotConnectedError, HOSTINGER_API_BASE_URL } from "@/services/api";
import { INTEGRATION_CHECKS, offlineStatus, whatsappCloudService, type CheckResult, type WhatsAppStatus } from "@/services/whatsappCloudService";
import { abandonedStore, campaignStore, chatbotStore } from "@/services/whatsappService";

export const Route = createFileRoute("/admin/whatsapp-api")({ component: WhatsAppConnection });

const STATE_LABEL: Record<WhatsAppStatus["state"], string> = {
  "backend-missing": "Not connected — Hostinger server not available yet",
  "not-validated": "Server found — token and permissions not validated yet",
  "token-invalid": "Token rejected by Meta",
  connected: "Connected (validated by the server)",
};

const WEBHOOK_FIELDS = [
  { field: "messages", why: "Customer messages (chatbot) and sent / delivered / read / failed statuses" },
  { field: "message_template_status_update", why: "Template approved, rejected or paused" },
  { field: "account_update", why: "Account restricted, banned or disconnected" },
  { field: "phone_number_quality_update", why: "Quality rating and messaging-limit changes" },
];

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;

function WhatsAppConnection() {
  const [status, setStatus] = useState<WhatsAppStatus>(offlineStatus);
  useEffect(() => { void whatsappCloudService.status().then(setStatus).catch((e: Error) => setStatus({ ...offlineStatus(), error: e.message })); }, []);
  const campaigns = useDemoStore(campaignStore);
  const cart = useDemoStore(abandonedStore);
  const bot = useDemoStore(chatbotStore);
  const [recipient, setRecipient] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [results, setResults] = useState<Partial<Record<string, CheckResult>>>({});
  const connected = status.state === "connected";
  const webhookUrl = `${HOSTINGER_API_BASE_URL ?? "https://<your-hostinger-api-domain>"}${API_ENDPOINTS.waWebhook}`;

  const runTests = async (e: FormEvent) => {
    e.preventDefault();
    const to = toWhatsAppDigits(recipient);
    if (!to) { toast.error("Enter one real 10-digit mobile number that has agreed to receive the test."); return; }
    if (!authorized) { toast.error("Confirm the number's owner has agreed to receive test messages."); return; }
    try {
      for (const c of INTEGRATION_CHECKS) {
        const r = await whatsappCloudService.runCheck(c.key, to);
        setResults((x) => ({ ...x, [c.key]: r }));
      }
    } catch (err) {
      toast.error(err instanceof BackendNotConnectedError ? "Tests can't run yet: the Hostinger server isn't connected, so nothing was sent." : (err as Error).message);
    }
  };

  const automations = [
    { name: "WhatsApp OTP sign-in", template: "login_otp", detail: `Code expires in ${OTP_POLICY.expirySeconds / 60} min · ${OTP_POLICY.maxSendsPerHour} codes/hour · ${OTP_POLICY.maxAttempts} attempts`, on: true, link: null },
    { name: "Order updates", template: "order_confirmation, order_processing, order_shipped, order_delivered, order_cancelled", detail: "Sent when an order's status changes", on: true, link: "/admin/orders" as const },
    { name: "Abandoned cart reminder", template: "abandoned_cart_reminder", detail: cart.settings.enabled ? `${cart.settings.delayHours} h after a cart is left, consent required, once per cart` : "Switched off", on: cart.settings.enabled, link: "/admin/abandoned-cart" as const },
    { name: "Marketing campaigns", template: "new_launch, restock, winback", detail: `${campaigns.length} draft${campaigns.length === 1 ? "" : "s"} · only sent when an admin schedules them`, on: false, link: "/admin/whatsapp" as const },
    { name: "Chatbot", template: "— (replies inside the 24-hour window)", detail: `${bot.menus.filter((m) => m.enabled).length} menu(s) · human handoff ${bot.handoff ? "on" : "off"}`, on: bot.menus.some((m) => m.enabled), link: "/admin/chatbot" as const },
  ];

  return (
    <AdminPage title="WhatsApp Connection" actions={<NotConnected label={connected ? "Connected" : "WhatsApp API not connected"} />}
      subtitle="Official Meta WhatsApp Business Cloud API. Everything is sent from the Hostinger server — this page only shows what that server reports. Nothing here is simulated as a real result.">
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Connection status" className="xl:col-span-2">
          <div className="flex items-start gap-3 rounded-lg bg-destructive/5 p-4">
            {connected ? <CheckCircle2 className="mt-0.5 size-5 text-primary" /> : <XCircle className="mt-0.5 size-5 text-destructive" />}
            <div>
              <p className="font-semibold">{STATE_LABEL[status.state]}</p>
              {status.error && <p className="mt-1 text-sm text-muted-foreground">{status.error}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Marked connected only after the server makes a successful authenticated request to Meta. Last checked: {status.checkedAt ? new Date(status.checkedAt).toLocaleString("en-IN") : "never"}.</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
            <div>
              <Row k="Facebook App ID" v={META_WHATSAPP.appId} />
              <Row k="WhatsApp Business Account ID" v={META_WHATSAPP.businessAccountId} />
              <Row k="Phone Number ID" v={META_WHATSAPP.phoneNumberId} />
              <Row k="Graph API version" v={META_WHATSAPP.graphApiVersion} />
            </div>
            <div>
              <Row k="Business number" v={status.displayPhoneNumber ?? <span className="text-muted-foreground">Not read from Meta yet</span>} />
              <Row k="Display name" v={status.verifiedName ?? <span className="text-muted-foreground">—</span>} />
              <Row k="Quality rating" v={status.qualityRating ?? <span className="text-muted-foreground">—</span>} />
              <Row k="Daily messaging limit" v={status.messagingLimit ?? <span className="text-muted-foreground">Unknown</span>} />
            </div>
          </dl>
        </Panel>
        <Panel title="Access token">
          <div className="flex gap-3 text-sm"><KeyRound className="mt-0.5 size-5 shrink-0 text-primary" /><p>The owner supplies the token directly to the Hostinger server. It is <strong>never</strong> typed into, stored in or sent through this website.</p></div>
          <dl className="mt-4">
            <Row k="Token validated" v={connected ? "Yes" : <span className="text-destructive">Not yet</span>} />
            <Row k="whatsapp_business_messaging" v={status.permissions.includes("whatsapp_business_messaging") ? "Granted" : "Not checked"} />
            <Row k="whatsapp_business_management" v={status.permissions.includes("whatsapp_business_management") ? "Granted" : "Not checked"} />
          </dl>
        </Panel>
      </div>

      <Panel title="Automation status">
        <Table head={["Automation", "Template(s)", "Rule", "Live?"]}>
          {automations.map((a) => (
            <tr key={a.name}>
              <Td className="font-semibold">{a.link ? <Link to={a.link} className="hover:underline">{a.name}</Link> : a.name}</Td>
              <Td className="text-xs text-muted-foreground">{a.template}</Td>
              <Td className="text-xs">{a.detail}</Td>
              <Td><Pill t="warn">{connected ? (a.on ? "ready" : "off") : "waiting for server"}</Pill></Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Messages sent & failed">
          <div className="grid grid-cols-4 gap-2 text-center">
            {["Sent", "Delivered", "Read", "Failed"].map((l) => <div key={l} className="rounded-lg bg-secondary/60 p-3"><p className="text-2xl font-semibold text-muted-foreground">—</p><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</p></div>)}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">No messages have been sent. Ticks for delivered and read appear here only when Meta reports them to the server's webhook.</p>
        </Panel>
        <Panel title="API errors">
          <p className="text-sm text-muted-foreground">No errors recorded — Meta hasn't been contacted yet. Errors the server receives will show here with a plain-English reason.</p>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-primary">Common errors and what they mean</summary>
            <ul className="mt-2 space-y-1 text-xs">{KNOWN_META_ERRORS.map((e) => <li key={e.code}><span className="font-mono font-semibold">{e.code}</span> — {e.meaning}</li>)}</ul>
          </details>
        </Panel>
      </div>

      <Panel title={`Message templates (${REQUIRED_TEMPLATES.length} needed)`}>
        <p className="mb-3 text-sm text-muted-foreground">Create these in WhatsApp Manager with exactly these names. Approval status will be read from Meta by the server; until then each one counts as not approved and can't be sent.</p>
        <Table head={["Name", "Category", "Used for", "Suggested text", "Meta status"]}>
          {REQUIRED_TEMPLATES.map((t) => (
            <tr key={t.name}>
              <Td className="font-mono text-xs font-semibold">{t.name}</Td>
              <Td className="text-xs">{t.category}</Td>
              <Td className="text-xs">{t.purpose}</Td>
              <Td className="max-w-md text-xs text-muted-foreground">{t.body}</Td>
              <Td><Pill t="muted">not checked</Pill></Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Webhook settings for Meta">
          <p className="text-sm text-muted-foreground">In the Meta app → WhatsApp → Configuration → Webhook:</p>
          <dl className="mt-3">
            <Row k="Callback URL" v={<span className="break-all font-mono text-xs">{webhookUrl}</span>} />
            <Row k="Verify token" v="Same value as WHATSAPP_VERIFY_TOKEN on the server" />
            <Row k="Signature check" v="X-Hub-Signature-256 with the app secret" />
          </dl>
          <p className={`${adminLabel} mt-4`}>Subscribe to these fields</p>
          <ul className="space-y-1 text-sm">{WEBHOOK_FIELDS.map((f) => <li key={f.field}><span className="font-mono text-xs font-semibold">{f.field}</span> — <span className="text-muted-foreground">{f.why}</span></li>)}</ul>
        </Panel>
        <Panel title="Server settings (Hostinger)">
          <div className="mb-3 flex gap-3 text-sm"><Server className="mt-0.5 size-5 shrink-0 text-primary" /><p>Secret values go only into the server's environment settings. Names to use:</p></div>
          <ul className="space-y-2 text-sm">{WHATSAPP_SERVER_ENV.map((e) => <li key={e.name}><span className="font-mono text-xs font-semibold">{e.name}</span><br /><span className="text-xs text-muted-foreground">{e.note}</span></li>)}</ul>
        </Panel>
      </div>

      <Panel title="Integration tests">
        <form onSubmit={runTests} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end" noValidate>
          <div>
            <label htmlFor="tr" className={adminLabel}>Authorized test number (one only)</label>
            <div className="flex"><span className="grid h-10 place-items-center rounded-l-md border border-r-0 border-input bg-secondary px-3 text-sm">+91</span><input id="tr" type="tel" inputMode="numeric" maxLength={10} className={`${adminInput} rounded-l-none`} value={recipient} onChange={(e) => setRecipient(e.target.value)} /></div>
            <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} /> The owner of this number has agreed to receive test messages.</label>
          </div>
          <Button type="submit" variant="lux" size="xl"><ShieldCheck /> Run tests</Button>
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">Sends at most one test message to this number. Never runs bulk sends or campaigns. The number isn't saved.</p>
        <ul className="mt-4 divide-y divide-border text-sm">
          {INTEGRATION_CHECKS.map((c) => {
            const r = results[c.key];
            return (
              <li key={c.key} className="flex items-start justify-between gap-4 py-2">
                <span className="flex items-start gap-2">{r ? (r.passed ? <CheckCircle2 className="mt-0.5 size-4 text-primary" /> : <XCircle className="mt-0.5 size-4 text-destructive" />) : <CircleDashed className="mt-0.5 size-4 text-muted-foreground" />}{c.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r ? r.detail : "Not run"}</span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Server endpoints still needed">
        <Table head={["Endpoint", "Purpose"]}>
          {([["otpRequest", "Create + send sign-in code (login_otp)"], ["otpVerify", "Check code, set secure session"], ["waStatus", "Token, permissions, number, limit"], ["waTemplates", "Templates and approval status"], ["waMessages", "Sent / failed messages with statuses"], ["waErrors", "Recent Meta errors"], ["waTest", "Integration checks (one number)"], ["waOrderNotify", "Order status message"], ["waCampaignSchedule", "Schedule a campaign (admin action)"], ["waOptOut", "Consent and STOP opt-outs"], ["waWebhook", "Meta webhook (verify + events)"]] as const).map(([k, why]) => (
            <tr key={k}><Td className="font-mono text-xs">{API_ENDPOINTS[k]}</Td><Td className="text-xs">{why}</Td></tr>
          ))}
        </Table>
        <p className="mt-3 text-[11px] text-muted-foreground">None of these exist yet. Full details for the developer: docs/whatsapp-hostinger-backend.md in the project.</p>
      </Panel>
    </AdminPage>
  );
}
