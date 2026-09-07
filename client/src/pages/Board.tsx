import { useEffect, useState } from "react";
import { Mark } from "@/components/jc";
import {
  DEPTS, currentDept, deptById, hoursLeft, isComplete, isOverdue, orderTypeById,
  proofIsOut, type Order,
} from "@/lib/domain";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

/**
 * The wall board — the fast-food order screen the client asked for.
 * Meant to run full screen above the front counter: no controls, just the day.
 */
export default function Board() {
  const { orders } = useStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const live = orders.filter(o => !o.collectedAt && o.delivery !== "delivered");
  const ready = live.filter(o => isComplete(o));
  const holding = live.filter(o => proofIsOut(o) && !isComplete(o));
  const running = live
    .filter(o => !isComplete(o) && !proofIsOut(o))
    .sort((a, b) => a.dueAt - b.dueAt);
  const late = live.filter(o => isOverdue(o, now));

  return (
    <div className="min-h-screen bg-[oklch(0.155_0.012_262)] text-white paper-grid">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-white/10 px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="text-white"><Mark /></Link>
        <div className="flex flex-1 items-baseline justify-between gap-4 sm:flex-none sm:justify-start sm:gap-8">
          <BoardStat n={running.length} label="in production" />
          <BoardStat n={holding.length} label="waiting on client" tone="var(--warn)" />
          <BoardStat n={ready.length} label="ready" tone="var(--ok)" />
          <BoardStat n={late.length} label="overdue" tone={late.length ? "var(--late)" : undefined} />
        </div>
        <p className="tnum hidden font-mono text-2xl font-bold tabular-nums sm:block">
          {new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      <div className="grid gap-6 px-5 py-6 sm:px-8 sm:py-7 xl:grid-cols-[1.6fr_1fr]">
        <section>
          <BoardHead>On the floor</BoardHead>
          <div className="grid gap-3 md:grid-cols-2">
            {running.length === 0 && <p className="text-white/40">Nothing in production.</p>}
            {running.slice(0, 12).map(o => <BoardRow key={o.id} o={o} now={now} />)}
          </div>
        </section>

        <div className="space-y-7">
          <section>
            <BoardHead tone="var(--ok)">Ready — call the customer</BoardHead>
            <div className="space-y-3">
              {ready.length === 0 && <p className="text-white/40">Nothing waiting for collection.</p>}
              {ready.slice(0, 6).map(o => (
                <div key={o.id} className="rounded-xl border border-[color-mix(in_oklch,var(--ok)_45%,transparent)] bg-[color-mix(in_oklch,var(--ok)_12%,transparent)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-bold text-white/60">{o.id}</span>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--ok)" }}>
                      {o.fulfilment === "delivery" ? (o.delivery === "out_for_delivery" ? "OUT FOR DELIVERY" : "TO DELIVER") : "COLLECT"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-display text-lg font-bold">{o.customer}</p>
                  <p className="truncate text-[13px] text-white/55">{orderTypeById(o.type).name} · {o.qty}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <BoardHead tone="var(--warn)">Held — customer must approve</BoardHead>
            <div className="space-y-2">
              {holding.length === 0 && <p className="text-white/40">No proofs outstanding.</p>}
              {holding.slice(0, 6).map(o => (
                <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{o.customer}</p>
                    <p className="truncate text-[12px] text-white/50">{o.description}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-white/45">{o.id}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 px-5 py-4 sm:px-8">
        {DEPTS.map(d => {
          const n = live.filter(o => currentDept(o) === d.id).length;
          return (
            <span key={d.id} className="inline-flex items-center gap-2 text-[13px]">
              <span className="size-2.5 rounded-full" style={{ background: d.hue }} />
              <span className="text-white/60">{d.name}</span>
              <span className="tnum font-bold">{n}</span>
            </span>
          );
        })}
        <Link href="/ops" className="ml-auto text-[12px] text-white/40 hover:text-white/80">back to the front desk</Link>
      </footer>
    </div>
  );
}

function BoardStat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className="text-center">
      <p className="tnum font-display text-3xl font-bold leading-none" style={{ color: tone ?? "white" }}>{n}</p>
      <p className="mt-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-white/45 sm:text-[11px]">{label}</p>
    </div>
  );
}

function BoardHead({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: tone ?? "rgba(255,255,255,.5)" }}>
      <span className="h-3 w-1 rounded-full" style={{ background: tone ?? "rgba(255,255,255,.3)" }} />
      {children}
    </h2>
  );
}

function BoardRow({ o, now }: { o: Order; now: number }) {
  const here = currentDept(o)!;
  const d = deptById(here);
  const late = isOverdue(o, now);
  const h = hoursLeft(o, now);
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl bg-white/[0.055] px-4 py-3.5", late && "bg-[color-mix(in_oklch,var(--late)_16%,transparent)]")}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: d.hue }} />
      <div className="flex items-center justify-between gap-3 pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-white/50">{o.id}</span>
            {o.priority === "rush" && (
              <span className="rounded px-1.5 text-[10px] font-bold" style={{ background: "var(--late)" }}>RUSH</span>
            )}
          </div>
          <p className="mt-0.5 truncate font-display text-[17px] font-bold leading-tight">{o.customer}</p>
          <p className="truncate text-[12.5px] text-white/55">{orderTypeById(o.type).name} · {o.qty} · {o.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-bold" style={{ color: d.hue }}>{d.name}</p>
          <p className="tnum mt-0.5 text-[12px]" style={{ color: late ? "var(--late)" : "rgba(255,255,255,.5)" }}>
            {late ? `${Math.abs(h)}h late` : `${h}h left`}
          </p>
        </div>
      </div>
    </div>
  );
}
