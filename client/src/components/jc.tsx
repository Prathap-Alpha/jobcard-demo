import { Link, useLocation } from "wouter";
import {
  DEPTS, STATE_LABEL, balanceOf, currentDept, deptById, fmtP, hoursLeft, isOverdue,
  orderState, orderTypeById, type DeptId, type Order,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

/* ── wordmark ─────────────────────────────────────────────────────────────── */

export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-block size-6 shrink-0" aria-hidden>
        <span className="absolute left-0 top-0 size-4 rounded-full" style={{ background: "var(--dept-design)", opacity: 0.9 }} />
        <span className="absolute right-0 top-0 size-4 rounded-full mix-blend-multiply" style={{ background: "var(--dept-sublimation)", opacity: 0.8 }} />
        <span className="absolute bottom-0 left-1/2 size-4 -translate-x-1/2 rounded-full mix-blend-multiply" style={{ background: "var(--dept-sewing)", opacity: 0.8 }} />
      </span>
      <span className="font-display text-[1.05rem] font-bold tracking-tight">JobCard</span>
    </span>
  );
}

/* ── small parts ──────────────────────────────────────────────────────────── */

export function Chip({
  children, tone = "muted", className,
}: { children: React.ReactNode; tone?: "muted" | "ok" | "warn" | "late" | "ink"; className?: string }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    ok: "bg-[color-mix(in_oklch,var(--ok)_14%,white)] text-[var(--ok)]",
    warn: "bg-[color-mix(in_oklch,var(--warn)_18%,white)] text-[color-mix(in_oklch,var(--warn)_75%,black)]",
    late: "bg-[color-mix(in_oklch,var(--late)_12%,white)] text-[var(--late)]",
    ink: "bg-primary text-primary-foreground",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5", tones[tone], className)}>
      {children}
    </span>
  );
}

export function DeptDot({ dept, size = 8 }: { dept: DeptId; size?: number }) {
  return <span className="inline-block rounded-full" style={{ width: size, height: size, background: deptById(dept).hue }} />;
}

/**
 * All seven departments, always. The ones this job does not need are faded out,
 * which is how the floor sees at a glance that a job legitimately skips a station.
 */
