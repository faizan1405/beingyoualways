import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { bagReminderOn, currentCheckoutKey, setBagReminderOn } from "@/lib/checkout-draft";
import { useShop } from "@/lib/shop-store";
import { whatsappShop, type BagReminderStatus } from "@/services/whatsappLiveService";

/**
 * Earlier, optional opt-in for the one 6-hour WhatsApp bag reminder (checkout has its own box).
 * - Never ticked for the shopper; unticking cancels the reminder.
 * - Only for a shopper signed in with a WhatsApp-verified number, so nobody can sign up someone else's phone.
 * - It covers only this reminder — not offers or campaigns. Reply STOP ends it.
 * Hidden entirely while the store has reminders switched off.
 */
export function BagReminderOptIn() {
  const { lines } = useShop();
  const [st, setSt] = useState<BagReminderStatus | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lineIds = lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
  const payload = (consent: boolean) => ({ checkoutKey: currentCheckoutKey(), lines: lineIds, reminderConsent: consent });

  useEffect(() => {
    let alive = true;
    whatsappShop.bagReminderStatus()
      .then((s) => { if (!alive) return; setSt(s); const isOn = s.eligible && s.on && bagReminderOn(); setOn(isOn); if (!isOn) setBagReminderOn(false); })
      .catch(() => { if (alive) setSt(null); }); // the offer simply isn't shown when the store can't be reached
    return () => { alive = false; };
  }, []);

  // Keep the remembered products in step with the bag while the reminder is on (or cancel it if the bag empties).
  const bagKey = JSON.stringify(lines.map((l) => [l.productId, l.variantId, l.quantity]));
  const first = useRef(true);
  const lastLines = useRef(lineIds);
  if (lineIds.length) lastLines.current = lineIds;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!on) return;
    const t = setTimeout(() => {
      if (lines.length === 0) { void whatsappShop.saveBagReminder({ ...payload(false), lines: lastLines.current }).catch(() => undefined); setOn(false); setBagReminderOn(false); return; }
      void whatsappShop.saveBagReminder(payload(true)).catch(() => undefined);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagKey]);

  if (!st?.available || lines.length === 0) return null;

  const toggle = async (next: boolean) => {
    setBusy(true);
    setNote(null);
    const before = on;
    setOn(next); // show the choice straight away; put it back if the store doesn't save it
    try {
      const r = await whatsappShop.saveBagReminder(payload(next));
      const isOn = next && r.tracking;
      setOn(isOn);
      setBagReminderOn(isOn);
      setNote(isOn ? "Done — one reminder in 6 hours if this bag is still waiting." : next ? "We couldn't set the reminder for these products." : "Reminder cancelled.");
    } catch (e) {
      setOn(before);
      setNote(e instanceof Error ? e.message : "Couldn't save your choice. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-md border border-border bg-background p-3.5 text-xs leading-relaxed">
      <p className="flex items-center gap-1.5 font-semibold text-foreground"><MessageCircle className="size-3.5" aria-hidden /> Not ready yet?</p>
      {st.eligible ? (
        <label className="mt-2 flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-1" checked={on} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
          <span>Send me one WhatsApp reminder at {st.phone} if I leave this bag for 6 hours. Only this reminder — no offers. Reply STOP any time.</span>
        </label>
      ) : (
        <p className="mt-1.5 text-muted-foreground">
          {st.reason === "verify_phone" ? "To get one WhatsApp reminder about this bag, confirm your number first: " : "Want one WhatsApp reminder about this bag? "}
          <Link to="/login" className="underline">sign in with your WhatsApp number</Link>, then come back to your bag. It's optional and only for this reminder.
        </p>
      )}
      {note && <p role="status" className="mt-2 text-muted-foreground">{note}</p>}
    </div>
  );
}
