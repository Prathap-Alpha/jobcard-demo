/* ═══════════════════════════════════════════════════════════════════════════
   The Odoo link.

   The shop already runs quotations and invoices in Odoo and does not want to
   retype any of it. This file is the whole shape of that link: look a quotation
   up, pull it into a job card, and push the job back when it is invoiced.

   WHAT IS REAL AND WHAT IS NOT
   The demo runs entirely in the browser, and a browser cannot hold an Odoo API
   key — anyone who opened the page could read it. So `lookupQuote` and
   `pushToOdoo` answer from the stand-in quotation book below instead of calling
   Odoo. Everything else, the screens, the states, the failure handling, is the
   real thing.

   TO GO LIVE: the shop's Odoo supplier issues an API key, it is stored on the
   server, and these two functions become one server call each
   (Odoo's JSON-RPC `res.partner` / `sale.order` / `account.move`). No screen
   and no other file changes.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { OrderTypeId } from "./domain";

export type SyncState = "not_sent" | "in_step" | "pending" | "failed";

export const SYNC_LABEL: Record<SyncState, string> = {
  not_sent: "Not in Odoo",
  in_step: "In step with Odoo",
  pending: "Sending to Odoo",
  failed: "Odoo did not accept it",
};

export interface OdooQuote {
  ref: string;              // SO-2026-1234
  customer: string;
  contact: string;
  email: string;
  type: OrderTypeId;
  description: string;
  qty: number;
  total: number;            // Pula, VAT inclusive
  deposit: number;          // already received against the quote
  address?: string;
  state: "sent" | "accepted";
}

/** Stand-in for the shop's Odoo quotation book. Replaced by a real lookup. */
const QUOTE_BOOK: OdooQuote[] = [
  {
    ref: "SO-2026-1806", customer: "Baisago University", contact: "+267 393 1188",
    email: "procurement@baisago.ac.bw", type: "banners", description: "Open day banners 3m x 1m, 4 designs",
    qty: 8, total: 6240, deposit: 3120, state: "accepted",
  },
  {
    ref: "SO-2026-1811", customer: "Kgale Hill Spar", contact: "+267 316 4402",
    email: "accounts@kgalespar.co.bw", type: "stickers", description: "Shelf-edge promo stickers, weatherproof",
    qty: 400, total: 2400, deposit: 0, state: "accepted",
  },
  {
    ref: "SO-2026-1817", customer: "Notwane Football Club", contact: "+267 72 445 019",
    email: "kit@notwanefc.co.bw", type: "branded_uniforms", description: "Home kit, numbers and sponsor crest",
    qty: 30, total: 9600, deposit: 4800, address: "Plot 4471, Broadhurst, Gaborone", state: "accepted",
  },
  {
    ref: "SO-2026-1824", customer: "Dr M Ramotswe Surgery", contact: "+267 390 7712",
    email: "reception@ramotswesurgery.co.bw", type: "print_press", description: "Appointment cards and referral pads",
    qty: 1000, total: 3100, deposit: 1550, state: "sent",
  },
  {
    ref: "SO-2026-1830", customer: "Tlokweng Brigade", contact: "+267 74 220 668",
    email: "admin@tlokwengbrigade.org", type: "dtf_transfers", description: "Trainee overall badges, two colours",
    qty: 120, total: 4200, deposit: 0, state: "accepted",
  },
];

/** Where the shop's Odoo lives. In the real build the key never reaches the browser. */
export interface OdooConnection {
  url: string;
  database: string;
  user: string;
  /** True once the supplier has issued a key and it is held on the server. */
  keyHeldOnServer: boolean;
}

export const DEMO_CONNECTION: OdooConnection = {
  url: "https://pulaprinters.odoo.com",
  database: "pulaprinters-live",
  user: "jobcard@pulaprinters.co.bw",
  keyHeldOnServer: false,
};

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Look a quotation up by its number.
 * Real build: one server call to Odoo's `sale.order`, same shape back.
 */
export async function lookupQuote(ref: string): Promise<OdooQuote | null> {
  await wait(450);                       // stands in for the round trip
  const want = ref.trim().toUpperCase();
  if (!want) return null;
  return QUOTE_BOOK.find(q => q.ref.toUpperCase() === want)
    ?? QUOTE_BOOK.find(q => q.ref.toUpperCase().endsWith(want) && want.length >= 4)
    ?? null;
}

/** Every quotation the shop could pull in, for the picker. */
export const openQuotes = () => QUOTE_BOOK.filter(q => q.state === "accepted");

/**
 * Tell Odoo the job is finished and invoiceable.
 * Real build: create the `account.move` against the quotation.
 */
export async function pushToOdoo(ref: string): Promise<{ ok: boolean; message: string }> {
  await wait(600);
  if (!ref.trim()) {
    return { ok: false, message: "This job has no Odoo quotation number on it." };
  }
  return { ok: true, message: `Invoice raised against ${ref} in Odoo.` };
}
