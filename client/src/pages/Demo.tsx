import { Link } from "wouter";
import { Chip, DeptDot, Mark } from "@/components/jc";
import { DEPTS, ORDER_TYPES, isOverdue, orderState } from "@/lib/domain";
import { useStore } from "@/lib/store";

const DOORS = [
  { href: "/ops", title: "Front desk", who: "Operations Manager", blurb: "Opens the job card, ticks which departments the job needs, and sees the whole order book." },
  { href: "/floor", title: "Department screens", who: "The floor", blurb: "Seven screens, one per room. Each shows only that room's queue and its deadlines." },
  { href: "/board", title: "Job board", who: "The wall", blurb: "The counter screen. Every live job, where it is, what is late, what is ready." },
  { href: "/accounts", title: "Accounts", who: "Keneilwe", blurb: "Takes the money and releases the job. Nothing leaves without passing this desk." },
  { href: "/client", title: "Customer view", who: "The customer's phone", blurb: "Track the job, approve the proof, see exactly what is still owing." },
  { href: "/comms", title: "Messages sent", who: "Audit trail", blurb: "Every SMS and email the system sent, word for word." },
];

const ANSWERS = [
  { q: "No fixed sequence", a: "Every job picks its own route through the seven departments. Admin and Accounts are locked on. The other five are ticked only when the job needs them." },
  { q: "Screens, not logins", a: "Each department gets one shared screen. A new job appears on it by itself, so nobody needs a password and nobody sees another room's work." },
  { q: "Only managers open orders", a: "The New Order button lives on the front desk alone. Department screens can move a job forward, never create one." },
  { q: "Client signs off the design", a: "Nothing reaches a machine until the customer approves the proof. Two changes are free, and the third adds P150 to the invoice automatically." },
  { q: "The money follows the job", a: "The ready-for-collection message states the balance still owing, so the customer arrives knowing what to pay." },
  { q: "Late jobs chase themselves", a: "Any job past its promised time turns red on every screen and the customer gets an apology and a new time." },
  { q: "Collection and delivery", a: "Delivery jobs get a driver, an address and a delivered confirmation, not just a shelf." },
  { q: "Odoo stays the books", a: "Each job carries its Odoo quotation reference. Odoo keeps doing quotes and invoices; this replaces the paper card and the WhatsApp group." },
];

export default function Demo() {
  const { orders } = useStore();
  const live = orders.filter(o => orderState(o) !== "closed");
  const late = orders.filter(o => isOverdue(o));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-[oklch(0.185_0.012_262)] text-white">
        <div className="mx-auto max-w-[1200px] px-6 py-5">
          <div className="flex items-center justify-between">
            <Mark />
            <div className="flex items-center gap-2">
              <Link href="/" className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white/60 hover:bg-white/10 hover:text-white">
                ← Pula Printers site
              </Link>
              <Link href="/ops" className="rounded-lg bg-white/12 px-3.5 py-2 text-[13px] font-semibold hover:bg-white/20">
                Open the system →
              </Link>
            </div>
          </div>

          <div className="py-16 md:py-20">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/45">How the demo works</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.08] md:text-[54px]">
              The paper job card,<br />
              <span className="text-[oklch(0.72_0.13_218)]">without the paper.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/65">
              An order goes in at the front desk. It shows up on the right department's screen by itself,
              moves along whatever route that job actually needs, and the customer is told at every step,
              including what they still owe when it is ready.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/ops" className="rounded-xl bg-white px-5 py-3 text-[14px] font-bold text-[oklch(0.2_0.012_262)] transition-transform hover:scale-[1.02]">
                Start at the front desk
              </Link>
              <Link href="/board" className="rounded-xl border border-white/25 px-5 py-3 text-[14px] font-semibold text-white/85 hover:bg-white/10">
                See the wall board
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-white/50">
              <span><strong className="tnum text-white">{orders.length}</strong> jobs in the sample day</span>
              <span><strong className="tnum text-white">{live.length}</strong> live right now</span>
              <span><strong className="tnum" style={{ color: "var(--late)" }}>{late.length}</strong> running late</span>
              <span><strong className="tnum text-white">7</strong> departments</span>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-6 py-14">
        <h2 className="font-display text-2xl font-bold">Six ways in</h2>
        <p className="mt-1.5 text-[14.5px] text-muted-foreground">Every screen below is live. Move a job on one and watch it appear on the next.</p>
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DOORS.map(d => (
            <Link key={d.href} href={d.href} className="group rounded-2xl border bg-card p-5 card-lift">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{d.who}</p>
              <h3 className="mt-1.5 font-display text-lg font-bold">{d.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{d.blurb}</p>
              <span className="mt-4 inline-block text-[13px] font-semibold text-foreground transition-transform group-hover:translate-x-1">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto max-w-[1200px] px-6 py-14">
          <h2 className="font-display text-2xl font-bold">Your seven departments</h2>
          <p className="mt-1.5 max-w-2xl text-[14.5px] text-muted-foreground">
            A job takes only the stations it needs. Admin books it in, Accounts releases it. Everything between is optional.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {DEPTS.map(d => (
              <div key={d.id} className="flex min-w-[150px] flex-1 items-center gap-3 rounded-xl border px-4 py-3">
                <span className="size-3 shrink-0 rounded-full" style={{ background: d.hue }} />
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] font-bold">{d.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {d.mandatory ? "on every job" : "only when needed"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mt-11 font-display text-lg font-bold">Typical routes</h3>
          <div className="mt-4 space-y-2.5">
            {ORDER_TYPES.map(t => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5">
                <span className="w-40 shrink-0 text-[13.5px] font-semibold">{t.name}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.defaultRoute.map((r, i) => (
                    <span key={r} className="inline-flex items-center gap-1.5">
                      {i > 0 && <span className="text-muted-foreground/40">→</span>}
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium">
                        <DeptDot dept={r} />{DEPTS.find(d => d.id === r)!.name}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">
            These are only starting points. The Operations Manager can add or drop any middle station per job.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-14">
        <h2 className="font-display text-2xl font-bold">What you asked for, and where it is</h2>
        <div className="mt-7 grid gap-x-10 gap-y-6 md:grid-cols-2">
          {ANSWERS.map(a => (
            <div key={a.q}>
              <h3 className="font-display text-[15.5px] font-bold">{a.q}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{a.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div>
            <Mark />
            <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">
              Working prototype. Everything you see is made-up sample data and lives only in this browser. Press "Reset the demo data" on the front desk to put it back to the start.
            </p>
          </div>
          <Chip tone="muted">Prototype build · September 2026</Chip>
        </div>
      </footer>
    </div>
  );
}
