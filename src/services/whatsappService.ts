// WhatsApp marketing (mock). Nothing is ever sent from the frontend.
import { abandonedCarts, campaigns as seed, chatbotMenu, messages } from "@/lib/mock-data";
import type { AbandonedCartSettings, WhatsAppCampaign } from "@/lib/types";

let campaigns: WhatsAppCampaign[] = structuredClone(seed);
let settings: AbandonedCartSettings = {
  enabled: true,
  delayHours: 6,
  template: "Hi {name}, you left something lovely in your bag 🌿 Complete your order here: {cart_link}",
  includeDiscount: false,
  discountCode: "",
};
const r = <T,>(v: T) => Promise.resolve(structuredClone(v));

export const whatsappService = {
  connected: false,
  templates: ["festive_offer_v1", "new_launch_v1", "winback_v1", "order_confirmed", "order_shipped", "abandoned_cart_6h"],
  campaigns: () => r(campaigns),
  saveCampaign: (c: WhatsAppCampaign) => {
    campaigns = [c, ...campaigns.filter((x) => x.id !== c.id)];
    return r(c);
  },
  messages: () => r(messages),
  abandonedCarts: () => r(abandonedCarts),
  abandonedSettings: () => r(settings),
  saveAbandonedSettings: (s: AbandonedCartSettings) => {
    settings = s;
    return r(s);
  },
  chatbotMenu: () => r(chatbotMenu),
};
