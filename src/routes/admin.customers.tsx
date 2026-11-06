import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AdminPage, Panel, Table, Td, adminInput } from "@/components/admin/AdminUI";
import { Pill } from "@/components/shop/OrderBadges";
import { inr, shortDate } from "@/lib/format";
import { customerService } from "@/services/customerService";

export const Route = createFileRoute("/admin/customers")({ component: Customers });

function Customers() {
  const { data = [] } = useQuery({ queryKey: ["admin", "customers"], queryFn: customerService.list });
  const [q, setQ] = useState("");
  const list = data.filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <AdminPage title="Customers" subtitle="Sample customers.">
      <Panel>
        <input aria-label="Search customers" placeholder="Search customers" className={`${adminInput} mb-4 max-w-sm`} value={q} onChange={(e) => setQ(e.target.value)} />
        <Table head={["Customer", "Phone", "Segment", "Orders", "Spent", "Joined"]}>
          {list.map((c) => (
            <tr key={c.id}>
              <Td><Link to="/admin/customers/$id" params={{ id: c.id }} className="font-semibold text-primary hover:underline">{c.name}</Link><div className="text-xs text-muted-foreground">{c.email}</div></Td>
              <Td>{c.phone}</Td><Td><Pill t={c.segment === "vip" ? "good" : c.segment === "inactive" ? "muted" : "info"}>{c.segment}</Pill></Td>
              <Td>{c.orderCount}</Td><Td>{inr(c.totalSpent)}</Td><Td>{shortDate(c.joinedAt)}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </AdminPage>
  );
}
