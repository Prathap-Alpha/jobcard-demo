import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { ORDER_TYPES, fmtP, normaliseRoute, orderTypeById, type OrderTypeId } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Pula Printers — the shop's own public website.
   This is what a customer lands on. The system that runs behind it (JobCard)
   is reached from the small Staff link, the way it would be in real life.
   Pula Printers is an invented sample company for this demonstration.
   ═══════════════════════════════════════════════════════════════════════════ */

const SERVICES: { id: OrderTypeId; blurb: string; from: number; unit: string }[] = [
  { id: "stickers", blurb: "Die-cut, kiss-cut, vinyl or paper. Weatherproof for outdoors.", from: 4, unit: "each" },
  { id: "banners", blurb: "PVC, mesh and pull-ups. Hemmed and eyeleted, ready to hang.", from: 380, unit: "per m²" },
  { id: "print_press", blurb: "Posters, flyers, programmes, business cards. Digital and litho.", from: 3, unit: "per copy" },
  { id: "flyer_design", blurb: "We draw it from scratch. Two changes free, then P150 each.", from: 450, unit: "per design" },
  { id: "dtf_transfers", blurb: "Full-colour transfers that stretch and survive the wash.", from: 35, unit: "per print" },
  { id: "branded_uniforms", blurb: "Golf shirts, overalls, chef jackets. Embroidered or printed.", from: 180, unit: "per garment" },
];

const STEPS = [
  { n: "01", t: "Ask us for a price", d: "Walk in, WhatsApp us, or send the form below. You get a firm price the same day, and nothing is booked until you accept it." },
  { n: "02", t: "Approve the artwork", d: "We send you a proof. Nothing touches a machine until you say yes. Two changes are free." },
  { n: "03", t: "We print it", d: "Your job moves through only the departments it needs. You get a message at every step." },
  { n: "04", t: "Collect or we deliver", d: "We tell you it is ready and exactly what is left to pay. Gaborone delivery from P60." },
];

const PROMISES = [
  { t: "Same-day on small runs", d: "Stickers, flyers and business cards in before 10am are ready before we close." },
  { t: "No surprise invoices", d: "The price you approve is the price you pay. Your first two design changes are free, and any after that are P150 each." },
  { t: "You are never guessing", d: "A text and an email at every stage, and the ready message tells you the balance owing." },
  { t: "Seven departments, one roof", d: "Design, sublimation, DTF, sewing and embroidery all in-house. Nothing gets sub-contracted and lost." },
];

