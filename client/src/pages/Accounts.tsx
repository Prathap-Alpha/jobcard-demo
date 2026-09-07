import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Chip, Empty, JobCard, PageHead, SectionTitle, Shell, Stat } from "@/components/jc";
import {
  balanceOf, fmtP, isComplete, isDebtor, orderTypeById, stageUnlocked, type Order,
} from "@/lib/domain";
import { useStore } from "@/lib/store";

const DRIVERS = ["Tshepo", "Bame", "Kitso"];

export default function Accounts() {
  const { orders, takePayment, finishStage, dispatchOrder, markDelivered, markCollected } = useStore();
  const [driver, setDriver] = useState(DRIVERS[0]);

  const live = orders.filter(o => !o.enquiry && !o.collectedAt && o.delivery !== "delivered");

  /** Accounts is the last stop on every job: settle up, then release it. */
  const atAccounts = useMemo(
    () => live.filter(o => stageUnlocked(o, "accounts") && o.stages.find(s => s.dept === "accounts")!.status !== "done")
      .sort((a, b) => balanceOf(b) - balanceOf(a)),
    [live],
  );
  const forCollection = live.filter(o => isComplete(o) && o.fulfilment === "collection");
  const toDeliver = live.filter(o => isComplete(o) && o.fulfilment === "delivery" && o.delivery === "packed");
  const onTheRoad = live.filter(o => o.delivery === "out_for_delivery");

  // Money owed does not disappear because the goods left the building.
  const debtors = orders.filter(o => !o.enquiry && isDebtor(o));
  const owed = live.reduce((s, o) => s + balanceOf(o), 0) + debtors.reduce((s, o) => s + balanceOf(o), 0);
  const takenToday = orders.filter(o => !o.enquiry).reduce((s, o) => s + o.deposit, 0);

  return (
    <Shell>
      <PageHead
        title="Accounts"
        sub="Every job ends here, so nothing leaves the shop without passing this desk. Balances follow the job, which is why the collection message always states what is still owing."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Outstanding" value={fmtP(owed)}
          hint={debtors.length ? `Includes ${fmtP(debtors.reduce((s, o) => s + balanceOf(o), 0))} on ${debtors.length} job${debtors.length > 1 ? "s" : ""} already handed over` : "Across all live jobs"}
          tone={owed > 0 ? "warn" : undefined}
        />
        <Stat label="Taken so far" value={fmtP(takenToday)} hint="Deposits and settlements" tone="ok" />
        <Stat label="At this desk" value={atAccounts.length} hint="Waiting to be released" />
        <Stat label="Out for delivery" value={onTheRoad.length} hint="With a driver right now" />
      </div>

      {debtors.length > 0 && (
        <section className="mb-8 rounded-2xl border-2 p-5" style={{ borderColor: "var(--late)" }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: "var(--late)" }} />
            <h2 className="font-display text-base font-bold">
              Debtors · {fmtP(debtors.reduce((s, o) => s + balanceOf(o), 0))} still to collect
            </h2>
            <span className="text-[13px] text-muted-foreground">
              These jobs left the shop before they were paid for.
            </span>
          </div>
          <div className="space-y-2.5">
            {debtors.map(o => (
              <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[11px] font-bold text-muted-foreground">{o.id}</span>
                  <p className="truncate font-display text-[15px] font-semibold">{o.customer}</p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {orderTypeById(o.type).name} · {o.qty} · {o.collectedAt ? "collected" : "delivered"}
                  </p>
                </div>
                <p className="tnum font-display text-lg font-bold" style={{ color: "var(--late)" }}>{fmtP(balanceOf(o))}</p>
                <QuickPay order={o} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-2 [&>*]:min-w-0">
        <section>
          <SectionTitle count={atAccounts.length}>At the Accounts desk</SectionTitle>
          <div className="space-y-3">
            {atAccounts.length === 0 ? <Empty>Nothing waiting to be released.</Empty> :
              atAccounts.map(o => <AccountRow key={o.id} o={o} onPay={takePayment} onRelease={() => {
                finishStage(o.id, "accounts", "Keneilwe");
                toast.success(`${o.id} released`, {
                  description: o.fulfilment === "delivery" ? "Packed for delivery." : "Customer messaged: ready for collection.",
                });
              }} />)}
          </div>
        </section>

        <div className="min-w-0 space-y-8">
          <section>
            <SectionTitle count={forCollection.length}>Waiting on the collection shelf</SectionTitle>
            <div className="space-y-3">
              {forCollection.length === 0 ? <Empty>Shelf is clear.</Empty> :
                forCollection.map(o => (
                  <JobCard key={o.id} order={o} dense>
                    <QuickPay order={o} />
                    <CollectBtn order={o} onCollect={() => { markCollected(o.id); }} />
                  </JobCard>
                ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle count={toDeliver.length + onTheRoad.length}>Deliveries</SectionTitle>
              <label className="flex items-center gap-2 text-[12.5px]">
                <span className="text-muted-foreground">Driver</span>
                <select value={driver} onChange={e => setDriver(e.target.value)}
                  className="h-8 rounded-lg border bg-card px-2.5 text-[12.5px] font-medium outline-none focus:ring-2 focus:ring-ring">
                  {DRIVERS.map(d => <option key={d}>{d}</option>)}
                </select>
              </label>
            </div>
            <div className="space-y-3">
              {toDeliver.length + onTheRoad.length === 0 ? <Empty>No deliveries queued.</Empty> : (
                <>
                  {toDeliver.map(o => (
                    <JobCard key={o.id} order={o} dense>
                      <Chip tone="muted">{o.address}</Chip>
                      <QuickPay order={o} />
                      <SendOutBtn order={o} onSend={() => dispatchOrder(o.id, driver)} driver={driver} />
                    </JobCard>
                  ))}
                  {onTheRoad.map(o => (
                    <JobCard key={o.id} order={o} dense>
                      <Chip tone="ink">with {o.driver}</Chip>
                      <Btn size="sm" variant="soft" onClick={() => { markDelivered(o.id); toast.success(`${o.id} delivered`); }}>
                        Delivered
                      </Btn>
                    </JobCard>
                  ))}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

/**
 * Take money on a job that has already left the Accounts desk. Without this the
 * only place to record a payment was the desk itself, so the balance a customer
 * settles on collection could never be entered anywhere.
 */
function QuickPay({ order }: { order: Order }) {
  const { takePayment } = useStore();
  const bal = balanceOf(order);
  if (bal === 0) return <Chip tone="ok">paid in full</Chip>;
  return (
    <Btn
      size="sm" variant="soft"
      onClick={e => {
        e.stopPropagation();
        takePayment(order.id, bal);
        toast.success(`${fmtP(bal)} taken on ${order.id}`, { description: "Settled in full." });
      }}
    >
      Take {fmtP(bal)}
    </Btn>
  );
}

/** Letting goods out with money owing needs a second, deliberate press. */
function CollectBtn({ order, onCollect }: { order: Order; onCollect: () => void }) {
  const [armed, setArmed] = useState(false);
  const bal = balanceOf(order);
  if (bal === 0) {
    return <Btn size="sm" onClick={() => { onCollect(); toast.success(`${order.id} collected`); }}>Collected</Btn>;
  }
  if (!armed) {
    return <Btn size="sm" variant="soft" onClick={() => setArmed(true)}>Collected</Btn>;
  }
  return (
    <Btn size="sm" variant="danger" onClick={() => { onCollect(); toast.warning(`${order.id} left with ${fmtP(bal)} owing`, { description: "It is now on the debtors list." }); }}>
      Let it go, {fmtP(bal)} owing
    </Btn>
  );
}

/** A van leaving with unpaid goods gets the same deliberate second press. */
function SendOutBtn({ order, onSend, driver }: { order: Order; onSend: () => void; driver: string }) {
  const [armed, setArmed] = useState(false);
  const bal = balanceOf(order);
  if (bal === 0) {
    return <Btn size="sm" onClick={() => { onSend(); toast.success(`${order.id} out with ${driver}`); }}>Send out</Btn>;
  }
  if (!armed) return <Btn size="sm" variant="soft" onClick={() => setArmed(true)}>Send out</Btn>;
  return (
    <Btn size="sm" variant="danger" onClick={() => { onSend(); toast.warning(`${order.id} left with ${fmtP(bal)} owing`, { description: "It is now on the debtors list." }); }}>
      Send anyway, {fmtP(bal)} owing
    </Btn>
  );
}

function AccountRow({ o, onPay, onRelease }: { o: Order; onPay: (id: string, amt: number) => void; onRelease: () => void }) {
  const [amt, setAmt] = useState("");
  const bal = balanceOf(o);
  const ready = o.stages.filter(s => s.dept !== "accounts").every(s => s.status === "done");
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-bold text-muted-foreground">{o.id} · {o.odooRef}</span>
          <h3 className="mt-0.5 truncate font-display text-base font-semibold">{o.customer}</h3>
          <p className="truncate text-[13px] text-muted-foreground">{orderTypeById(o.type).name} · {o.qty} · {o.description}</p>
        </div>
        <div className="text-right">
          <p className="tnum font-display text-xl font-bold" style={{ color: bal > 0 ? "var(--warn)" : "var(--ok)" }}>{fmtP(bal)}</p>
          <p className="text-[11px] text-muted-foreground">of {fmtP(o.total)} owing</p>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t pt-3.5">
        <input
          value={amt} onChange={e => setAmt(e.target.value)} inputMode="decimal" placeholder="Amount received"
          className="h-8 w-full rounded-lg border bg-background px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-ring sm:w-36"
        />
        <Btn
          size="sm" variant="soft"
          disabled={!(Number(amt) > 0) || Number(amt) > bal}
          title={Number(amt) > bal ? `That is more than the ${fmtP(bal)} owing` : undefined}
          onClick={() => { onPay(o.id, Number(amt)); setAmt(""); toast.success(`${fmtP(Number(amt))} recorded on ${o.id}`); }}
        >
          Record payment
        </Btn>
        {Number(amt) > bal && <span className="text-[11.5px] font-medium" style={{ color: "var(--late)" }}>more than the {fmtP(bal)} owing</span>}
        {bal > 0 && (
          <Btn size="sm" variant="ghost" onClick={() => { onPay(o.id, bal); toast.success(`${o.id} settled in full`); }}>
            Settle {fmtP(bal)}
          </Btn>
        )}
        <Btn size="sm" className="w-full sm:ml-auto sm:w-auto" disabled={!ready} title={ready ? undefined : "Production is not finished yet"} onClick={onRelease}>
          Release the job
        </Btn>
      </div>
    </div>
  );
}
