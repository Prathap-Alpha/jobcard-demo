/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  EXTRA_REVISION_FEE, FREE_REVISIONS, balanceOf, buildStages, currentStage, deptById,
  downstreamOfDesign, isComplete, isOverdue, normaliseRoute, orderTypeById, proofIsOut,
  routeIsValid, stageUnlocked, withDesignIfNeeded, type DeptId, type Order, type Payment,
} from "./domain";
import { pushToOdoo, type SyncState } from "./odoo";
import { compose, type Channel, type Message, type MessageKind } from "./messages";
import { SEED } from "./seed";

// Bumped whenever the seeded sample day changes, otherwise a browser that saw an
// earlier version keeps showing it and never picks up the corrections.
const LS_KEY = "jobcard.demo.v2";

export interface Event {
  id: string;
  orderId: string;
  at: number;
  who: string;
  text: string;
}

interface Snapshot {
  orders: Order[];
  messages: Message[];
  events: Event[];
  /** Orders a department screen has not acknowledged yet. Drives the "new job" pop-up. */
  unseen: Record<string, string[]>;
}

export interface NewOrder {
  enquiry?: boolean;
  /** Set when the job was pulled from an existing Odoo quotation. */
  odooRef?: string;
  customer: string; contact: string; email: string;
  type: Order["type"]; description: string; qty: number;
  route: DeptId[]; artwork: Order["artwork"];
  dueAt: number; priority: Order["priority"];
  total: number; deposit: number;
  fulfilment: Order["fulfilment"]; address?: string;
  notes?: string;
}

