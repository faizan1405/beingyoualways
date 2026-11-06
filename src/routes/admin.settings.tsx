import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AdminPage, NotConnected, Panel, adminInput, adminLabel } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/services/cartService";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

function F({ id, label, value }: { id: string; label: string; value: string | number }) {
  return <div><label htmlFor={id} className={adminLabel}>{label}</label><input id={id} defaultValue={value} className={adminInput} /></div>;
}

function Settings() {
  return (
    <AdminPage title="Settings" subtitle="Frontend placeholders — values are not saved.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Store details"><div className="space-y-3"><F id="sn" label="Store name" value="Being You – Always" /><F id="se" label="Support email" value="info@beingyoualways.com" /><F id="sp" label="Support phone" value="+91 97374 22248" /><F id="sw" label="WhatsApp number" value="Awaiting client confirmation" /></div></Panel>
        <Panel title="Branding"><div className="space-y-3"><F id="al" label="Announcement bar" value="Naturally you, beautifully always" /><div><p className={adminLabel}>Logo</p><div className="rounded-md border border-dashed border-input p-6 text-center text-sm text-muted-foreground">Logo upload — awaiting brand assets</div></div></div></Panel>
        <Panel title="Shipping"><div className="space-y-3"><F id="ft" label="Free shipping above (₹)" value={FREE_SHIPPING_THRESHOLD} /><F id="sf" label="Flat shipping fee (₹)" value={SHIPPING_FEE} /></div></Panel>
        <Panel title="Integrations">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">Razorpay payments <NotConnected label="Not connected" /></li>
            <li className="flex items-center justify-between">Cash on Delivery <NotConnected label="Not connected" /></li>
            <li className="flex items-center justify-between">WhatsApp Cloud API <NotConnected /></li>
            <li className="flex items-center justify-between">Hostinger backend <NotConnected label="Not connected" /></li>
          </ul>
        </Panel>
      </div>
      <Button variant="lux" size="xl" onClick={() => toast("Settings will save once the backend is connected.")}>Save settings</Button>
    </AdminPage>
  );
}
