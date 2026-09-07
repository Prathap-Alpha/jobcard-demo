import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "wouter";
import { toast } from "sonner";
import { Btn, Chip, DeptDot, Empty, Mark, PageHead, Shell, StateBadge } from "@/components/jc";
import {
  DEPTS, EXTRA_REVISION_FEE, FREE_REVISIONS, STATE_LABEL, balanceOf, currentDept, deptById,
  fmtDue, fmtP, isOverdue, orderState, orderTypeById, type Order,
} from "@/lib/domain";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** What the customer sees on their phone: one job, its progress, and what they owe. */
export default function Client() {
  const { orders, events, approveDesign, requestChanges } = useStore();
  const [params, setParams] = useSearchParams();
  const wanted = params.get("job");
  const [note, setNote] = useState("");

  const tracked = useMemo(
    () => orders.filter(o => !o.collectedAt && o.delivery !== "delivered"),
    [orders],
  );
  const order = orders.find(o => o.id === wanted) ?? tracked[0];

  useEffect(() => { setNote(""); }, [order?.id]);

  if (!order) return <Shell><Empty>No jobs to track.</Empty></Shell>;

  const bal = balanceOf(order);
  const here = currentDept(order);
  const trail = events.filter(e => e.orderId === order.id).slice(0, 8);
  const needsApproval = order.approval === "pending" || order.approval === "changes_requested";
  const freeLeft = Math.max(0, FREE_REVISIONS - order.revisionsUsed);

  return (
    <Shell>
      <PageHead
        title="Customer view"
        sub="The same job as the customer sees it on their phone. This is where the design gets signed off, and nothing goes to the machines until they press approve."
        actions={
          <select
            value={order.id}
            onChange={e => setParams({ job: e.target.value })}
            className="h-9 max-w-[280px] rounded-lg border bg-card px-3 text-[13px] font-medium outline-none focus:ring-2 focus:ring-ring"
          >
            {tracked.map(o => <option key={o.id} value={o.id}>{o.id} — {o.customer}</option>)}
          </select>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] [&>*]:min-w-0">
        {/* the phone */}
        <div className="rounded-[28px] border-8 border-[oklch(0.22_0.012_262)] bg-card p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <Mark />
            <span className="font-mono text-[11px] text-muted-foreground">{order.id}</span>
          </div>

          <h2 className="font-display text-xl font-bold leading-tight">{order.description}</h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {orderTypeById(order.type).name} · {order.qty} · for {order.customer}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StateBadge order={order} />
            {isOverdue(order) ? <Chip tone="late">running late</Chip> : <Chip tone="muted">promised {fmtDue(order.dueAt)}</Chip>}
          </div>

          {/* progress the customer understands, in words not codes */}
          <ol className="mt-5 space-y-0">
            {order.route.map((r, i) => {
              const st = order.stages[i];
              const d = deptById(r);
              const active = here === r;
              return (
                <li key={r} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2"
                      style={{
                        borderColor: d.hue,
                        background: st.status === "done" ? d.hue : "transparent",
                        boxShadow: active ? `0 0 0 3px color-mix(in oklch, ${d.hue} 22%, transparent)` : undefined,
                      }}
                    />
                    {i < order.route.length - 1 && (
                      <span className="my-0.5 w-px flex-1" style={{ background: st.status === "done" ? d.hue : "var(--border)" }} />
                    )}
                  </div>
                  <div className={cn("pb-4", st.status === "queued" && !active && "opacity-45")}>
                    <p className="text-[13.5px] font-semibold leading-tight">{customerWord(d.id)}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {st.status === "done" ? `done${st.assignee ? ` · ${st.assignee}` : ""}`
                        : active ? "happening now" : "still to come"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="rounded-xl bg-muted px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Total</span>
              <span className="tnum font-semibold">{fmtP(order.total)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Paid</span>
              <span className="tnum font-semibold">{fmtP(order.deposit)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-[14px]">
              <span className="font-semibold">Still owing</span>
              <span className="tnum font-display font-bold" style={{ color: bal > 0 ? "var(--warn)" : "var(--ok)" }}>{fmtP(bal)}</span>
            </div>
          </div>

          {needsApproval && (
            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--dept-design)", background: "color-mix(in oklch, var(--dept-design) 7%, white)" }}>
              <p className="text-[13.5px] font-semibold">Your proof is ready</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {freeLeft > 0
                  ? `${freeLeft} free change${freeLeft > 1 ? "s" : ""} left. After that each change is ${fmtP(EXTRA_REVISION_FEE)}.`
                  : `Your ${FREE_REVISIONS} free changes are used. The next change adds ${fmtP(EXTRA_REVISION_FEE)}.`}
              </p>
              <div className="mt-3 aspect-[4/3] rounded-lg border border-dashed bg-background/60 paper-grid grid place-items-center">
                <span className="text-[12px] text-muted-foreground">proof preview</span>
              </div>
              <input
                value={note} onChange={e => setNote(e.target.value)} placeholder="What must change?"
                className="mt-3 h-9 w-full rounded-lg border bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-2.5 flex gap-2">
                <Btn className="flex-1" onClick={() => { approveDesign(order.id); toast.success("Approved — production can start"); }}>
                  Approve, go ahead
                </Btn>
                <Btn variant="soft" onClick={() => {
                  const charged = order.revisionsUsed + 1 > FREE_REVISIONS;
                  requestChanges(order.id, note);
                  setNote("");
                  toast.message("Change sent back to Design", {
                    description: charged ? `Change ${order.revisionsUsed + 1} — ${fmtP(EXTRA_REVISION_FEE)} added.` : "Still free.",
                  });
                }}>
                  Ask for a change
                </Btn>
              </div>
            </div>
          )}

          {order.fulfilment === "delivery" && (
            <div className="mt-4 rounded-xl border px-4 py-3">
              <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Delivery</p>
              <p className="mt-1 text-[13.5px]">{order.address}</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {order.delivery === "delivered" ? "Delivered and signed for"
                  : order.delivery === "out_for_delivery" ? `On the way with ${order.driver}`
                    : order.delivery === "packed" ? "Packed, waiting for a driver"
                      : "Will be booked once production finishes"}
              </p>
            </div>
          )}
        </div>

        {/* the shop's side of the same job */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-display text-base font-bold">What the shop sees</h3>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Row k="Status" v={STATE_LABEL[orderState(order)]} />
              <Row k="Sitting in" v={here ? deptById(here).name : "Finished"} />
              <Row k="Artwork" v={order.artwork === "in_house" ? "We designed it" : "Client supplied"} />
              <Row k="Changes used" v={`${order.revisionsUsed} (${FREE_REVISIONS} free)`} />
              <Row k="Odoo reference" v={order.odooRef} mono />
              <Row k="Odoo sync" v={order.odooSynced ? "In step" : "Pending"} />
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              {DEPTS.map(d => {
                const on = order.route.includes(d.id);
                return (
                  <span key={d.id} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]", !on && "opacity-35 line-through")}>
                    <DeptDot dept={d.id} />{d.name}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-display text-base font-bold">Job card history</h3>
            {trail.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted-foreground">Nothing logged on this job yet in this session. Move it through a department screen and it will appear here.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {trail.map(e => (
                  <li key={e.id} className="flex gap-3 text-[13px]">
                    <span className="tnum shrink-0 font-mono text-[11.5px] text-muted-foreground">
                      {new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex-1">{e.text}</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">{e.who}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className={cn("mt-0.5 text-[14px] font-medium", mono && "font-mono text-[13px]")}>{v}</dd>
    </div>
  );
}

/** Departments in the customer's language, not the shop's. */
function customerWord(d: Order["route"][number]) {
  return {
    admin: "Order booked in",
    design: "Design and proof",
    sublimation: "Printing and pressing",
    dtf: "Transfer printing",
    sewing: "Sewing",
    embroidery: "Embroidery",
    accounts: "Final check and invoice",
  }[d];
}
