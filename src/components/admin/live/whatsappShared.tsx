import { cn } from "@/lib/utils";
import { STATE_TEXT, type MessageState } from "@/services/whatsappLiveService";

const tone: Record<MessageState, string> = {
  QUEUED: "bg-accent/12 text-foreground border-accent/40", ACCEPTED: "bg-primary/8 text-primary border-primary/25", SENT: "bg-primary/8 text-primary border-primary/25",
  DELIVERED: "bg-success/12 text-success border-success/30", READ: "bg-success/12 text-success border-success/30", FAILED: "bg-destructive/10 text-destructive border-destructive/30",
  SKIPPED: "bg-secondary text-muted-foreground border-border", RECEIVED: "bg-secondary text-foreground border-border",
};
/** A message's state exactly as Meta reported it (accepted ≠ delivered). */
export function MessageStatePill({ state }: { state: MessageState }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", tone[state])}>{STATE_TEXT[state]}</span>;
}
export const KIND_TEXT: Record<string, string> = { otp: "Sign-in code", order: "Order update", cart: "Bag reminder", campaign: "Campaign", chatbot: "Chatbot reply", support: "Team reply", test: "Test", inbound: "From customer" };