interface Store extends Snapshot {
  createOrder: (draft: NewOrder) => Order;
  claimStage: (orderId: string, dept: DeptId, who: string) => void;
  finishStage: (orderId: string, dept: DeptId, who: string) => void;
  approveDesign: (orderId: string) => void;
  requestChanges: (orderId: string, note: string) => void;
  takePayment: (
    orderId: string, amount: number,
    extra?: { method?: Payment["method"]; slip?: Payment["slip"]; takenBy?: string },
  ) => void;
  dispatchOrder: (orderId: string, driver: string) => void;
  markDelivered: (orderId: string) => void;
  markCollected: (orderId: string) => void;
  chaseOverdue: () => number;
  chaseOne: (orderId: string) => void;
  sendToOdoo: (orderId: string) => Promise<{ ok: boolean; message: string }>;
  convertEnquiry: (orderId: string) => void;
  acknowledge: (dept: DeptId) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

let uid = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${++uid}`;

function load(): Snapshot {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Snapshot;
      if (Array.isArray(s.orders) && s.orders.length) return s;
    }
  } catch {
    /* private browsing, or stale shape: fall through to a fresh seed */
  }
  return { orders: SEED(), messages: [], events: [], unseen: {} };
}

const log = (s: Snapshot, orderId: string, who: string, text: string): Event[] =>
  [{ id: nid("ev"), orderId, at: Date.now(), who, text }, ...s.events];

/** Six hours between automatic chases on the same job. */
const CHASE_GAP = 6 * 3_600_000;

/** A job number nothing on the board is already using. */
function nextJobNumber(orders: Order[]): string {
  const used = new Set(orders.map(o => o.id));
  const highest = orders
    .map(o => Number(o.id.split("-").pop()))
    .filter(n => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 100);
  let n = highest + 1;
  while (used.has(`JC-2609-${n}`)) n++;
  return `JC-2609-${n}`;
}

/**
 * The store refuses a move the floor should not be able to make, whatever the
 * screen happens to offer: out of turn, or production before the client has
 * signed the proof off.
 */
function workable(o: Order, dept: DeptId, requireStatus?: "queued") {
  const st = o.stages.find(s => s.dept === dept);
  if (st === undefined || st.status === "done") return false;
  if (requireStatus !== undefined && st.status !== requireStatus) return false;
  return stageUnlocked(o, dept);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(load);
  const snapRef = React.useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snap));
    } catch {
      /* private browsing: the demo still runs, it just will not survive a reload */
    }
  }, [snap]);

  const patch = useCallback((fn: (s: Snapshot) => Snapshot) => setSnap(fn), []);

  /** Queue the customer SMS and email for a step. Both channels, per the client's rule 7. */
  const notify = useCallback((s: Snapshot, o: Order, kind: MessageKind): Message[] => {
    const c = compose(kind, o);
    const at = Date.now();
    const mk = (channel: Channel, to: string, body: string, subject?: string): Message =>
      ({ id: nid("msg"), orderId: o.id, channel, to, body, subject, sentAt: at, kind });
    return [
      mk("sms", o.contact, c.sms),
      mk("email", o.email, c.email.body, c.email.subject),
      ...s.messages,
    ];
  }, []);

  const createOrder = useCallback((d: NewOrder) => {
    // Admin and Accounts can never be skipped, whoever calls this, and a job we
    // design ourselves must stop at Design or it would wait forever for a proof.
    const route = withDesignIfNeeded(
      routeIsValid(d.route) ? d.route : normaliseRoute(d.route),
      d.artwork,
    );
    const order: Order = {
      id: nextJobNumber(snapRef.current.orders),
      // A job pulled from Odoo keeps the real quotation number. Otherwise the
      // shop raises it in Odoo afterwards, so it starts with none.
      // (The seeded day uses SO-2026-1403..1472.)
      odooRef: d.odooRef ?? "",
      odooSynced: false,
      enquiry: d.enquiry,
      customer: d.customer, contact: d.contact, email: d.email,
      type: d.type, description: d.description, qty: d.qty,
      route, stages: buildStages(route),
      artwork: d.artwork,
      approval: d.artwork === "in_house" ? "pending" : "not_required",
      revisionsUsed: 0,
      createdAt: Date.now(), dueAt: d.dueAt, priority: d.priority,
      total: d.total, deposit: d.deposit,
      fulfilment: d.fulfilment, address: d.address,
      delivery: "not_started", notes: d.notes,
    };
    patch(s => ({
      ...s,
      orders: [order, ...s.orders],
      messages: notify(s, order, d.enquiry ? "enquiry_received" : "received"),
      events: log(s, order.id,
        d.enquiry ? "Website" : "Operations Manager",
        d.enquiry ? "Price request came in from the website" : "Order created and job card opened"),
      unseen: { ...s.unseen, admin: [order.id, ...(s.unseen.admin ?? [])] },
    }));
    return order;
  }, [patch, notify]);

  /**
   * Apply a change to one order. When the guard inside `fn` refuses the move it
   * hands the same object straight back, and nothing else runs: no history line,
   * and above all no message to a customer about something that did not happen.
   */
  const mutate = useCallback(
    (orderId: string, fn: (o: Order) => Order, after?: (s: Snapshot, o: Order) => Snapshot) => {
      patch(s => {
        const i = s.orders.findIndex(o => o.id === orderId);
        if (i < 0) return s;
        const updated = fn(s.orders[i]);
        if (updated === s.orders[i]) return s;
        const orders = [...s.orders];
        orders[i] = updated;
        const next = { ...s, orders };
        return after ? after(next, updated) : next;
      });
    }, [patch]);

  const claimStage = useCallback((orderId: string, dept: DeptId, who: string) => {
    mutate(orderId,
      o => workable(o, dept, "queued") === false ? o : ({
        ...o,
        stages: o.stages.map(st =>
          st.dept === dept ? { ...st, status: "in_progress" as const, assignee: who, startedAt: Date.now() } : st),
      }),
      (s, o) => ({ ...s, events: log(s, o.id, who, `Picked up in ${deptById(dept).name}`) }));
  }, [mutate]);

  const finishStage = useCallback((orderId: string, dept: DeptId, who: string) => {
    mutate(orderId,
      o => workable(o, dept) === false ? o : ({
        ...o,
        stages: o.stages.map(st =>
          st.dept === dept ? { ...st, status: "done" as const, assignee: st.assignee ?? who, finishedAt: Date.now() } : st),
      }),
      (s, o) => {
        let next: Snapshot = { ...s, events: log(s, o.id, who, `${deptById(dept).name} finished`) };
        const nxt = currentStage(o);
        if (nxt) {
          // The next department's screen lights up, but only if it may actually
          // start. A station held behind the client's sign-off is not told a job
          // has landed, because it cannot touch it yet.
          if (stageUnlocked(o, nxt.dept)) {
            next = { ...next, unseen: { ...next.unseen, [nxt.dept]: [o.id, ...(next.unseen[nxt.dept] ?? [])] } };
          }
          // Design finishing an in-house job means a proof is waiting on the client.
          // A revised proof comes back as "changes_requested", and must go out too.
          if (dept === "design" && (o.approval === "pending" || o.approval === "changes_requested")) {
            next = {
              ...next,
              orders: next.orders.map(x => x.id === o.id ? { ...x, approval: "pending" as const } : x),
              messages: notify(next, { ...o, approval: "pending" }, "proof_ready"),
            };
          }
        }
        if (isComplete(o)) {
          if (o.fulfilment === "collection") {
            next = { ...next, messages: notify(next, o, "ready_collection") };
          } else {
            next = { ...next, orders: next.orders.map(x => x.id === o.id ? { ...x, delivery: "packed" as const } : x) };
          }
        }
        return next;
      });
  }, [mutate, notify]);

  const approveDesign = useCallback((orderId: string) => {
    mutate(orderId,
      o => proofIsOut(o) === false ? o : ({ ...o, approval: "approved" as const }),
      (s, o) => {
        const next: Snapshot = {
          ...s,
          messages: notify(s, o, "in_production"),
          events: log(s, o.id, o.customer, "Client approved the proof"),
        };
        // The sign-off is what releases the next room, so that is when its
        // screen must light up. Nothing told it before this.
        const nxt = currentStage(o);
        if (nxt && stageUnlocked(o, nxt.dept)) {
          return { ...next, unseen: { ...next.unseen, [nxt.dept]: [o.id, ...(next.unseen[nxt.dept] ?? [])] } };
        }
        return next;
      });
  }, [mutate, notify]);

  const requestChanges = useCallback((orderId: string, note: string) => {
    mutate(orderId, o => {
      if (proofIsOut(o) === false) return o;
      const used = o.revisionsUsed + 1;
      const charged = used > FREE_REVISIONS;
      return {
        ...o,
        approval: "changes_requested" as const,
        revisionsUsed: used,
        total: charged ? o.total + EXTRA_REVISION_FEE : o.total,
        // Design re-opens, and anything already made from the old artwork goes
        // back with it. Shipping work printed from a superseded proof is the
        // exact failure this gate exists to prevent.
        stages: o.stages.map(st =>
          st.dept === "design" || downstreamOfDesign(o).includes(st.dept)
            ? { ...st, status: "queued" as const, assignee: undefined, startedAt: undefined, finishedAt: undefined }
            : st),
        notes: note ? `${note}${o.notes ? ` · ${o.notes}` : ""}` : o.notes,
      };
    }, (s, o) => {
      let next: Snapshot = {
        ...s,
        events: log(s, o.id, o.customer, `Change ${o.revisionsUsed} requested: ${note || "see notes"}`),
        unseen: { ...s.unseen, design: [o.id, ...(s.unseen.design ?? [])] },
      };
      if (o.revisionsUsed > FREE_REVISIONS) next = { ...next, messages: notify(next, o, "revision_charged") };
      return next;
    });
  }, [mutate, notify]);

  /**
   * Refuses more than the job is worth. Quietly clipping an overpayment to the
   * total loses the difference with no record of it anywhere, which is the one
   * thing an accounts desk must never do.
   */
  const takePayment = useCallback((
    orderId: string, amount: number,
    extra?: { method?: Payment["method"]; slip?: Payment["slip"]; takenBy?: string },
  ) => {
    if (Number.isFinite(amount) === false || amount <= 0) return;
    mutate(orderId,
      o => amount > balanceOf(o) ? o : ({
        ...o,
        deposit: o.deposit + amount,
        payments: [{
          id: nid("pay"), amount, at: Date.now(),
          takenBy: extra?.takenBy ?? "Keneilwe",
          method: extra?.method ?? "cash",
          slip: extra?.slip,
        }, ...(o.payments ?? [])],
      }),
      (s, o) => ({
        ...s,
        events: log(s, o.id, "Accounts",
          `${o.payments?.[0]?.method ?? "cash"} payment recorded${o.payments?.[0]?.slip ? " with a slip attached" : ""}. Account now at ${o.deposit} of ${o.total}`),
      }));
  }, [mutate]);

  /** Raise the invoice in Odoo. One server call in the real build. */
  const sendToOdoo = useCallback(async (orderId: string) => {
    const o = snapRef.current.orders.find(x => x.id === orderId);
    if (!o) return { ok: false, message: "No such job." };
    const res = await pushToOdoo(o.odooRef);
    mutate(orderId, x => ({ ...x, odooSynced: res.ok }),
      (s, x) => ({ ...s, events: log(s, x.id, "Accounts", res.message) }));
    return res;
  }, [mutate]);

  const dispatchOrder = useCallback((orderId: string, driver: string) => {
    mutate(orderId,
      o => (o.fulfilment !== "delivery" || isComplete(o) === false || o.delivery !== "packed")
        ? o
        : ({ ...o, delivery: "out_for_delivery" as const, driver }),
      (s, o) => ({
        ...s,
        messages: notify(s, o, "out_for_delivery"),
        events: log(s, o.id, driver, "Left the shop for delivery"),
      }));
  }, [mutate, notify]);

  const markDelivered = useCallback((orderId: string) => {
    mutate(orderId,
      o => o.delivery !== "out_for_delivery" ? o : ({ ...o, delivery: "delivered" as const }),
      (s, o) => ({
        ...s,
        messages: notify(s, o, "delivered"),
        events: log(s, o.id, o.driver ?? "Driver", "Delivered and signed for"),
      }));
  }, [mutate, notify]);

  const markCollected = useCallback((orderId: string) => {
    mutate(orderId,
      o => (o.fulfilment !== "collection" || isComplete(o) === false || o.collectedAt !== undefined)
        ? o
        : ({ ...o, collectedAt: Date.now() }),
      (s, o) => ({ ...s, events: log(s, o.id, "Front desk", "Collected by the customer") }));
  }, [mutate]);

  /**
   * Rule 10: chase every job that has run past its promised date, in one sweep.
   * A job is chased at most once every CHASE_GAP, so pressing the button twice
   * does not text the same customer twice.
   */
  const chaseOverdue = useCallback(() => {
    // Work out who is due a chase from the current snapshot, not inside the
    // state updater, which React may run more than once.
    const now = Date.now();
    const cutoff = now - CHASE_GAP;
    const chasedRecently = new Set(
      snapRef.current.messages
        .filter(m => m.kind === "overdue_reminder" && m.sentAt > cutoff)
        .map(m => m.orderId),
    );
    // A job sitting on the customer's own proof is late because of them, so an
    // apology from us reads as nonsense. Those are left for the manager.
    const due = snapRef.current.orders.filter(
      o => isOverdue(o, now) && chasedRecently.has(o.id) === false && proofIsOut(o) === false,
    );
    if (due.length === 0) return 0;

    const dueIds = new Set(due.map(o => o.id));
    patch(s => {
      let next = s;
      for (const o of s.orders.filter(x => dueIds.has(x.id))) {
        next = {
          ...next,
          messages: notify(next, o, "overdue_reminder"),
          events: log(next, o.id, "Auto-reminder", "Overdue chase sent to the customer"),
        };
      }
      return next;
    });
    return due.length;
  }, [patch, notify]);

  /** The front desk has priced a website enquiry, so it becomes a real job. */
  const convertEnquiry = useCallback((orderId: string) => {
    patch(s => ({ ...s, orders: s.orders.filter(o => o.id !== orderId) }));
  }, [patch]);

  /**
   * Chase ONE customer, because the manager decided to. Replaces firing messages
   * at everybody: most late jobs are late waiting on the customer's own approval,
   * and apologising to them for that reads badly.
   */
  const chaseOne = useCallback((orderId: string) => {
    mutate(orderId, o => ({ ...o }),
      (s, o) => ({
        ...s,
        messages: notify(s, o, "overdue_reminder"),
        events: log(s, o.id, "Front desk", "Customer chased about the delay"),
      }));
  }, [mutate, notify]);

  const acknowledge = useCallback((dept: DeptId) => {
    patch(s => (s.unseen[dept]?.length ? { ...s, unseen: { ...s.unseen, [dept]: [] } } : s));
  }, [patch]);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* private browsing */
    }
    setSnap({ orders: SEED(), messages: [], events: [], unseen: {} });
  }, []);

  const value = useMemo<Store>(() => ({
    ...snap, createOrder, claimStage, finishStage, approveDesign, requestChanges,
    takePayment, dispatchOrder, markDelivered, markCollected, chaseOverdue, chaseOne,
    sendToOdoo, convertEnquiry, acknowledge, reset,
  }), [snap, createOrder, claimStage, finishStage, approveDesign, requestChanges,
    takePayment, dispatchOrder, markDelivered, markCollected, chaseOverdue, chaseOne,
    sendToOdoo, convertEnquiry, acknowledge, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}

/** Everything a given department screen may see, and nothing else (rule 5). */
export function useDeptQueue(dept: DeptId) {
  const { orders } = useStore();
  return useMemo(() => {
    const mine = orders.filter(o =>
      o.enquiry !== true && o.route.includes(dept) && !o.collectedAt && o.delivery !== "delivered");
    const at = (o: Order) => o.stages.find(s => s.dept === dept)!;
    const byDue = (a: Order, b: Order) => a.dueAt - b.dueAt;
    return {
      working: mine.filter(o => at(o).status === "in_progress").sort(byDue),
      waiting: mine.filter(o => at(o).status === "queued" && currentStage(o)?.dept === dept).sort(byDue),
      upstream: mine.filter(o => at(o).status === "queued" && currentStage(o)?.dept !== dept).sort(byDue),
      done: mine.filter(o => at(o).status === "done")
        .sort((a, b) => (at(b).finishedAt ?? 0) - (at(a).finishedAt ?? 0)),
    };
  }, [orders, dept]);
}

export const jobTitle = (o: Order) => `${orderTypeById(o.type).name} · ${o.qty}`;
