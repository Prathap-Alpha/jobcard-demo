import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Chip, Empty, PageHead, Shell, Stat } from "@/components/jc";
import { balanceOf, fmtP, isComplete, orderTypeById } from "@/lib/domain";
import { DEMO_CONNECTION, SYNC_LABEL, openQuotes } from "@/lib/odoo";
import { useStore } from "@/lib/store";

/**
 * The Odoo side of the shop. Quotations and invoices stay in Odoo; this page is
 * the join. Pull an accepted quotation in as a job, and push a finished job back
 * so it can be invoiced without anyone retyping it.
 */
export default function Odoo() {
  const { orders, sendToOdoo } = useStore();
  const [busy, setBusy] = useState<string | null>(null);

  const jobs = orders.filter(o => !o.enquiry);
  const quotes = openQuotes();
  const pulled = new Set(jobs.map(o => o.odooRef).filter(Boolean));
  const waiting = quotes.filter(q => !pulled.has(q.ref));

  const toInvoice = useMemo(
    () => jobs.filter(o => isComplete(o) && !o.odooSynced),
    [jobs],
  );
  const linked = jobs.filter(o => o.odooRef);

  const push = async (id: string) => {
    setBusy(id);
    const res = await sendToOdoo(id);
    setBusy(null);
    toast[res.ok ? "success" : "error"](res.ok ? "Sent to Odoo" : "Odoo refused it", { description: res.message });
  };

  return (
    <Shell>
      <PageHead
        title="Odoo"
        sub="Quotations and invoices stay where they already are. This is the join, so nothing is typed twice and the two never disagree."
      />

      {/* the honest state of the connection */}
      <section className="mb-7 rounded-2xl border-2 border-dashed p-5" style={{ borderColor: "var(--warn)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold">The connection is not live yet</h2>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              Everything on this page works against a stand-in copy of your quotation book, so you can
              see exactly how the join behaves. It is not talking to your real Odoo, because a website
              running in a browser cannot safely hold an Odoo key — anyone opening the page could read it.
              Your Odoo supplier issues a key, it is kept on the server, and these same screens then read
              and write your live data. Nothing you see here changes.
            </p>
          </div>
          <Chip tone="warn">Stand-in data</Chip>
        </div>
        <dl className="mt-5 grid gap-x-8 gap-y-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Odoo address", DEMO_CONNECTION.url],
            ["Database", DEMO_CONNECTION.database],
            ["Connects as", DEMO_CONNECTION.user],
            ["Key from your supplier", DEMO_CONNECTION.keyHeldOnServer ? "Held on the server" : "Not issued yet"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 break-all font-mono text-[12.5px]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <Stat label="Quotations ready to pull" value={waiting.length} hint="Accepted in Odoo, not yet a job" />
        <Stat label="Jobs linked to a quotation" value={linked.length} hint={`of ${jobs.length} on the board`} />
        <Stat label="Finished, not yet invoiced" value={toInvoice.length} hint="Waiting to go back to Odoo" tone={toInvoice.length ? "warn" : undefined} />
      </div>

      <div className="grid gap-8 xl:grid-cols-2 [&>*]:min-w-0">
        <section>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
            Accepted quotations waiting to become jobs
          </h2>
          {waiting.length === 0 ? <Empty>Every accepted quotation is already on the board.</Empty> : (
            <div className="space-y-3">
              {waiting.map(q => (
                <div key={q.ref} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-bold text-muted-foreground">{q.ref}</span>
                      <p className="mt-0.5 truncate font-display text-[15px] font-semibold">{q.customer}</p>
                      <p className="truncate text-[13px] text-muted-foreground">
                        {orderTypeById(q.type).name} · {q.qty} · {q.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum font-display text-base font-bold">{fmtP(q.total)}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {q.deposit > 0 ? `${fmtP(q.deposit)} paid` : "nothing paid yet"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 border-t pt-3 text-[12.5px] text-muted-foreground">
                    Pull it in from the front desk: press <strong>New order</strong>, then <strong>Pull from Odoo</strong>.
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
            Finished jobs to invoice in Odoo
          </h2>
          {toInvoice.length === 0 ? <Empty>Nothing waiting to be invoiced.</Empty> : (
            <div className="space-y-3">
              {toInvoice.map(o => (
                <div key={o.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-bold text-muted-foreground">
                        {o.id}{o.odooRef ? ` · ${o.odooRef}` : ""}
                      </span>
                      <p className="mt-0.5 truncate font-display text-[15px] font-semibold">{o.customer}</p>
                      <p className="truncate text-[13px] text-muted-foreground">
                        {orderTypeById(o.type).name} · {o.qty}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum font-display text-base font-bold">{fmtP(o.total)}</p>
                      {balanceOf(o) > 0 && (
                        <p className="text-[11.5px]" style={{ color: "var(--warn)" }}>{fmtP(balanceOf(o))} owing</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <Chip tone={o.odooRef ? "muted" : "warn"}>
                      {o.odooRef ? SYNC_LABEL.not_sent : "no quotation number on this job"}
                    </Chip>
                    <Btn
                      size="sm" disabled={busy === o.id || !o.odooRef}
                      title={o.odooRef ? undefined : "Raise the quotation in Odoo first"}
                      onClick={() => push(o.id)}
                    >
                      {busy === o.id ? "Sending…" : "Raise the invoice"}
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
