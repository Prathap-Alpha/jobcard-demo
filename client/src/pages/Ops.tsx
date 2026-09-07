import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Btn, Chip, Empty, JobCard, PageHead, SectionTitle, Shell, StateBadge, Stat,
} from "@/components/jc";
import {
  DEPTS, ORDER_TYPES, balanceOf, deptById, fmtP, isComplete, isOverdue, normaliseRoute,
  orderState, orderTypeById, withDesignIfNeeded, type DeptId, type Order, type OrderTypeId,
} from "@/lib/domain";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/* ── new order form ───────────────────────────────────────────────────────── */

const blank = {
  customer: "", contact: "+267 ", email: "",
  type: "stickers" as OrderTypeId, description: "", qty: "50",
  artwork: "in_house" as Order["artwork"],
  due: "48", priority: "standard" as Order["priority"],
  total: "", deposit: "",
  fulfilment: "collection" as Order["fulfilment"], address: "", notes: "",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border bg-card px-3 text-[13.5px] outline-none transition-shadow placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring";

function NewOrderForm({ onDone }: { onDone: () => void }) {
  const { createOrder } = useStore();
  const [f, setF] = useState(blank);
  const [extra, setExtra] = useState<DeptId[]>(["design"]);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF(p => ({ ...p, [k]: v }));

  const route = useMemo(
     () => withDesignIfNeeded(normaliseRoute(extra), f.artwork),
     [extra, f.artwork],
   );

  const pickType = (id: OrderTypeId) => {
    set("type", id);
    setExtra(orderTypeById(id).defaultRoute.filter(d => d !== "admin" && d !== "accounts"));
  };

  const total = Number(f.total) || 0;
  const deposit = Number(f.deposit) || 0;
  const problems: string[] = [];
  if (!f.customer.trim()) problems.push("customer name");
  if (f.contact.replace(/\D/g, "").length < 10) problems.push("a full +267 phone number");
  if (!f.email.includes("@")) problems.push("an email address");
  if (!f.description.trim()) problems.push("a job description");
  if (total <= 0) problems.push("a job total");
  if (deposit > total) problems.push("a deposit no bigger than the total");
  if (f.fulfilment === "delivery" && !f.address.trim()) problems.push("a delivery address");

  const submit = () => {
    if (problems.length) return;
    const o = createOrder({
      customer: f.customer.trim(), contact: f.contact.trim(), email: f.email.trim(),
      type: f.type, description: f.description.trim(), qty: Math.max(1, Number(f.qty) || 1),
      route, artwork: f.artwork,
      dueAt: Date.now() + (Number(f.due) || 24) * 3_600_000,
      priority: f.priority, total, deposit,
      fulfilment: f.fulfilment,
      address: f.fulfilment === "delivery" ? f.address.trim() : undefined,
      notes: f.notes.trim() || undefined,
    });
    toast.success(`Job card ${o.id} opened`, {
      description: `${o.customer}. Sent to Admin, and the customer has been texted and emailed.`,
    });
    setF(blank);
    setExtra(["design"]);
    onDone();
  };

  return (
    <div className="rounded-2xl border bg-card p-5 jc-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">New job card</h2>
          <p className="text-[13px] text-muted-foreground">Only an Operations Manager can open one.</p>
        </div>
        <Btn variant="ghost" size="sm" onClick={onDone}>Close</Btn>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Customer"><input className={inputCls} value={f.customer} onChange={e => set("customer", e.target.value)} placeholder="Gaborone Secondary School" /></Field>
        <Field label="Phone"><input className={inputCls} value={f.contact} onChange={e => set("contact", e.target.value)} placeholder="+267 71 234 567" /></Field>
        <Field label="Email"><input className={inputCls} value={f.email} onChange={e => set("email", e.target.value)} placeholder="admin@school.ac.bw" /></Field>
      </div>

      <div className="mt-4">
        <Field label="Job type">
          <div className="flex flex-wrap gap-2">
            {ORDER_TYPES.map(t => (
              <button
                key={t.id} type="button" onClick={() => pickType(t.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-all",
                  f.type === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >{t.name}</button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2"><Field label="What are we making"><input className={inputCls} value={f.description} onChange={e => set("description", e.target.value)} placeholder="A1 vinyl banner, full colour, eyelets" /></Field></div>
        <Field label="Quantity"><input className={inputCls} inputMode="numeric" value={f.qty} onChange={e => set("qty", e.target.value)} /></Field>
        <Field label="Ready in (hours)"><input className={inputCls} inputMode="numeric" value={f.due} onChange={e => set("due", e.target.value)} /></Field>
      </div>

      <div className="mt-5">
        <Field label="Departments this job passes through" hint="Admin and Accounts are locked on every job. Tick only the stations this job actually needs.">
          <div className="flex flex-wrap gap-2">
            {DEPTS.map(d => {
              // Admin and Accounts are always on, and Design is forced on when we
              // are drawing the artwork: the proof has to come from somewhere.
              const locked = d.mandatory || (d.id === "design" && f.artwork === "in_house");
              const on = locked || extra.includes(d.id);
              return (
                <button
                  key={d.id} type="button" disabled={locked}
                  onClick={() => setExtra(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-all",
                    on ? "text-foreground" : "text-muted-foreground/70 hover:bg-muted",
                    locked && "cursor-not-allowed opacity-90",
                  )}
                  style={on ? { borderColor: d.hue, background: `color-mix(in oklch, ${d.hue} 10%, white)` } : undefined}
                >
                  <span className="size-2 rounded-full" style={{ background: on ? d.hue : "var(--border)" }} />
                  {d.name}
                  {locked && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {d.mandatory ? "always" : "we design"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Field>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Route: {route.map(r => deptById(r).name).join("  →  ")}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Field label="Artwork">
          <select className={inputCls} value={f.artwork} onChange={e => set("artwork", e.target.value as Order["artwork"])}>
            <option value="in_house">We design it (needs client sign-off)</option>
            <option value="client_supplied">Client brought their own</option>
          </select>
        </Field>
        <Field label="Priority">
          <select className={inputCls} value={f.priority} onChange={e => set("priority", e.target.value as Order["priority"])}>
            <option value="standard">Standard</option>
            <option value="rush">Rush</option>
          </select>
        </Field>
        <Field label="Total (Pula)"><input className={inputCls} inputMode="decimal" value={f.total} onChange={e => set("total", e.target.value)} placeholder="1200" /></Field>
        <Field label="Deposit paid (Pula)"><input className={inputCls} inputMode="decimal" value={f.deposit} onChange={e => set("deposit", e.target.value)} placeholder="600" /></Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Collection or delivery">
          <select className={inputCls} value={f.fulfilment} onChange={e => set("fulfilment", e.target.value as Order["fulfilment"])}>
            <option value="collection">Customer collects</option>
            <option value="delivery">We deliver</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Delivery address">
            <input className={inputCls} disabled={f.fulfilment !== "delivery"} value={f.address} onChange={e => set("address", e.target.value)} placeholder="Plot 1234, Block 8, Gaborone" />
          </Field>
        </div>
      </div>

      <div className="mt-4">
        <Field label="Note for the floor"><input className={inputCls} value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Customer wants to see a proof before printing" /></Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-[12.5px] text-muted-foreground">
          {problems.length ? <>Still need {problems.join(", ")}.</> : <>Balance on collection will be <strong className="text-foreground">{fmtP(Math.max(0, total - deposit))}</strong>.</>}
        </p>
        <Btn onClick={submit} disabled={problems.length > 0}>Open job card</Btn>
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

type Filter = "all" | "live" | "approval" | "ready" | "late";

export default function Ops() {
  const { orders, chaseOverdue, reset } = useStore();
  const [, nav] = useLocation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("live");
  const [q, setQ] = useState("");

  const late = orders.filter(o => isOverdue(o));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders
      .filter(o => {
        if (t && !`${o.id} ${o.customer} ${o.description} ${o.odooRef}`.toLowerCase().includes(t)) return false;
        const st = orderState(o);
        if (filter === "live") return st !== "closed";
        if (filter === "approval") return st === "awaiting_approval";
        if (filter === "ready") return st === "ready" || st === "out_for_delivery";
        if (filter === "late") return isOverdue(o);
        return true;
      })
      .sort((a, b) => a.dueAt - b.dueAt);
  }, [orders, filter, q]);

  const tabs: { id: Filter; label: string; n: number }[] = [
    { id: "live", label: "On the floor", n: orders.filter(o => orderState(o) !== "closed").length },
    { id: "approval", label: "Waiting on client", n: orders.filter(o => orderState(o) === "awaiting_approval").length },
    { id: "ready", label: "Ready / out", n: orders.filter(o => ["ready", "out_for_delivery"].includes(orderState(o))).length },
    { id: "late", label: "Overdue", n: late.length },
    { id: "all", label: "Everything", n: orders.length },
  ];

  const owed = orders.filter(o => !o.collectedAt).reduce((s, o) => s + balanceOf(o), 0);

  return (
    <Shell>
      <PageHead
        title="Front desk"
        sub="Where every order starts. The Operations Manager opens the job card, ticks the departments it needs, and the system pushes it from screen to screen."
        actions={
          <>
            <Btn variant="soft" onClick={() => { const n = chaseOverdue(); toast[n ? "success" : "message"](n ? `${n} overdue customer${n > 1 ? "s" : ""} chased` : "Nothing overdue right now"); }}>
              Chase overdue
            </Btn>
            <Btn onClick={() => setOpen(v => !v)}>+ New order</Btn>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open jobs" value={orders.filter(o => !isComplete(o)).length} hint="Still moving between departments" />
        <Stat label="Waiting on the client" value={orders.filter(o => orderState(o) === "awaiting_approval").length} hint="Nothing prints until they approve" tone="warn" />
        <Stat label="Overdue" value={late.length} hint="Past the promised date" tone={late.length ? "late" : undefined} />
        <Stat label="Money outstanding" value={fmtP(owed)} hint="Across all uncollected jobs" />
      </div>

      {open && <div className="mb-6"><NewOrderForm onDone={() => setOpen(false)} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(t => (
          <button
            key={t.id} type="button" onClick={() => setFilter(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              filter === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label} <span className="tnum opacity-70">{t.n}</span>
          </button>
        ))}
        <input
          value={q} onChange={e => setQ(e.target.value)} placeholder="Search job, customer or Odoo reference"
          className="ml-auto h-9 w-full rounded-lg border bg-card px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring sm:w-72"
        />
      </div>

      <SectionTitle count={shown.length}>Job cards</SectionTitle>
      {shown.length === 0 ? (
        <Empty>No job cards match that.</Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {shown.map(o => (
            <JobCard key={o.id} order={o} onClick={() => nav(`/client?job=${o.id}`)}>
              <StateBadge order={o} />
              {o.odooSynced && <Chip tone="muted" className="font-mono">{o.odooRef}</Chip>}
            </JobCard>
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-end border-t pt-5">
        <Btn variant="ghost" size="sm" onClick={() => { reset(); toast.message("Demo reset to the sample day"); }}>
          Reset the demo data
        </Btn>
      </div>
    </Shell>
  );
}
