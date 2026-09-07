import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import {
  Btn, Chip, DeptDot, Empty, JobCard, PageHead, RouteRail, SectionTitle, Shell, Stat,
} from "@/components/jc";
import {
  DEPTS, PRE_APPROVAL_DEPTS, currentDept, deptById, fmtDue, isOverdue, orderTypeById, productionBlocked,
  stageUnlocked, type DeptId, type Order,
} from "@/lib/domain";
import { useDeptQueue, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/* The index: pick a screen. Each department has one shared screen, no personal logins. */
export function Floor() {
  const { orders, unseen } = useStore();
  return (
    <Shell>
      <PageHead
        title="Department screens"
        sub="Seven screens, one per department. No individual logins. The screen lives on the wall of that room and shows only that room's work."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEPTS.map(d => {
          const mine = orders.filter(o => o.route.includes(d.id) && !o.collectedAt && o.delivery !== "delivered");
          const here = mine.filter(o => currentDept(o) === d.id);
          const late = here.filter(o => isOverdue(o)).length;
          const alerts = unseen[d.id]?.length ?? 0;
          return (
            <Link
              key={d.id} href={`/floor/${d.id}`}
              className="group relative overflow-hidden rounded-2xl border bg-card p-5 card-lift"
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: d.hue }} />
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <DeptDot dept={d.id} size={10} />
                    <h3 className="font-display text-lg font-bold">{d.name}</h3>
                    {d.mandatory && <Chip tone="muted">every job</Chip>}
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">{d.staff.join(", ")}</p>
                </div>
                {alerts > 0 && (
                  <span className="tnum grid size-7 place-items-center rounded-full text-[12px] font-bold text-white jc-pulse" style={{ background: d.hue }}>
                    {alerts}
                  </span>
                )}
              </div>
              <div className="mt-5 flex items-end gap-6">
                <div>
                  <p className="tnum font-display text-3xl font-bold leading-none">{here.length}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">in this queue</p>
                </div>
                {late > 0 && (
                  <div>
                    <p className="tnum font-display text-3xl font-bold leading-none" style={{ color: "var(--late)" }}>{late}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">overdue</p>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}

/* One department's screen. */
export default function Dept() {
  const [, params] = useRoute("/floor/:id");
  const id = (params?.id ?? "admin") as DeptId;
  const valid = DEPTS.some(d => d.id === id);
  const dept = valid ? deptById(id) : DEPTS[0];
  const q = useDeptQueue(dept.id);
  const { claimStage, finishStage, unseen, acknowledge } = useStore();
  const [who, setWho] = useState(dept.staff[0]);

  useEffect(() => { setWho(dept.staff[0]); }, [dept.id, dept.staff]);

  const alerts = unseen[dept.id] ?? [];
  useEffect(() => {
    if (!alerts.length) return;
    const t = setTimeout(() => acknowledge(dept.id), 6000);
    return () => clearTimeout(t);
  }, [alerts.length, acknowledge, dept.id]);

  const blocked = useMemo(
    () => q.waiting.filter(o => !stageUnlocked(o, dept.id)),
    [q.waiting, dept.id],
  );
  const workable = useMemo(
    () => q.waiting.filter(o => stageUnlocked(o, dept.id)),
    [q.waiting, dept.id],
  );

  if (!valid) {
    return <Shell><Empty>No such department screen.</Empty></Shell>;
  }

  return (
    <Shell>
      {/* The staff notification: a new job simply appears on this screen (rule 7). */}
      {alerts.length > 0 && (
        <div
          className="mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 jc-in"
          style={{ borderColor: dept.hue, background: `color-mix(in oklch, ${dept.hue} 8%, white)` }}
        >
          <span className="size-2.5 rounded-full jc-pulse" style={{ background: dept.hue }} />
          <p className="text-[14px] font-semibold">
            {alerts.length} new job{alerts.length > 1 ? "s" : ""} just landed in {dept.name}
          </p>
          <span className="font-mono text-[12px] text-muted-foreground">{alerts.slice(0, 4).join("  ")}</span>
          <Btn variant="ghost" size="sm" className="ml-auto" onClick={() => acknowledge(dept.id)}>Got it</Btn>
        </div>
      )}

      <PageHead
        title={`${dept.name} screen`}
        sub={`Only ${dept.name}'s jobs and their deadlines. Nobody on this screen can see the full order book, prices or other departments' work.`}
        actions={
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Working as</span>
            <select
              value={who} onChange={e => setWho(e.target.value)}
              className="h-9 rounded-lg border bg-card px-3 text-[13px] font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              {dept.staff.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {DEPTS.map(d => (
          <Link
            key={d.id} href={`/floor/${d.id}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-all",
              d.id === dept.id ? "text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            style={d.id === dept.id ? { borderColor: d.hue, background: `color-mix(in oklch, ${d.hue} 10%, white)` } : undefined}
          >
            <DeptDot dept={d.id} />
            {d.name}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="On my bench now" value={q.working.length} hint="Started, not finished" />
        <Stat label="Waiting for me" value={workable.length} hint="Ready to pick up" />
        <Stat label="Overdue in my queue" value={[...q.working, ...workable].filter(o => isOverdue(o)).length} tone="late" hint="Past the promised date" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Column title="On the bench" count={q.working.length} accent={dept.hue}>
          {q.working.length === 0 ? <Empty>Nothing started yet.</Empty> :
            q.working.map(o => (
              <JobCard key={o.id} order={o} dense showMoney={false}>
                <Chip tone="ink">{o.stages.find(s => s.dept === dept.id)?.assignee}</Chip>
                <Btn size="sm" onClick={() => { finishStage(o.id, dept.id, who); toast.success(`${o.id} finished in ${dept.name}`, { description: nextHop(o, dept.id) }); }}>
                  Finish
                </Btn>
              </JobCard>
            ))}
        </Column>

        <Column title="Waiting for us" count={workable.length} accent={dept.hue}>
          {workable.length === 0 ? <Empty>Queue is clear.</Empty> :
            workable.map(o => (
              <JobCard key={o.id} order={o} dense showMoney={false}>
                <Btn size="sm" variant="soft" onClick={() => { claimStage(o.id, dept.id, who); toast.message(`${who} picked up ${o.id}`); }}>
                  Start
                </Btn>
              </JobCard>
            ))}
        </Column>

        <Column title="Coming to us" count={blocked.length + q.upstream.length} accent="var(--border)">
          {blocked.length + q.upstream.length === 0 ? <Empty>Nothing upstream.</Empty> : (
            <>
              {blocked.map(o => (
                <div key={o.id} className="rounded-xl border border-dashed bg-card/60 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">{o.id}</span>
                    <Chip tone="warn">held: client must approve the proof</Chip>
                  </div>
                  <p className="mt-1 truncate text-[13.5px] font-semibold">{o.customer}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">{orderTypeById(o.type).name} · {o.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <RouteRail order={o} compact />
                    <span className="text-[11px] text-muted-foreground">{fmtDue(o.dueAt)}</span>
                  </div>
                </div>
              ))}
              {q.upstream.map(o => (
                <div key={o.id} className="rounded-xl border bg-card/60 px-3.5 py-3 opacity-80">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">{o.id}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      at <DeptDot dept={currentDept(o)!} /> {deptById(currentDept(o)!).name}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[13.5px] font-semibold">{o.customer}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">{orderTypeById(o.type).name} · {o.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <RouteRail order={o} compact />
                    <span className="text-[11px] text-muted-foreground">{fmtDue(o.dueAt)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </Column>
      </div>

      {q.done.length > 0 && (
        <div className="mt-8">
          <SectionTitle count={q.done.length}>Finished by {dept.name} today</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-3 [&>*]:min-w-0">
            {q.done.slice(0, 6).map(o => (
              <JobCard key={o.id} order={o} dense showMoney={false}>
                <Chip tone="ok">done by {o.stages.find(s => s.dept === dept.id)?.assignee ?? "—"}</Chip>
              </JobCard>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

function nextHop(o: Order, from: DeptId) {
  const i = o.route.indexOf(from);
  const next = o.route[i + 1];
  if (!next) return "Job complete. The customer has been messaged.";
  if (productionBlocked(o) && !PRE_APPROVAL_DEPTS.includes(next)) return "Proof sent to the customer for approval.";
  return `Now showing on the ${deptById(next).name} screen.`;
}

function Column({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3 w-1 rounded-full" style={{ background: accent }} />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{title}</h2>
        <span className="tnum rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