/* ── the CMYK halftone motif, drawn rather than photographed ───────────────── */
function Halftone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden focusable="false">
      <defs>
        {(["--dept-design", "--dept-sublimation", "--dept-sewing"] as const).map((v, i) => (
          <radialGradient key={v} id={`ht${i}`}>
            <stop offset="0%" stopColor={`var(${v})`} stopOpacity="0.85" />
            <stop offset="100%" stopColor={`var(${v})`} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <circle cx="150" cy="140" r="130" fill="url(#ht0)" />
      <circle cx="255" cy="150" r="130" fill="url(#ht1)" />
      <circle cx="200" cy="250" r="130" fill="url(#ht2)" />
    </svg>
  );
}

/* ── a drawn stand-in for each product, so no stock photography is faked ───── */
function Sample({ id }: { id: OrderTypeId }) {
  const base = "absolute inset-0 grid place-items-center";
  switch (id) {
    case "stickers":
      return (
        <div className={base}>
          <div className="relative size-24">
            <span className="absolute left-0 top-2 size-16 rotate-[-8deg] rounded-full border-4 border-white/80" style={{ background: "var(--dept-sublimation)" }} />
            <span className="absolute right-0 top-0 size-14 rotate-[12deg] rounded-xl border-4 border-white/80" style={{ background: "var(--dept-design)" }} />
            <span className="absolute bottom-0 left-6 size-12 rotate-[6deg] border-4 border-white/80" style={{ background: "var(--dept-sewing)", clipPath: "polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)" }} />
          </div>
        </div>
      );
    case "banners":
      return (
        <div className={base}>
          <div className="h-24 w-36 rounded-sm p-2" style={{ background: "var(--dept-design)" }}>
            <div className="h-2 w-2/3 rounded-full bg-white/85" />
            <div className="mt-1.5 h-2 w-1/2 rounded-full bg-white/60" />
            <div className="mt-4 h-8 w-full rounded-sm bg-white/20" />
            <div className="mt-2 flex justify-between"><span className="size-1.5 rounded-full bg-white/70" /><span className="size-1.5 rounded-full bg-white/70" /></div>
          </div>
        </div>
      );
    case "print_press":
      return (
        <div className={base}>
          <div className="relative h-28 w-24">
            <span className="absolute inset-0 rotate-[-6deg] rounded-sm bg-white shadow-lg" />
            <span className="absolute inset-0 rotate-[3deg] rounded-sm bg-white shadow-lg" />
            <span className="absolute inset-0 rounded-sm bg-white p-3 shadow-lg">
              <span className="block h-3 w-full rounded-sm" style={{ background: "var(--dept-accounts)" }} />
              <span className="mt-2 block h-1.5 w-4/5 rounded-full bg-black/15" />
              <span className="mt-1 block h-1.5 w-full rounded-full bg-black/10" />
              <span className="mt-1 block h-1.5 w-3/5 rounded-full bg-black/10" />
              <span className="mt-3 block h-6 w-full rounded-sm" style={{ background: "var(--dept-sewing)" }} />
            </span>
          </div>
        </div>
      );
    case "flyer_design":
      return (
        <div className={base}>
          <div className="grid grid-cols-2 gap-1.5">
            {["--dept-design", "--dept-sublimation", "--dept-sewing", "--dept-embroidery"].map(v => (
              <span key={v} className="size-11 rounded-md" style={{ background: `var(${v})` }} />
            ))}
          </div>
        </div>
      );
    case "dtf_transfers":
      return (
        <div className={base}>
          <div className="relative h-24 w-28 rounded-t-3xl bg-white/90 shadow-lg">
            <span className="absolute -left-3 top-3 h-10 w-5 rounded-l-xl bg-white/90" />
            <span className="absolute -right-3 top-3 h-10 w-5 rounded-r-xl bg-white/90" />
            <span className="absolute left-1/2 top-8 size-10 -translate-x-1/2 rounded-full" style={{ background: "var(--dept-dtf)" }} />
          </div>
        </div>
      );
    case "branded_uniforms":
      return (
        <div className={base}>
          <div className="relative h-24 w-28 rounded-t-3xl shadow-lg" style={{ background: "var(--dept-accounts)" }}>
            <span className="absolute -left-3 top-3 h-10 w-5 rounded-l-xl" style={{ background: "var(--dept-accounts)" }} />
            <span className="absolute -right-3 top-3 h-10 w-5 rounded-r-xl" style={{ background: "var(--dept-accounts)" }} />
            <span className="absolute left-5 top-7 size-6 rounded-full border-2" style={{ borderColor: "var(--dept-sewing)" }} />
            <span className="absolute left-1/2 top-0 h-5 w-8 -translate-x-1/2 rounded-b-2xl bg-white/90" />
          </div>
        </div>
      );
  }
}

/* ── quote form ────────────────────────────────────────────────────────────── */

const ROUGH_PRICE: Record<OrderTypeId, number> = {
  stickers: 4, banners: 380, print_press: 3, flyer_design: 450, dtf_transfers: 35, branded_uniforms: 180,
};

function QuoteForm() {
  const { createOrder } = useStore();
  const [, nav] = useLocation();
  const [f, setF] = useState({ name: "", phone: "+267 ", email: "", type: "banners" as OrderTypeId, qty: "10", detail: "", own: false });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  const qty = Math.max(1, Number(f.qty) || 1);
  const estimate = ROUGH_PRICE[f.type] * (f.type === "flyer_design" ? 1 : qty);

  const ready = f.name.trim() && f.phone.replace(/\D/g, "").length >= 10 && f.email.includes("@") && f.detail.trim();

  const send = () => {
    if (!ready) return;
    // This is a price REQUEST, not an order. Nothing is quoted, nothing is owed,
    // no date is promised and it is not in Odoo. The front desk prices it and
    // turns it into a real job, which keeps "only managers create orders" true.
    const o = createOrder({
      enquiry: true,
      customer: f.name.trim(), contact: f.phone.trim(), email: f.email.trim(),
      type: f.type, description: f.detail.trim(), qty,
      // A customer who brings finished artwork does not need the design room.
      route: normaliseRoute(
        orderTypeById(f.type).defaultRoute
          .filter(d => d !== "admin" && d !== "accounts")
          .filter(d => !(f.own && d === "design")),
      ),
      artwork: f.own ? "client_supplied" : "in_house",
      dueAt: Date.now() + 48 * 3_600_000,   // provisional only; never promised to anyone
      priority: "standard",
      total: 0, deposit: 0,
      fulfilment: "collection",
      notes: "Price request from the website",
    });
    toast.success(`Thank you, ${f.name.trim()}`, {
      description: "We have your request and will come back today with a price. Nothing is booked yet.",
      action: { label: "See it arrive", onClick: () => nav("/ops") },
    });
    setF({ name: "", phone: "+267 ", email: "", type: "banners", qty: "10", detail: "", own: false });
  };

  const input = "h-11 w-full rounded-xl border-0 bg-white/10 px-4 text-[14px] text-white outline-none ring-1 ring-white/15 transition placeholder:text-white/35 focus:bg-white/15 focus:ring-2 focus:ring-white/50";

  return (
    <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={input} placeholder="Your name or business" value={f.name} onChange={e => set("name", e.target.value)} />
        <input className={input} placeholder="Phone" value={f.phone} onChange={e => set("phone", e.target.value)} />
      </div>
      <input className={cn(input, "mt-3")} placeholder="Email" value={f.email} onChange={e => set("email", e.target.value)} />

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">What do you need</p>
        <div className="flex flex-wrap gap-2">
          {ORDER_TYPES.map(t => (
            <button
              key={t.id} type="button" onClick={() => set("type", t.id)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-[13px] font-semibold transition",
                f.type === t.id ? "bg-white text-[oklch(0.16_0.012_262)]" : "bg-white/8 text-white/70 hover:bg-white/15 hover:text-white",
              )}
            >{t.name}</button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[110px_1fr]">
        <input className={input} inputMode="numeric" placeholder="Qty" value={f.qty} onChange={e => set("qty", e.target.value)} />
        <input className={input} placeholder="Tell us about the job. Size, colours, deadline." value={f.detail} onChange={e => set("detail", e.target.value)} />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-3 text-[13.5px] text-white/70">
        <input type="checkbox" checked={f.own} onChange={e => set("own", e.target.checked)} className="size-4 accent-white" />
        I already have the artwork ready
      </label>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Ballpark only</p>
          <p className="tnum font-display text-2xl font-bold text-white/70">around {fmtP(estimate)}</p>
          <p className="text-[11.5px] text-white/40">Not a quote. We price it properly and come back today.</p>
        </div>
        <button
          type="button" onClick={send} disabled={!ready}
          className="h-12 rounded-xl bg-white px-7 text-[14px] font-bold text-[oklch(0.16_0.012_262)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-30"
        >
          Ask for a price
        </button>
      </div>
    </div>
  );
}

/* ── track your order ──────────────────────────────────────────────────────── */

function TrackBox() {
  const { orders } = useStore();
  const [, nav] = useLocation();
  const [q, setQ] = useState("");
  const go = () => {
    const t = q.trim().toUpperCase();
    const miss = () => toast.error("We cannot find that job number", {
      description: "It looks like JC-2609-142. It is on your receipt and in the text we sent.",
    });
    if (t.length < 3) return miss();
    // Exact first. A partial must be at least three digits and match one job only,
    // otherwise we would hand the customer somebody else's order.
    const exact = orders.find(o => o.id.toUpperCase() === t && o.enquiry !== true);
    const partial = orders.filter(o => o.enquiry !== true && o.id.toUpperCase().endsWith(t));
    const hit = exact ?? (partial.length === 1 ? partial[0] : undefined);
    if (hit) nav(`/client?job=${hit.id}`);
    else miss();
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
        placeholder="Job number, e.g. JC-2609-142"
        className="h-12 flex-1 rounded-xl border bg-card px-4 text-[14px] outline-none focus:ring-2 focus:ring-ring"
      />
      <button type="button" onClick={go} className="h-12 rounded-xl bg-primary px-6 text-[14px] font-bold text-primary-foreground transition hover:opacity-90">
        Track my job
      </button>
    </div>
  );
}

/* ── the page ──────────────────────────────────────────────────────────────── */

export default function Home() {
  const { orders } = useStore();
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const jobsThisWeek = useMemo(() => 120 + orders.length, [orders.length]);

  return (
    <div className="min-h-screen bg-background">
      {/* ── demo notice ── */}
      <div className="relative z-[60] bg-[oklch(0.20_0.012_262)] px-5 py-2 text-center text-[11.5px] font-medium text-white/60">
        Demonstration site. <span className="text-white/85">Pula Printers is an invented company</span> and
        every name, price, address and phone number here is made up.
      </div>

      {/* ── nav ── */}
      <header className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        solid ? "bg-[oklch(0.13_0.012_262)]/95 backdrop-blur-md" : "bg-[oklch(0.13_0.012_262)]",
      )}>
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center gap-6 px-5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-white">
            <PulaLogo />
            <span className="font-display text-[17px] font-bold tracking-tight">Pula Printers</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {[["#services", "What we print"], ["#how", "How it works"], ["#promise", "Why us"], ["#quote", "Get a price"]].map(([h, l]) => (
              <a key={h} href={h} className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/65 transition hover:bg-white/10 hover:text-white">{l}</a>
            ))}
          </nav>
          <Link href="/ops" className="ml-auto rounded-xl bg-white/12 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/20 lg:ml-0">
            Staff
          </Link>
        </div>
      </header>

      {/* ── hero ── */}
      <section className="relative overflow-hidden bg-[oklch(0.13_0.012_262)] text-white">
        <Halftone className="pointer-events-none absolute -right-24 -top-24 size-[560px] opacity-30 blur-2xl" />
        <div className="relative mx-auto max-w-[1180px] px-5 pb-20 pt-16 md:pb-28 md:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white/60">
            <span className="size-1.5 rounded-full" style={{ background: "var(--dept-embroidery)" }} />
            Gaborone · open Mon to Sat
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-[42px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[64px] md:text-[80px]">
            Printed properly.<br />
            <span style={{ color: "var(--dept-design)" }}>Ready when we said.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/60">
            Stickers, banners, uniforms and everything in between. Seven departments under one
            roof in Gaborone, so your job never gets sub-contracted out and lost.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#quote" className="rounded-2xl bg-white px-7 py-4 text-[15px] font-bold text-[oklch(0.16_0.012_262)] transition hover:scale-[1.02]">
              Get a price today
            </a>
            <a href="#services" className="rounded-2xl px-7 py-4 text-[15px] font-semibold text-white/80 ring-1 ring-white/25 transition hover:bg-white/10">
              See what we print
            </a>
          </div>

          <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
            {[
              [`${jobsThisWeek}`, "jobs this week"],
              ["7", "departments in-house"],
              ["24hr", "on most reprints"],
              ["2", "free design changes"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="tnum font-display text-3xl font-bold leading-none sm:text-4xl">{v}</dt>
                <dd className="mt-1.5 text-[12.5px] text-white/45">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* CMYK rule */}
        <div className="flex h-1.5">
          {["--dept-design", "--dept-sublimation", "--dept-sewing", "--dept-accounts"].map(v => (
            <span key={v} className="flex-1" style={{ background: `var(${v})` }} />
          ))}
        </div>
      </section>

      {/* ── services ── */}
      <section id="services" className="mx-auto max-w-[1180px] scroll-mt-20 px-5 py-20 md:py-24">
        <h2 className="font-display text-[32px] font-bold tracking-tight md:text-[42px]">What we print</h2>
        <p className="mt-3 max-w-xl text-[15.5px] text-muted-foreground">
          Bring us your artwork or let our design room draw it. Either way it stays in this building
          until it is finished.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(s => {
            const t = orderTypeById(s.id);
            return (
              <article key={s.id} className="group overflow-hidden rounded-2xl border bg-card card-lift">
                <div className="relative h-40 overflow-hidden bg-[oklch(0.96_0.004_260)]">
                  <div className="absolute inset-0 paper-grid opacity-60" />
                  <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.06]">
                    <Sample id={s.id} />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-[18px] font-bold">{t.name}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{s.blurb}</p>
                  <p className="mt-4 border-t pt-3 text-[13px]">
                    <span className="text-muted-foreground">from </span>
                    <span className="tnum font-display font-bold">{fmtP(s.from)}</span>
                    <span className="text-muted-foreground"> {s.unit}</span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── how it works ── */}
      <section id="how" className="scroll-mt-20 border-y bg-card">
        <div className="mx-auto max-w-[1180px] px-5 py-20 md:py-24">
          <h2 className="font-display text-[32px] font-bold tracking-tight md:text-[42px]">How ordering works</h2>
          <p className="mt-3 max-w-xl text-[15.5px] text-muted-foreground">
            Four steps, and you hear from us at each one.
          </p>
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <span
                  className="font-mono text-[13px] font-bold"
                  style={{ color: ["var(--dept-design)", "var(--dept-sublimation)", "var(--dept-sewing)", "var(--dept-embroidery)"][i] }}
                >{s.n}</span>
                <h3 className="mt-2 font-display text-[19px] font-bold leading-snug">{s.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── promises ── */}
      <section id="promise" className="mx-auto max-w-[1180px] scroll-mt-20 px-5 py-20 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-display text-[32px] font-bold tracking-tight md:text-[42px]">
              Why people keep<br />coming back
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
              Most print shops lose your job somewhere between the front desk and the machine.
              We built a system so that cannot happen here.
            </p>
            <Link href="/board" className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold underline underline-offset-4">
              See our live production board →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {PROMISES.map((p, i) => (
              <div key={p.t} className="rounded-2xl border bg-card p-5">
                <span className="block size-2.5 rounded-full" style={{ background: ["var(--dept-design)", "var(--dept-sublimation)", "var(--dept-sewing)", "var(--dept-embroidery)"][i] }} />
                <h3 className="mt-3.5 font-display text-[16px] font-bold">{p.t}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── track ── */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-[1180px] items-center gap-8 px-5 py-14 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="font-display text-[26px] font-bold tracking-tight">Already ordered?</h2>
            <p className="mt-2 text-[14.5px] text-muted-foreground">
              Put in your job number and see exactly where it is, and what is left to pay.
            </p>
          </div>
          <TrackBox />
        </div>
      </section>

      {/* ── quote ── */}
      <section id="quote" className="scroll-mt-20 bg-[oklch(0.13_0.012_262)] text-white">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-20 md:py-24 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight md:text-[42px]">
              Get a price<br />
              <span style={{ color: "var(--dept-sewing)" }}>today.</span>
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-white/55">
              Fill this in and it goes straight onto the front desk screen. We come back the
              same day with a firm price.
            </p>
            <p className="mt-8 text-[11px] font-bold uppercase tracking-wider text-white/30">Sample contact details</p>
            <div className="mt-3 space-y-4 text-[14px]">
              <p className="flex gap-3"><span className="text-white/35">Call</span><span className="font-semibold">+267 395 4120</span></p>
              <p className="flex gap-3"><span className="text-white/35">WhatsApp</span><span className="font-semibold">+267 71 884 220</span></p>
              <p className="flex gap-3"><span className="text-white/35">Find us</span><span className="font-semibold">Plot 22014, Block 3 Industrial, Gaborone</span></p>
              <p className="flex gap-3"><span className="text-white/35">Open</span><span className="font-semibold">Mon to Fri 08:00–17:30 · Sat 08:00–13:00</span></p>
            </div>
          </div>
          <QuoteForm />
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="bg-[oklch(0.10_0.012_262)] text-white/50">
        <div className="mx-auto max-w-[1180px] px-5 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-md">
              <span className="flex items-center gap-2.5 text-white"><PulaLogo /><span className="font-display text-[16px] font-bold">Pula Printers</span></span>
              <p className="mt-3 text-[13px] leading-relaxed">
                A made-up Gaborone print shop, used to show how the JobCard system
                would run for a real one.
              </p>
            </div>
            <div className="flex gap-12 text-[13px]">
              <div>
                <p className="mb-2.5 font-semibold text-white/80">Shop</p>
                <ul className="space-y-1.5">
                  {SERVICES.slice(0, 4).map(s => <li key={s.id}>{orderTypeById(s.id).name}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-2.5 font-semibold text-white/80">Inside</p>
                <ul className="space-y-1.5">
                  <li><Link href="/ops" className="hover:text-white">Staff area</Link></li>
                  <li><Link href="/board" className="hover:text-white">Production board</Link></li>
                  <li><Link href="/client" className="hover:text-white">Track a job</Link></li>
                  <li><Link href="/demo" className="hover:text-white">About this demo</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-[12px]">
            <p>Pula Printers · a sample company built for this demonstration</p>
            <p className="rounded-full bg-white/8 px-3 py-1.5 font-semibold text-white/55">
              Not a real business · no orders placed here reach anyone
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PulaLogo() {
  return (
    <span className="relative inline-block size-7 shrink-0" aria-hidden>
      <span className="absolute left-0 top-0 size-[18px] rounded-full" style={{ background: "var(--dept-design)" }} />
      <span className="absolute right-0 top-0 size-[18px] rounded-full mix-blend-multiply" style={{ background: "var(--dept-sublimation)" }} />
      <span className="absolute bottom-0 left-1/2 size-[18px] -translate-x-1/2 rounded-full mix-blend-multiply" style={{ background: "var(--dept-sewing)" }} />
    </span>
  );
}
