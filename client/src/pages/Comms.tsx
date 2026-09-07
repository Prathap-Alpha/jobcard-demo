import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Chip, Empty, PageHead, Shell, Stat } from "@/components/jc";
import { isOverdue } from "@/lib/domain";
import { MESSAGE_LABEL, type MessageKind } from "@/lib/messages";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Every SMS and email the system has sent, exactly as the customer received it. */
export default function Comms() {
  const { messages, orders, chaseOverdue } = useStore();
  const [channel, setChannel] = useState<"all" | "sms" | "email">("all");
  const [kind, setKind] = useState<MessageKind | "all">("all");

  const shown = useMemo(
    () => messages.filter(m => (channel === "all" || m.channel === channel) && (kind === "all" || m.kind === kind)),
    [messages, channel, kind],
  );

  const late = orders.filter(o => isOverdue(o)).length;
  const kinds = Array.from(new Set(messages.map(m => m.kind)));

  return (
    <Shell>
      <PageHead
        title="Messages sent"
        sub="Customers get an SMS and an email at each step. Staff get nothing extra, because a new job simply appears on their department screen. Every message is logged here."
        actions={
          <Btn variant="soft" onClick={() => { const n = chaseOverdue(); toast[n ? "success" : "message"](n ? `${n} overdue customer${n > 1 ? "s" : ""} chased` : "Nothing overdue right now"); }}>
            Run the overdue chase{late > 0 ? ` (${late})` : ""}
          </Btn>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Messages sent this session" value={messages.length} hint="SMS and email together" />
        <Stat label="Overdue jobs" value={late} tone={late ? "late" : undefined} hint="Each gets an automatic chase" />
        <Stat label="Staff notifications" value="0" hint="By design. The screen is the notification." />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "sms", "email"] as const).map(c => (
          <button key={c} type="button" onClick={() => setChannel(c)}
            className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              channel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            {c === "all" ? "Both channels" : c === "sms" ? "SMS" : "Email"}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <select value={kind} onChange={e => setKind(e.target.value as MessageKind | "all")}
          className="h-8 rounded-lg border bg-card px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Every kind of message</option>
          {kinds.map(k => <option key={k} value={k}>{MESSAGE_LABEL[k]}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <Empty>
          Nothing sent yet in this session. Open a new order, finish a stage on a department screen,
          or run the overdue chase, and the messages land here.
        </Empty>
      ) : (
        <div className="space-y-3">
          {shown.map(m => (
            <article key={m.id} className="overflow-hidden rounded-xl border bg-card jc-in">
              <div className="flex flex-wrap items-center gap-2 border-b bg-[color-mix(in_oklch,var(--muted)_55%,white)] px-4 py-2.5">
                <Chip tone={m.channel === "sms" ? "ink" : "muted"}>{m.channel === "sms" ? "SMS" : "Email"}</Chip>
                <Chip tone={m.kind === "overdue_reminder" ? "late" : m.kind === "ready_collection" ? "ok" : "muted"}>
                  {MESSAGE_LABEL[m.kind]}
                </Chip>
                <span className="font-mono text-[11.5px] text-muted-foreground">{m.orderId}</span>
                <span className="text-[12.5px] text-muted-foreground">to {m.to}</span>
                <span className="tnum ml-auto font-mono text-[11.5px] text-muted-foreground">
                  {new Date(m.sentAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="px-4 py-3.5">
                {m.subject && <p className="mb-1.5 text-[13.5px] font-semibold">{m.subject}</p>}
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted-foreground">{m.body}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}
