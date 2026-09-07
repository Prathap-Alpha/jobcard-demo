import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Btn, Chip, DeptDot, Empty, PageHead, RouteRail, Shell, Stat } from "@/components/jc";
import {
  balanceOf, currentDept, deptById, fmtDue, fmtP, heldBy, hoursLeft, isOverdue,
  orderTypeById, type Order,
} from "@/lib/domain";
import { useStore } from "@/lib/store";

/**
 * The morning overdue list — the client asked for automatic reminders but said
 * they were open to a better idea. This is it.
 *
 * The system does not text anybody on its own. Every late job is listed with who
 * is actually holding it up, and the manager chases with one press. A large share
 * of late jobs are late because the CUSTOMER has not approved their own artwork,
 * and an automatic apology to that customer reads badly and teaches them to
 * ignore the messages. Ten seconds of a manager's morning avoids all of it.
 */
export default function Overdue() {
  const { orders, messages, chaseOne } = useStore();
  const [, nav] = useLocation();
  const [justChased, setJustChased] = useState<string[]>([]);

  const late = useMemo(
    () => orders.filter(o => !o.enquiry && isOverdue(o)).sort((a, b) => a.dueAt - b.dueAt),
    [orders],
  );
  const ours = late.filter(o => heldBy(o).who === "us");
  const theirs = late.filter(o => heldBy(o).who === "customer");

  const chasedToday = (id: string) => {
    const cutoff = Date.now() - 6 * 3_600_000;
    return justChased.includes(id)
      || messages.some(m => m.orderId === id && m.kind === "overdue_reminder" && m.sentAt > cutoff);
  };

  const chase = (o: Order) => {
    chaseOne(o.id);
    setJustChased(p => [...p, o.id]);
    toast.success(`${o.customer} chased`, { description: `Text and email sent about ${o.id}.` });
  };

  const chaseAllOurs = () => {
    const todo = ours.filter(o => !chasedToday(o.id));
    if (todo.length === 0) return toast.message("Everything on our side has already been chased today");
    todo.forEach(o => chaseOne(o.id));
    setJustChased(p => [...p, ...todo.map(o => o.id)]);
    toast.success(`${todo.length} customer${todo.length > 1 ? "s" : ""} chased`, {
      description: "Only the jobs the delay is ours on.",
    });
  };

  return (
    <Shell>
      <PageHead
        title="Overdue desk"
        sub="Every job past its promised time, and who is actually holding it up. Nothing is sent until you press chase, so a customer is never apologised to for a delay they caused."
        actions={ours.length > 0 && <Btn onClick={chaseAllOurs}>Chase all {ours.length} that are ours</Btn>}
      />

      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <Stat label="Late in total" value={late.length} tone={late.length ? "late" : undefined} hint="Past the promised time" />
        <Stat label="The delay is ours" value={ours.length} hint="These are the ones to apologise for" tone={ours.length ? "warn" : undefined} />
        <Stat label="Waiting on the customer" value={theirs.length} hint="Do not apologise, remind them instead" />
      </div>

      {late.length === 0 && <Empty>Nothing is late. Good morning.</Empty>}

      {ours.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-3 w-1 rounded-full" style={{ background: "var(--late)" }} />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              The delay is ours
            </h2>
            <span className="text-[12.5px] text-muted-foreground">apologise and give a new time</span>
          </div>
          <div className="space-y-3">
            {ours.map(o => <Row key={o.id} o={o} done={chasedToday(o.id)} onChase={() => chase(o)} onOpen={() => nav(`/client?job=${o.id}`)} />)}
          </div>
        </section>
      )}

      {theirs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-3 w-1 rounded-full" style={{ background: "var(--warn)" }} />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              Waiting on the customer
            </h2>
            <span className="text-[12.5px] text-muted-foreground">
              nudge them if you like, but this is not our delay
            </span>
          </div>
          <div className="space-y-3">
            {theirs.map(o => <Row key={o.id} o={o} done={chasedToday(o.id)} onChase={() => chase(o)} onOpen={() => nav(`/client?job=${o.id}`)} theirs />)}
          </div>
        </section>
      )}
    </Shell>
  );
}

function Row({
  o, done, onChase, onOpen, theirs = false,
}: { o: Order; done: boolean; onChase: () => void; onOpen: () => void; theirs?: boolean }) {
  const held = heldBy(o);
  const here = currentDept(o);
  const bal = balanceOf(o);
  return (
    <article className="rounded-xl border bg-card p-4" style={{ borderColor: theirs ? undefined : "color-mix(in oklch, var(--late) 35%, var(--border))" }}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-muted-foreground">{o.id}</span>
            {o.priority === "rush" && <Chip tone="late">RUSH</Chip>}
            <Chip tone="late">{Math.abs(hoursLeft(o))}h late</Chip>
          </div>
          <button type="button" onClick={onOpen} className="mt-1 block truncate text-left font-display text-base font-bold hover:underline">
            {o.customer}
          </button>
          <p className="truncate text-[13px] text-muted-foreground">
            {orderTypeById(o.type).name} · {o.qty} · {o.description}
          </p>
          <p className="mt-1.5 text-[13px]">
            <span className="text-muted-foreground">Held up because the </span>
            <strong>{held.who === "us" ? "shop" : "customer"}</strong>
            <span className="text-muted-foreground"> {held.reason}.</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] text-muted-foreground">promised {fmtDue(o.dueAt)}</p>
          {here && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
              <DeptDot dept={here} />{deptById(here).name}
            </p>
          )}
          {bal > 0 && <p className="tnum mt-1 text-[12px] text-muted-foreground">{fmtP(bal)} owing</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <RouteRail order={o} compact />
        {done
          ? <Chip tone="ok">chased, nothing further today</Chip>
          : <Btn size="sm" variant={theirs ? "soft" : "solid"} onClick={onChase}>
            {theirs ? "Remind the customer" : "Apologise and chase"}
          </Btn>}
      </div>
    </article>
  );
}
