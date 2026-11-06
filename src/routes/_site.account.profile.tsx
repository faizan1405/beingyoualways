import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DEMO_CUSTOMER_ID, customerService } from "@/services/customerService";

export const Route = createFileRoute("/_site/account/profile")({
  loader: async () => (await customerService.get(DEMO_CUSTOMER_ID))!,
  component: Profile,
});

function Profile() {
  const c = Route.useLoaderData();
  return (
    <form className="max-w-lg space-y-4" onSubmit={(e) => { e.preventDefault(); toast("Profile changes will save once the backend is connected."); }}>
      <h2 className="text-3xl">Profile details</h2>
      {[["pname", "Full name", c.name], ["pemail", "Email", c.email], ["pphone", "Mobile", c.phone]].map(([id, l, v]) => (
        <div key={id}>
          <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{l}</label>
          <input id={id} defaultValue={v} className="h-12 w-full rounded-md border border-input bg-card px-4 text-sm" />
        </div>
      ))}
      <Button variant="lux" size="xl" type="submit">Save changes</Button>
    </form>
  );
}
