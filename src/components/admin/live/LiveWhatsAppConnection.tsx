import { AlertTriangle, CheckCircle2, CircleDashed, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AdminPage, Panel, Table, Td, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { HOSTINGER_API_BASE_URL } from "@/services/api";
import { whatsappLive, type Automations, type CheckResult, type LiveStatus } from "@/services/whatsappLiveService";
import { LiveState, istDateTime, useLive } from "./shared";
import { KIND_TEXT, MessageStatePill } from "./whatsappShared";

const STATE_LABEL: Record<LiveStatus["state"], string> = { connected: "Connected", "token-invalid": "Token expired or revoked", "not-validated": "Not validated yet" };
const CHECKS: { key: string; label: string; sends?: boolean }[] = [
  { key: "auth", label: "Access token works" }, { key: "phone", label: "Phone number belongs to the business account" }, { key: "templates", label: "Templates can be read" },
  { key: "test-message", label: "Send a test message", sends: true }, { key: "webhook-verify", label: "Webhook handshake received" }, { key: "webhook-signature", label: "Webhook signatures are checked" },
  { key: "status", label: "Delivery statuses arrive" }, { key: "errors", label: "Errors are recorded" }, { key: "token-expired", label: "Expired token is detected" }, { key: "duplicates", label: "Duplicate webhooks are ignored" },
];

function Tick({ ok }: { ok: boolean | null }) {
  if (ok === true) return <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Passed" />;
  if (ok === false) return <XCircle className="size-4 shrink-0 text-destructive" aria-label="Failed" />;
  return <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-label="Not checked yet" />;
}

/** WhatsApp Cloud API: real connection status from Meta (via the store server), templates, automations, logs and checks. */
export function LiveWhatsAppConnection() {
  const status = useLive(() => whatsappLive.status(), []);
  const s = status.data;
  const refresh = async () => { try { status.setData(await whatsappLive.status(true)); toast("Checked with Meta just now"); } catch (e) { toast.error(e instanceof Error ? e.message : "Check failed."); } };
  return (
    <AdminPage title="WhatsApp API" subtitle="Everything here is read from Meta by the store server. The access token stays on the server and is never shown."
      actions={<Button variant="outline" onClick={() => void refresh()}><RefreshCw className="size-4" /> Check now</Button>}>
      {!s ? <LiveState error={status.error} loading={status.loading} onRetry={() => void status.reload()} /> : (
        <div className="space-y-6">
          <StatusPanel s={s} />
          <AutomationsPanel />
          <TemplatesPanel />
          <MessagesPanel />
          <div className="grid gap-6 lg:grid-cols-2"><ErrorsPanel /><ConsentPanel /></div>
          <ChecksPanel />
        </div>
      )}
    </AdminPage>
  );
}

function StatusPanel({ s }: { s: LiveStatus }) {
  const callback = HOSTINGER_API_BASE_URL ? `${HOSTINGER_API_BASE_URL}/api/whatsapp/webhook` : "(set the store server address first)";
  return (
    <>
      {s.state === "token-invalid" && <p role="alert" className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"><AlertTriangle className="size-4 shrink-0 text-destructive" /> Meta rejected the access token. All WhatsApp sending is paused until a new token is set as WHATSAPP_ACCESS_TOKEN on Hostinger and the server restarts.</p>}
      {s.accountBlocked && <p role="alert" className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"><AlertTriangle className="size-4 shrink-0 text-destructive" /> Meta reported “{s.accountBlocked.event}” for the WhatsApp account on {istDateTime(s.accountBlocked.at)}. Sending is paused — check WhatsApp Manager.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Connection">
          <p className="flex items-center gap-2 text-lg font-medium"><Tick ok={s.state === "connected" ? true : s.state === "token-invalid" ? false : null} /> {STATE_LABEL[s.state]}</p>
          {s.error && <p className="mt-2 text-sm text-destructive">{s.error}</p>}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Number</dt><dd>{s.displayPhoneNumber ?? "—"}{s.verifiedName ? ` · ${s.verifiedName}` : ""}</dd>
            <dt className="text-muted-foreground">Quality</dt><dd>{s.qualityRating ?? "—"}</dd>
            <dt className="text-muted-foreground">Daily limit</dt><dd>{s.messagingLimit ? `${s.messagingLimit.toLocaleString("en-IN")} customers / 24 h` : "—"}</dd>
            <dt className="text-muted-foreground">App ID</dt><dd className="font-mono text-xs">{s.appId ?? "—"}</dd>
            <dt className="text-muted-foreground">Business account</dt><dd className="font-mono text-xs">{s.wabaId ?? "—"}</dd>
            <dt className="text-muted-foreground">Phone number ID</dt><dd className="font-mono text-xs">{s.phoneNumberId ?? "—"}</dd>
            <dt className="text-muted-foreground">Graph API</dt><dd>{s.graphVersion ?? "—"}</dd>
            <dt className="text-muted-foreground">Templates</dt><dd>{s.templates.approved} approved of {s.templates.total}</dd>
            <dt className="text-muted-foreground">Last checked</dt><dd>{s.checkedAt ? istDateTime(s.checkedAt) : "—"}</dd>
          </dl>
          {s.quality && <p className="mt-3 text-xs text-muted-foreground">Latest quality notice: {s.quality.event}{s.quality.currentLimit ? ` (${s.quality.currentLimit})` : ""} · {istDateTime(s.quality.at)}</p>}
        </Panel>
        <Panel title="Checks with Meta">
          <ul className="space-y-2.5 text-sm">
            {s.checks.length === 0 && <li className="text-muted-foreground">No checks ran — the server has no WhatsApp settings.</li>}
            {s.checks.map((c) => <li key={c.key} className="flex gap-2"><Tick ok={c.ok} /><span><span className="font-medium">{c.label}</span><span className="block text-xs text-muted-foreground">{c.detail}</span></span></li>)}
          </ul>
          <div className="mt-5 border-t border-border pt-4 text-sm">
            <p className={adminLabel}>Webhook address for Meta</p>
            <p className="break-all font-mono text-xs">{callback}</p>
            <p className="mt-2 text-xs text-muted-foreground">Last handshake: {s.webhook.lastVerifiedAt ? istDateTime(s.webhook.lastVerifiedAt) : "never"} · Last event: {s.webhook.lastEventAt ? istDateTime(s.webhook.lastEventAt) : "none yet"}{s.webhook.lastSignatureFailureAt ? ` · Rejected an unsigned/forged call ${istDateTime(s.webhook.lastSignatureFailureAt)}` : ""}</p>
          </div>
        </Panel>
      </div>
      {s.templateEvents.length > 0 && (
        <Panel title="Template review updates from Meta">
          <ul className="space-y-1 text-sm">{s.templateEvents.map((e, i) => <li key={i}><span className="font-mono text-xs">{e.name}</span> — {e.event}{e.reason ? ` (${e.reason})` : ""} · <span className="text-muted-foreground">{istDateTime(e.at)}</span></li>)}</ul>
        </Panel>
      )}
    </>
  );
}

function AutomationsPanel() {
  const { data, setData, error, loading, reload } = useLive(() => whatsappLive.automations(), []);
  const [busy, setBusy] = useState(false);
  const save = async (a: Automations) => {
    setBusy(true);
    try { setData(await whatsappLive.saveAutomations(a)); toast("Saved"); } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved."); } finally { setBusy(false); }
  };
  const rows: { key: keyof Omit<Automations, "marketingDailyLimit">; label: string; help: string }[] = [
    { key: "otp", label: "WhatsApp sign-in codes", help: "Shoppers can sign in with a code sent on WhatsApp." },
    { key: "orderUpdates", label: "Order updates", help: "Confirmed, paid, packed, shipped, out for delivery, delivered, cancelled — only to customers who agreed." },
    { key: "abandonedCart", label: "6-hour bag reminder", help: "One reminder, only if the shopper ticked the box at checkout." },
    { key: "chatbot", label: "Chatbot replies", help: "Answers from real orders, products and policies; anything unclear goes to your inbox." },
  ];
  return (
    <Panel title="Automatic messages">
      {!data ? <LiveState error={error} loading={loading} onRetry={() => void reload()} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <label key={r.key} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={data[r.key]} disabled={busy} onChange={(e) => void save({ ...data, [r.key]: e.target.checked })} />
              <span><span className="font-medium">{r.label}</span><span className="block text-xs text-muted-foreground">{r.help}</span></span>
            </label>
          ))}
          <form className="rounded-lg border border-border p-3 text-sm md:col-span-2" onSubmit={(e) => { e.preventDefault(); const n = Number(new FormData(e.currentTarget).get("limit")); if (Number.isInteger(n) && n >= 0) void save({ ...data, marketingDailyLimit: n }); else toast.error("Enter a whole number."); }}>
            <label htmlFor="mkt-limit" className={adminLabel}>Offers & reminders: most customers per 24 hours</label>
            <div className="flex gap-2"><input id="mkt-limit" name="limit" type="number" min={0} max={100000} defaultValue={data.marketingDailyLimit} className={`${adminInput} max-w-40`} /><Button type="submit" variant="outline" disabled={busy}>Save</Button></div>
            <p className="mt-1 text-xs text-muted-foreground">Meta's own daily limit for the number also applies. 0 stops all offers and reminders.</p>
          </form>
        </div>
      )}
    </Panel>
  );
}

