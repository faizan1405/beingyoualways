import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { Pill } from "@/components/shop/OrderBadges";
import { useDemoStore } from "@/hooks/use-demo-store";
import { inr, shortDate } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { customerStore, withStats } from "@/services/customerService";
import { orderStore } from "@/services/orderService";

export const Route = createFileRoute("/admin/customers")({ component: Customers });

function Customers() {
  const orders = useDemoStore(orderStore);
  const data = useDemoStore(customerStore).map((c) => withStats(c, orders));
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Customer["segment"] | "">("");
  const [status, setStatus] = useState<Customer["status"] | "">("");
  const list = data.filter((c) => `${c.name} ${c.email} ${c.phone} ${c.addresses[0]?.city ?? ""}`.toLowerCase().includes(q.toLowerCase()) && (!seg || c.segment === seg) && (!status || c.status === status));
  return (
    <AdminPage title="Customers" subtitle="Invented demo customers with masked numbers. Real accounts arrive with Google / WhatsApp sign-in on the Hostinger backend.">
      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <input aria-label="Search customers" placeholder="Search name, email, phone or city" className={adminInput} value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter segment" className={adminInput} value={seg} onChange={(e) => setSeg(e.target.value as Customer["segment"])}><option value="">All segments</option>{["new", "repeat", "vip", "inactive"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select aria-label="Filter account status" className={adminInput} value={status} onChange={(e) => setStatus(e.target.value as Customer["status"])}><option value="">All account statuses</option><option value="active">Active</option><option value="blocked">Blocked</option></select>
        </div>
        {list.length > 0 ? (
          <Table head={["Customer", "Phone", "Segment", "Status", "Orders", "Spent", "Joined"]}>
            {list.map((c) => (
              <tr key={c.id}>
                <Td><Link to="/admin/customers/$id" params={{ id: c.id }} className="font-semibold text-primary hover:underline">{c.name}</Link><div className="text-xs text-muted-foreground">{c.email}</div></Td>
                <Td>{c.phone}</Td><Td><Pill t={c.segment === "vip" ? "good" : c.segment === "inactive" ? "muted" : "info"}>{c.segment}</Pill></Td>
                <Td><Pill t={c.status === "active" ? "good" : "bad"}>{c.status}</Pill></Td>
                <Td>{c.orderCount}</Td><Td>{inr(c.totalSpent)}</Td><Td>{shortDate(c.joinedAt)}</Td>
              </tr>
            ))}
          </Table>
        ) : <p className="py-10 text-center text-sm text-muted-foreground">No customers match these filters.</p>}
      </Panel>
    </AdminPage>
  );
}
