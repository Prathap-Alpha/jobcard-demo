# JobCard

A working prototype of an order-tracking system for a print and advertising agency.
Built for a Gaborone client who currently passes handwritten job cards between rooms
and tracks jobs in WhatsApp groups.

**Live demo:** https://prathap-alpha.github.io/jobcard-demo/

Everything in it is fabricated sample data. There is no server and no database: the
demo runs entirely in the browser and stores its state in that browser only. The
"Reset the demo data" button on the front desk puts it back to the sample day.

## What it shows

| Screen | Who it is for |
|---|---|
| Front desk (`/ops`) | The Operations Manager. The only place an order can be created. |
| Department screens (`/floor`) | One shared screen per department. Shows that department's queue and deadlines, nothing else. |
| Job board (`/board`) | The wall display above the counter. Every live job, where it is, what is late, what is ready. |
| Accounts (`/accounts`) | Takes payment, releases the job, dispatches deliveries. |
| Customer view (`/client`) | What the customer sees on their phone: progress, the proof to approve, the balance owing. |
| Messages sent (`/comms`) | Every SMS and email the system sent, word for word. |

## The client's rules, and where each one lives

1. **No fixed sequence.** Each job picks its own route through the seven departments.
   Admin and Accounts are locked on; the other five are ticked per job.
   `client/src/lib/domain.ts` → `normaliseRoute`, `DEPTS`.
2. **Screens, not logins.** No per-person accounts. A new job appears on the
   department screen by itself. `client/src/pages/Dept.tsx`.
3. **Staff see only their own department.** `client/src/lib/store.tsx` → `useDeptQueue`.
4. **Only Operations Managers create orders.** The New Order form exists only on `/ops`.
5. **The client approves the design before production.** Admin and Design may work while
   the proof is out; every station after them is blocked.
   `domain.ts` → `PRE_APPROVAL_DEPTS`, `stageUnlocked`.
6. **Two free revisions, then P150.** `domain.ts` → `FREE_REVISIONS`,
   `EXTRA_REVISION_FEE`; charged automatically in `store.tsx` → `requestChanges`.
7. **SMS and email to the customer at each step.** `client/src/lib/messages.ts` holds the
   exact wording of all eight messages.
8. **The ready message states the balance owing.** `messages.ts` → `ready_collection`.
9. **Automatic chase for overdue jobs.** `store.tsx` → `chaseOverdue`.
10. **Delivery tracking, not just collection.** Driver, address and a delivered
    confirmation. `client/src/pages/Accounts.tsx`.
11. **Odoo stays the books.** Each job carries its Odoo quotation reference. Odoo keeps
    doing quotes and invoices; this replaces the paper card and the WhatsApp group.

## What it does not do yet

Three of the client's rules are demonstrated rather than enforced, because the
demo has no server: manager-only order creation, server-side department scoping,
and an overnight scheduler for the overdue chase. Odoo is referenced but not
connected. These were found by an independent code review and are written up in
[LIMITATIONS.md](LIMITATIONS.md) rather than glossed over.

## Running it locally

```bash
npm install
npm run dev
```

## Building it

```bash
npm run build            # serves from the site root
VITE_BASE=/jobcard-demo/ npm run build   # for the GitHub Pages subpath
```

`npx tsc --noEmit` type-checks. Both run in CI on every push to `main`.

## Stack

React 19, TypeScript, Vite 7, Tailwind 4, wouter, sonner. No backend.
The UI scaffold is reused from the Harbour Medical demo in the same account.