function TemplatesPanel() {
  const { data, error, loading, reload } = useLive(() => whatsappLive.templates(), []);
  const [map, setMap] = useState<Record<string, { name: string; language: string }>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setMap(Object.fromEntries(data.purposes.map((p) => [p.purpose, p.template]))); }, [data]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await whatsappLive.saveTemplates(map); toast("Template names saved"); await reload(); } catch (err) { toast.error(err instanceof Error ? err.message : "Not saved."); } finally { setBusy(false); }
  };
  return (
    <Panel title="Message templates">
      {!data ? <LiveState error={error} loading={loading} onRetry={() => void reload()} /> : (
        <form onSubmit={save}>
          <p className="mb-3 text-sm text-muted-foreground">Create each template in WhatsApp Manager with the suggested wording, wait for Meta to approve it, then enter its exact name here. A message is only sent once its template is approved and has the right number of variables.</p>
          {data.error && <p className="mb-3 text-sm text-destructive">{data.error}</p>}
          <Table head={["Message", "Template name", "Language", "Status", "Suggested wording"]}>
            {data.purposes.map((p) => (
              <tr key={p.purpose} className="border-t border-border align-top">
                <Td><span className="font-medium">{p.label}</span><span className="block text-xs text-muted-foreground">{p.category.toLowerCase()} · {p.variables.length ? p.variables.map((v, i) => `{{${i + 1}}} ${v}`).join(", ") : "no variables"}</span></Td>
                <Td><label className="sr-only" htmlFor={`tpl-${p.purpose}`}>Template name for {p.label}</label><input id={`tpl-${p.purpose}`} className={`${adminInput} min-w-40 font-mono text-xs`} value={map[p.purpose]?.name ?? ""} onChange={(e) => setMap((m) => ({ ...m, [p.purpose]: { name: e.target.value.trim(), language: m[p.purpose]?.language ?? "en" } }))} pattern="[a-z0-9_]{1,100}" /></Td>
                <Td><label className="sr-only" htmlFor={`lang-${p.purpose}`}>Language for {p.label}</label><input id={`lang-${p.purpose}`} className={`${adminInput} w-20 font-mono text-xs`} value={map[p.purpose]?.language ?? ""} onChange={(e) => setMap((m) => ({ ...m, [p.purpose]: { name: m[p.purpose]?.name ?? "", language: e.target.value.trim() } }))} pattern="[a-z]{2,3}(_[A-Z]{2})?" /></Td>
                <Td>{p.ready ? <span className="text-success">Approved — ready</span> : <span className="text-xs text-destructive">{p.reason}</span>}</Td>
                <Td className="max-w-sm text-xs text-muted-foreground">{p.suggested}</Td>
              </tr>
            ))}
          </Table>
          <div className="mt-3 flex justify-end"><Button type="submit" variant="lux" disabled={busy}>Save template names</Button></div>
          {data.templates.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-medium">All templates on the account ({data.templates.length})</summary>
              <Table head={["Name", "Language", "Category", "Meta status", "Variables"]}>
                {data.templates.map((t) => <tr key={`${t.name}-${t.language}`} className="border-t border-border"><Td className="font-mono text-xs">{t.name}</Td><Td>{t.language}</Td><Td>{t.category}</Td><Td>{t.status}</Td><Td>{t.variables}{t.hasLinkButton ? " + link button" : ""}</Td></tr>)}
              </Table>
            </details>
          )}
        </form>
      )}
    </Panel>
  );
}

