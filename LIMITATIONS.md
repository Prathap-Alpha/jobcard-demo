# What this prototype does not do yet

The demo is deliberately a browser-only build: no server, no database, no logins.
That makes it fast to show and safe to hand around, and it means three of the
client's requirements are *demonstrated* rather than *enforced*. They are real
build-phase work, and they were flagged by an independent review of the code, so
they are written down here rather than glossed over.

## 1. "Only Operations Managers can create orders" is a screen rule, not a lock

The New Order form exists only on the front desk, so in the demo nobody else can
open a job. The website form does NOT create an order: it creates a price request
that carries no price, no promised date and no Odoo number, and an Operations
Manager has to price it before it becomes a job. But there is no login and no
server, so the rule still lives in the layout. In the real build order creation
sits behind an Operations Manager permission checked on the server.

## 2. "Staff see only their own department" is enforced in what is drawn, not in what is sent

`useDeptQueue` filters each screen to that department's jobs, and department
screens do not show what a job is worth. But the whole sample day is in the
browser, so a determined person could read it out of the page. In the real build
each department screen asks the server for its own queue and the server returns
only those fields.

## 3. Overdue chasing is a button, not a scheduler

The rule is implemented and de-duplicated: a job is chased at most once every six
hours, and pressing the button repeatedly does not text the same customer twice.
What the demo cannot do is run on its own overnight, because there is nothing
running when the tab is closed. In the real build this is a scheduled job on the
server, most likely every morning before opening.

## 4. Odoo is referenced, not connected

Every job carries its Odoo quotation reference and shows a sync state. Nothing is
actually read from or written to Odoo. Wiring it up is a scoped piece of work
against Odoo's API, and it is the item worth agreeing early because it decides
where a job is created: in Odoo, in JobCard, or in both.

## 5. Everything else about the data

All 24 sample jobs are invented. Customer names, phone numbers, addresses,
prices and Odoo references are fabricated for the demo and match no real
business. Nothing is sent anywhere: the SMS and email screens show what *would*
be sent, composed from the real templates.

## What is genuinely enforced in the logic

For balance, these are not just drawn on the screen. They are checked in
`client/src/lib/domain.ts` and `client/src/lib/store.tsx`, and the store refuses
the move even if something calls it directly:

- Admin first and Accounts last on every job, with no repeats
- a job we design ourselves always stops at Design
- no station after Design may start until the client has approved the proof
- a change requested after production sends that production back to the queue
- a revised proof is sent to the customer, not just the first one
- a station that is still held is not told a job has landed
- deliveries can only be dispatched once packed, and only for delivery jobs
- payments reject zero and negative amounts, and cannot exceed the total
- the overdue chase de-duplicates within six hours

---

# The one question to put back to the client

**Which room actually prints a sticker, a banner or a flyer?**

The seven departments they gave us are Admin, Design, Sublimation, DTF, Sewing,
Embroidery and Accounts. Sublimation covers heat-pressed work and DTF covers
garment transfers, but nothing in that list is a large-format or digital printer.
So in the demo a job for 200 stickers runs Admin, then Design, then Accounts, and
can be marked ready without any station ever being asked to print it.

That is almost certainly a gap in how the shop described itself rather than how it
works. Most likely the Design room also runs the printer. We have deliberately NOT
invented an eighth department to paper over it, because guessing here would put a
room on their screen that does not exist in their building.

Ask them: does Design run the printer, or is there a print room they did not count?
Whichever it is, it is a one-line change to the routes.

# Smaller things still open

- **The Odoo number is generated, not typed.** The front desk cannot enter the real
  quotation number yet, so the demo invents one and shows it as in step.
- **The order of the middle stations comes from the order they are ticked.** There is
  no drag-to-reorder, so getting Embroidery before Sewing means unticking and
  re-ticking, and nothing on screen says so.
- **The Accounts department screen is a second door.** Keneilwe has a proper Accounts
  page with the money on it; `/floor/accounts` can also release a job, without
  showing what is owed.
- **Nothing re-draws on a timer except the wall board.** A job that tips over its
  promised time only turns red on the other screens when something else changes.