export function RouteRail({ order, compact = false }: { order: Order; compact?: boolean }) {
  const here = currentDept(order);
  return (
    <div className="flex items-center gap-0">
      {DEPTS.map((d, i) => {
        const inRoute = order.route.includes(d.id);
        const stage = order.stages.find(s => s.dept === d.id);
        const done = stage?.status === "done";
        const active = here === d.id;
        return (
          <div key={d.id} className="flex items-center">
            {i > 0 && (
              <span
                className="h-px w-3 shrink-0"
                style={{ background: inRoute ? "color-mix(in oklch, var(--foreground) 22%, transparent)" : "color-mix(in oklch, var(--foreground) 8%, transparent)" }}
              />
            )}
            <span
              title={`${d.name}${!inRoute ? " — skipped" : done ? " — done" : active ? " — here now" : " — waiting"}`}
              className={cn(
                "grid place-items-center rounded-full border-2 transition-all",
                compact ? "size-[13px]" : "size-4",
                active && "ring-2 ring-offset-1 ring-offset-card",
              )}
              style={{
                borderColor: inRoute ? d.hue : "color-mix(in oklch, var(--foreground) 12%, transparent)",
                background: done ? d.hue : "transparent",
                opacity: inRoute ? 1 : 0.35,
                ...(active ? { boxShadow: `0 0 0 3px color-mix(in oklch, ${d.hue} 22%, transparent)` } : {}),
              }}
            >
              {active && <span className="size-1.5 rounded-full jc-pulse" style={{ background: d.hue }} />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DueBadge({ order }: { order: Order }) {
  const late = isOverdue(order);
  const h = hoursLeft(order);
  if (late) return <Chip tone="late">● {Math.abs(h)}h overdue</Chip>;
  if (h <= 6) return <Chip tone="warn">● due in {h}h</Chip>;
  return <Chip tone="muted">due in {h}h</Chip>;
}

export function StateBadge({ order }: { order: Order }) {
  const s = orderState(order);
  const tone = s === "ready" ? "ok" : s === "awaiting_approval" ? "warn" : s === "closed" ? "muted" : "ink";
  return <Chip tone={tone}>{STATE_LABEL[s]}</Chip>;
}

/* ── the job card ─────────────────────────────────────────────────────────── */

export function JobCard({
  order, onClick, children, dense = false, showMoney = true,
}: {
  order: Order; onClick?: () => void; children?: React.ReactNode;
  dense?: boolean;
  /** Department screens never show what a job is worth (rule 5). */
  showMoney?: boolean;
}) {
  const here = currentDept(order);
  const bal = balanceOf(order);
  const stripe = here ? deptById(here).hue : "var(--ok)";
  return (
    <article
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card text-left shadow-[0_1px_2px_rgba(16,24,40,.04)] card-lift",
        onClick && "cursor-pointer",
        isOverdue(order) && "border-[color-mix(in_oklch,var(--late)_40%,var(--border))]",
      )}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: stripe }} />
      <div className={cn("flex items-start justify-between gap-3", dense ? "px-3.5 pb-2.5 pt-3.5" : "px-4 pb-3 pt-4")}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground">{order.id}</span>
            {order.priority === "rush" && <Chip tone="late">RUSH</Chip>}
          </div>
          <h3 className={cn("mt-1 truncate font-display font-semibold", dense ? "text-[15px]" : "text-base")}>
            {order.customer}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {orderTypeById(order.type).name} · {order.qty} · {order.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <DueBadge order={order} />
          {showMoney && bal > 0 && (
            <span className="tnum text-[11px] font-semibold text-muted-foreground">{fmtP(bal)} owing</span>
          )}
        </div>
      </div>
      <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t bg-[color-mix(in_oklch,var(--muted)_55%,white)] py-2", dense ? "px-3.5" : "px-4")}>
        <RouteRail order={order} compact={dense} />
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </article>
  );
}

/* ── buttons ──────────────────────────────────────────────────────────────── */

export function Btn({
  children, onClick, variant = "solid", size = "md", disabled, title, className,
}: {
  children: React.ReactNode; onClick?: (e: React.MouseEvent) => void;
  variant?: "solid" | "soft" | "ghost" | "danger"; size?: "sm" | "md";
  disabled?: boolean; title?: string; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
  const sizes = { sm: "h-7 px-2.5 text-[12px]", md: "h-9 px-3.5 text-[13px]" };
  const variants = {
    solid: "bg-primary text-primary-foreground hover:opacity-90 active:scale-[.98]",
    soft: "bg-secondary text-secondary-foreground hover:bg-muted active:scale-[.98]",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "bg-[var(--late)] text-white hover:opacity-90 active:scale-[.98]",
  };
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={cn(base, sizes[size], variants[variant], className)}>
      {children}
    </button>
  );
}

/* ── stats ────────────────────────────────────────────────────────────────── */

export function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "ok" | "warn" | "late" }) {
  const c = tone ? `var(--${tone})` : "var(--foreground)";
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tnum mt-1 font-display text-2xl font-bold leading-none" style={{ color: c }}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 px-4 py-10 text-center text-[13px] text-muted-foreground">
      {children}
    </div>
  );
}

export function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
      {children}
      {count !== undefined && (
        <span className="tnum rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">{count}</span>
      )}
    </h2>
  );
}

/* ── app chrome ───────────────────────────────────────────────────────────── */

const NAV = [
  { href: "/ops", label: "Front desk" },
  { href: "/floor", label: "Department screens" },
  { href: "/board", label: "Job board" },
  { href: "/accounts", label: "Accounts" },
  { href: "/overdue", label: "Overdue desk" },
  { href: "/odoo", label: "Odoo" },
  { href: "/client", label: "Customer view" },
  { href: "/comms", label: "Messages sent" },
];

export function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const [loc] = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-[oklch(0.185_0.012_262)] text-[oklch(0.93_0.006_260)]">
        <div className={cn("mx-auto flex h-14 items-center gap-6 px-5", wide ? "max-w-none" : "max-w-[1400px]")}>
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-white" title="Back to the Pula Printers website">
            <Mark />
            <span className="hidden border-l border-white/20 pl-2.5 text-[12.5px] font-medium text-white/50 xl:inline">
              Pula Printers
            </span>
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {NAV.map(n => {
              const on = loc === n.href || loc.startsWith(`${n.href}/`);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                    on ? "bg-white/12 text-white" : "text-white/60 hover:bg-white/8 hover:text-white/90",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <span className="hidden shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70 sm:inline">
            Prototype · sample data
          </span>
        </div>
      </header>
      <main className={cn("mx-auto min-w-0 px-5 py-7", wide ? "max-w-none" : "max-w-[1400px]")}>{children}</main>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