function MessagesPanel() {
  const [kind, setKind] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLive(() => whatsappLive.messages({ ...(kind ? { kind } : {}), ...(state ? { state } : {}), page }), [kind, state, page]);
  return (
    <Panel title="Message log" action={<Button variant="ghost" size="sm" onClick={() => void reload()}><RefreshCw className="size-3.5" /> Refresh</Button>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="wa-kind">Type</label>
        <select id="wa-kind" className={`${adminInput} w-auto`} value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}><option value="">All types</option>{Object.entries(KIND_TEXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className="sr-only" htmlFor="wa-state">Status</label>
        <select id="wa-state" className={`${adminInput} w-auto`} value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}><option value="">All statuses</option>{["QUEUED", "ACCEPTED", "SENT", "DELIVERED", "READ", "FAILED", "SKIPPED", "RECEIVED"].map((k) => <option key={k} value={k}>{k.toLowerCase()}</option>)}</select>
        {data && <p className="self-center text-xs text-muted-foreground">Last 30 days: {Object.entries(data.last30Days).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(" · ") || "nothing yet"}</p>}
      </div>
      {!data ? <LiveState error={error} loading={loading} onRetry={() => void reload()} /> : data.messages.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No messages yet. Nothing is shown until the server has really sent or received one.</p> : (
        <>
          <Table head={["When", "To / from", "Type", "Template", "Status", "Detail"]}>
            {data.messages.map((m) => (
              <tr key={m.id} className="border-t border-border align-top">
                <Td className="whitespace-nowrap text-xs">{istDateTime(m.at)}</Td>
                <Td className="whitespace-nowrap font-mono text-xs">{m.to}</Td>
                <Td>{m.label ?? KIND_TEXT[m.kind] ?? m.kind}</Td>
                <Td className="font-mono text-xs">{m.templateName ?? "—"}</Td>
                <Td><MessageStatePill state={m.state} /></Td>
                <Td className="max-w-xs text-xs">{m.error ? <span className="text-destructive">{m.errorCode ? `#${m.errorCode} ` : ""}{m.error}</span> : m.text ? <span className="line-clamp-2">{m.text}</span> : m.attempts > 1 ? `${m.attempts} attempts` : ""}{m.state === "QUEUED" && m.nextAttemptAt ? <span className="block text-muted-foreground">Next try {istDateTime(m.nextAttemptAt)}</span> : null}</Td>
              </tr>
            ))}
          </Table>
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button>
            <span>Page {data.page} of {Math.max(1, Math.ceil(data.total / 50))}</span>
            <Button variant="outline" size="sm" disabled={page * 50 >= data.total} onClick={() => setPage((p) => p + 1)}>Older</Button>
          </div>
        </>
      )}
    </Panel>
  );
}

function ErrorsPanel() {
  const { data, error, loading, reload } = useLive(() => whatsappLive.errors(), []);
  return (
    <Panel title="Meta API errors">
      {!data ? <LiveState error={error} loading={loading} onRetry={() => void reload()} /> : data.length === 0 ? <p className="text-sm text-muted-foreground">No errors recorded.</p> : (
        <ul className="max-h-96 space-y-3 overflow-y-auto text-sm">
          {data.map((e) => <li key={e.id} className="border-l-2 border-destructive/40 pl-3"><p className="font-medium">{e.message}</p><p className="text-xs text-muted-foreground">{istDateTime(e.at)} · {e.operation}{e.httpStatus ? ` · HTTP ${e.httpStatus}` : ""}{e.code ? ` · code ${e.code}${e.subcode ? `/${e.subcode}` : ""}` : ""}{e.traceId ? ` · trace ${e.traceId}` : ""}</p>{e.detail && <p className="text-xs">{e.detail}</p>}</li>)}
        </ul>
      )}
    </Panel>
  );
}

function ConsentPanel() {
  const [phone, setPhone] = useState("");
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useLive(() => whatsappLive.consents(q || undefined), [q]);
  const [f, setF] = useState({ phone: "", purpose: "marketing" as "marketing" | "order_updates", status: "OPTED_OUT" as "OPTED_IN" | "OPTED_OUT", note: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { const r = await whatsappLive.setConsent(f); toast(r.changed ? "Recorded" : "No change — that was already their choice"); setF((x) => ({ ...x, note: "" })); await reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Not saved."); } finally { setBusy(false); }
  };
  return (
    <Panel title="Opt-ins and opt-outs">
      {!data ? <LiveState error={error} loading={loading} onRetry={() => void reload()} /> : (
        <>
          <p className="text-sm">Offers: <b>{data.summary.marketing.optedIn}</b> agreed · {data.summary.marketing.optedOut} opted out. Order updates: <b>{data.summary.orderUpdates.optedIn}</b> agreed · {data.summary.orderUpdates.optedOut} opted out.</p>
          <p className="mt-1 text-xs text-muted-foreground">Customers who reply STOP are opted out automatically. Only record a change the customer asked for.</p>
          <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={submit}>
            <input aria-label="Mobile number" className={adminInput} placeholder="Mobile number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required />
            <select aria-label="Messages" className={adminInput} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value as typeof f.purpose })}><option value="marketing">Offers</option><option value="order_updates">Order updates</option></select>
            <select aria-label="Choice" className={adminInput} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as typeof f.status })}><option value="OPTED_OUT">Opt out</option><option value="OPTED_IN">Opt in</option></select>
            <input aria-label="How they told you" className={adminInput} placeholder="How they told you (e.g. phone call)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} required minLength={3} maxLength={50} />
            <Button type="submit" variant="outline" disabled={busy} className="sm:col-span-2">Record customer's choice</Button>
          </form>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(phone.trim()); }}>
            <input aria-label="Find a number" className={`${adminInput} min-w-0 flex-1`} placeholder="Find a number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" variant="ghost">Search</Button>
          </form>
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
            {data.history.map((h) => <li key={h.id} className="flex justify-between gap-2 border-t border-border pt-1"><span className="font-mono">{h.phone}</span><span>{h.purpose === "marketing" ? "Offers" : "Order updates"}: {h.status === "OPTED_IN" ? "in" : "out"} · {h.source}</span><span className="text-muted-foreground">{istDateTime(h.at)}</span></li>)}
          </ul>
        </>
      )}
    </Panel>
  );
}

