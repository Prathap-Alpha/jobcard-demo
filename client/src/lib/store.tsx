/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  EXTRA_REVISION_FEE, FREE_REVISIONS, buildStages, currentStage, deptById, isComplete,
  isOverdue, orderTypeById, type DeptId, type Order,
} from "./domain";
import { compose, type Channel, type Message, type MessageKind } from "./messages";
import { SEED } from "./seed";

const LS_KEY = "jobcard.demo.v1";

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
  takePayment: (orderId: string, amount: number) => void;
  dispatchOrder: (orderId: string, driver: string) => void;
  markDelivered: (orderId: string) => void;
  markCollected: (orderId: string) => void;
  chaseOverdue: () => number;
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(load);

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
    const order: Order = {
      id: `JC-2609-${String(Math.floor(Math.random() * 900) + 100)}`,
      odooRef: `SO-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      odooSynced: true,
      customer: d.customer, contact: d.contact, email: d.email,
      type: d.type, description: d.description, qty: d.qty,
      route: d.route, stages: buildStages(d.route),
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
      messages: notify(s, order, "received"),
      events: log(s, order.id, "Operations Manager", "Order created and job card opened"),
      unseen: { ...s.unseen, admin: [order.id, ...(s.unseen.admin ?? [])] },
    }));
    return order;
  }, [patch, notify]);

  const mutate = useCallback(
    (orderId: string, fn: (o: Order) => Order, after?: (s: Snapshot, o: Order) => Snapshot) => {
      patch(s => {
        const i = s.orders.findIndex(o => o.id === orderId);
        if (i < 0) return s;
        const updated = fn(s.orders[i]);
        const orders = [...s.orders];
        orders[i] = updated;
        const next = { ...s, orders };
        return after ? after(next, updated) : next;
      });
    }, [patch]);

  const claimStage = useCallback((orderId: string, dept: DeptId, who: string) => {
    mutate(orderId,
      o => ({
        ...o,
        stages: o.stages.map(st =>
          st.dept === dept ? { ...st, status: "in_progress" as const, assignee: who, startedAt: Date.now() } : st),
      }),
      (s, o) => ({ ...s, events: log(s, o.id, who, `Picked up in ${deptById(dept).name}`) }));
  }, [mutate]);

  const finishStage = useCallback((orderId: string, dept: DeptId, who: string) => {
    mutate(orderId,
      o => ({
        ...o,
        stages: o.stages.map(st =>
          st.dept === dept ? { ...st, status: "done" as const, assignee: st.assignee ?? who, finishedAt: Date.now() } : st),
      }),
      (s, o) => {
        let next: Snapshot = { ...s, events: log(s, o.id, who, `${deptById(dept).name} finished`) };
        const nxt = currentStage(o);
        if (nxt) {
          // The next department's screen lights up. That is the staff notification (rule 7).
          next = { ...next, unseen: { ...next.unseen, [nxt.dept]: [o.id, ...(next.unseen[nxt.dept] ?? [])] } };
          // Design finishing an in-house job means a proof is now waiting on the client.
          if (dept === "design" && o.approval === "pending") {
            next = { ...next, messages: notify(next, o, "proof_ready") };
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
    mutate(orderId, o => ({ ...o, approval: "approved" as const }),
      (s, o) => ({
        ...s,
        messages: notify(s, o, "in_production"),
        events: log(s, o.id, o.customer, "Client approved the proof"),
      }));
  }, [mutate, notify]);

  const requestChanges = useCallback((orderId: string, note: string) => {
    mutate(orderId, o => {
      const used = o.revisionsUsed + 1;
      const charged = used > FREE_REVISIONS;
      return {
        ...o,
        approval: "changes_requested" as const,
        revisionsUsed: used,
        total: charged ? o.total + EXTRA_REVISION_FEE : o.total,
        // The job goes back to Design and that stage re-opens.
        stages: o.stages.map(st => st.dept === "design" ? { ...st, status: "queued" as const, finishedAt: undefined } : st),
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

  const takePayment = useCallback((orderId: string, amount: number) => {
    mutate(orderId, o => ({ ...o, deposit: Math.min(o.total, o.deposit + amount) }),
      (s, o) => ({ ...s, events: log(s, o.id, "Accounts", `Payment recorded. Account now at ${o.deposit} of ${o.total}`) }));
  }, [mutate]);

  const dispatchOrder = useCallback((orderId: string, driver: string) => {
    mutate(orderId, o => ({ ...o, delivery: "out_for_delivery" as const, driver }),
      (s, o) => ({
        ...s,
        messages: notify(s, o, "out_for_delivery"),
        events: log(s, o.id, driver, "Left the shop for delivery"),
      }));
  }, [mutate, notify]);

  const markDelivered = useCallback((orderId: string) => {
    mutate(orderId, o => ({ ...o, delivery: "delivered" as const }),
      (s, o) => ({
        ...s,
        messages: notify(s, o, "delivered"),
        events: log(s, o.id, o.driver ?? "Driver", "Delivered and signed for"),
      }));
  }, [mutate, notify]);

  const markCollected = useCallback((orderId: string) => {
    mutate(orderId, o => ({ ...o, collectedAt: Date.now() }),
      (s, o) => ({ ...s, events: log(s, o.id, "Front desk", "Collected by the customer") }));
  }, [mutate]);

  /** Rule 10: chase every job that has run past its promised date, in one sweep. */
  const chaseOverdue = useCallback(() => {
    let n = 0;
    patch(s => {
      let next = s;
      for (const o of s.orders.filter(x => isOverdue(x))) {
        next = {
          ...next,
          messages: notify(next, o, "overdue_reminder"),
          events: log(next, o.id, "Auto-reminder", "Overdue chase sent to the customer"),
        };
        n++;
      }
      return next;
    });
    return n;
  }, [patch, notify]);

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
    takePayment, dispatchOrder, markDelivered, markCollected, chaseOverdue, acknowledge, reset,
  }), [snap, createOrder, claimStage, finishStage, approveDesign, requestChanges,
    takePayment, dispatchOrder, markDelivered, markCollected, chaseOverdue, acknowledge, reset]);

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
    const mine = orders.filter(o => o.route.includes(dept) && !o.collectedAt && o.delivery !== "delivered");
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
