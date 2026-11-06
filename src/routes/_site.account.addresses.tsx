import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { DEMO_CUSTOMER_ID, customerService } from "@/services/customerService";

export const Route = createFileRoute("/_site/account/addresses")({
  loader: async () => (await customerService.get(DEMO_CUSTOMER_ID))!.addresses,
  component: Addresses,
});

function Addresses() {
  const list = Route.useLoaderData();
  return (
    <div>
      <h2 className="text-3xl">Saved addresses</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {list.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold">{a.label}{a.isDefault && <span className="rounded-full bg-secondary px-2 text-[10px] uppercase">Default</span>}</p>
            <p className="mt-2">{a.name}</p>
            <p className="text-muted-foreground">{a.line1}, {a.city}, {a.state} {a.pincode}</p>
            <p className="text-muted-foreground">{a.phone}</p>
          </div>
        ))}
        <button onClick={() => toast("Adding addresses needs the backend.")} className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-dashed border-input text-sm text-muted-foreground hover:border-primary"><Plus className="size-4" /> Add address</button>
      </div>
    </div>
  );
}