function ChecksPanel() {
  const [recipient, setRecipient] = useState("");
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const run = async (key: string) => {
    setRunning(key);
    try { const r = await whatsappLive.runCheck(key, recipient); setResults((x) => ({ ...x, [key]: r })); }
    catch (e) { setResults((x) => ({ ...x, [key]: { key, passed: false, detail: e instanceof Error ? e.message : "Failed", at: new Date().toISOString() } })); }
    finally { setRunning(null); }
  };
  const runAll = async () => { for (const c of CHECKS) if (!c.sends || recipient.trim()) await run(c.key); };
  return (
    <Panel title="Integration checks" action={<Button variant="outline" size="sm" disabled={!!running} onClick={() => void runAll()}>Run all</Button>}>
      <label htmlFor="wa-test-to" className={adminLabel}>Test number (must be listed in WHATSAPP_TEST_RECIPIENTS on the server)</label>
      <input id="wa-test-to" className={`${adminInput} max-w-xs`} placeholder="10-digit mobile" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      <ul className="mt-4 divide-y divide-border text-sm">
        {CHECKS.map((c) => {
          const r = results[c.key];
          return (
            <li key={c.key} className="flex items-start gap-3 py-2.5">
              <Tick ok={r ? r.passed : null} />
              <span className="flex-1"><span className="font-medium">{c.label}</span>{r && <span className="block text-xs text-muted-foreground">{r.detail}</span>}</span>
              <Button variant="ghost" size="sm" disabled={!!running || (c.sends && !recipient.trim())} onClick={() => void run(c.key)}>{running === c.key ? "Checking…" : "Run"}</Button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
