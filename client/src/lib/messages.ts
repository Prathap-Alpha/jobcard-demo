// The exact wording the customer receives. Written the way a Botswana print shop
// actually speaks to its customers: short, no jargon, and the money always stated.
import { EXTRA_REVISION_FEE, FREE_REVISIONS, balanceOf, fmtDue, fmtP, orderTypeById, type Order } from "./domain";

export type Channel = "sms" | "email";

export interface Message {
  id: string;
  orderId: string;
  channel: Channel;
  to: string;
  subject?: string;
  body: string;
  sentAt: number;
  kind: MessageKind;
}

export type MessageKind =
  | "received" | "proof_ready" | "in_production" | "ready_collection"
  | "out_for_delivery" | "delivered" | "overdue_reminder" | "revision_charged";

export const MESSAGE_LABEL: Record<MessageKind, string> = {
  received: "Order received",
  proof_ready: "Proof ready to approve",
  in_production: "Approved — in production",
  ready_collection: "Ready for collection",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  overdue_reminder: "Overdue reminder",
  revision_charged: "Extra revision charged",
};

const job = (o: Order) => `${orderTypeById(o.type).name} (${o.qty})`;

/** Say the revision position in plain words rather than "0 change(s) left". */
const freeLine = (o: Order) => {
  const left = Math.max(0, FREE_REVISIONS - o.revisionsUsed);
  if (left === 0) return `Your ${FREE_REVISIONS} free changes are used, so any further change adds ${fmtP(EXTRA_REVISION_FEE)}.`;
  return `You have ${left} free change${left > 1 ? "s" : ""} left, then each further change is ${fmtP(EXTRA_REVISION_FEE)}.`;
};

export function compose(kind: MessageKind, o: Order): { sms: string; email: { subject: string; body: string } } {
  const bal = balanceOf(o);
  const balLine =
    bal > 0
      ? `Balance still owing: ${fmtP(bal)}.`
      : `Your account is settled in full, thank you.`;

  switch (kind) {
    case "received":
      return {
        sms: `Hi ${o.customer}, we have your order ${o.id} for ${job(o)}. Ready by ${fmtDue(o.dueAt)}. Paid ${fmtP(o.deposit)} of ${fmtP(o.total)}.`,
        email: {
          subject: `Order ${o.id} received — ${job(o)}`,
          body: `Hi ${o.customer},\n\nThank you, we have booked your job in.\n\nOrder: ${o.id}\nJob: ${o.description}\nQuantity: ${o.qty}\nReady by: ${fmtDue(o.dueAt)}\nTotal: ${fmtP(o.total)}\nPaid so far: ${fmtP(o.deposit)}\n${balLine}\n\nWe will message you at every stage.`,
        },
      };
    case "proof_ready":
      return {
        sms: `Hi ${o.customer}, your proof for ${o.id} is ready. Please approve it so we can start printing. ${freeLine(o)}`,
        email: {
          subject: `Proof ready for your approval — ${o.id}`,
          body: `Hi ${o.customer},\n\nOur design team has finished the proof for ${o.description}.\n\nNothing goes to the machines until you approve it. You have ${Math.max(0, 2 - o.revisionsUsed)} free change(s) remaining; after that each further change is charged at P150.\n\nPlease reply APPROVE or tell us what to change.`,
        },
      };
    case "in_production":
      return {
        sms: `Thank you ${o.customer}. ${o.id} is approved and now in production. Ready by ${fmtDue(o.dueAt)}.`,
        email: {
          subject: `Approved — ${o.id} is in production`,
          body: `Hi ${o.customer},\n\nYour approval is in. ${job(o)} is now on the floor and ready by ${fmtDue(o.dueAt)}.\n\n${balLine}`,
        },
      };
    case "ready_collection":
      return {
        sms: `Hi ${o.customer}, order ${o.id}, ${job(o)}, is READY for collection. ${balLine} Open Mon-Fri 08:00-17:30, Sat 08:00-13:00.`,
        email: {
          subject: `Ready for collection — ${o.id}${bal > 0 ? ` (${fmtP(bal)} outstanding)` : ""}`,
          body: `Hi ${o.customer},\n\nGood news, your job is finished and waiting for you.\n\nOrder: ${o.id}\nJob: ${o.description}\nQuantity: ${o.qty}\n\nTotal: ${fmtP(o.total)}\nPaid: ${fmtP(o.deposit)}\n${balLine}\n\n${bal > 0 ? "Please settle the balance on collection. We accept cash, card and EFT." : "Nothing further to pay."}\n\nCollection hours: Mon-Fri 08:00-17:30, Sat 08:00-13:00.`,
        },
      };
    case "out_for_delivery":
      return {
        sms: `Hi ${o.customer}, ${o.id} has left our shop with ${o.driver ?? "our driver"} and is on the way to ${o.address ?? "you"}. ${balLine}`,
        email: {
          subject: `On the way — ${o.id}`,
          body: `Hi ${o.customer},\n\n${job(o)} is out for delivery with ${o.driver ?? "our driver"}.\n\nDelivering to: ${o.address ?? "-"}\n${balLine}\n\nPlease have someone available to sign for it.`,
        },
      };
    case "delivered":
      return {
        sms: `${o.id} delivered to ${o.address ?? "you"}. Thank you for your business. ${balLine}`,
        email: {
          subject: `Delivered — ${o.id}`,
          body: `Hi ${o.customer},\n\n${job(o)} was delivered to ${o.address ?? "-"}.\n\n${balLine}\n\nThank you for your business.`,
        },
      };
    case "overdue_reminder":
      return {
        sms: `Hi ${o.customer}, ${o.id} has passed its promised date. We are on it and will confirm a new time today. Sorry for the delay.`,
        email: {
          subject: `Update on ${o.id} — running late`,
          body: `Hi ${o.customer},\n\n${job(o)} has passed the date we promised (${fmtDue(o.dueAt)}). It is flagged with our production manager and we will confirm a new collection time today.\n\nApologies for the delay.`,
        },
      };
    case "revision_charged":
      return {
        sms: `Hi ${o.customer}, that is change number ${o.revisionsUsed} on ${o.id}. The first ${FREE_REVISIONS} are free, so ${fmtP(EXTRA_REVISION_FEE)} has been added. New total ${fmtP(o.total)}.`,
        email: {
          subject: `Extra design change — ${o.id}`,
          body: `Hi ${o.customer},\n\nWe have logged change number ${o.revisionsUsed} on ${o.description}.\n\nYour first 2 changes are free. Each one after that is P150, so P150 has been added to your order.\n\nNew total: ${fmtP(o.total)}\nPaid: ${fmtP(o.deposit)}\n${balLine}`,
        },
      };
  }
}
