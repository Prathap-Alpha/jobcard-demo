// JobCard — domain model for a print & advertising agency job-tracking system.
// All data in this prototype is fabricated sample data. No real customer records.

export type DeptId =
  | "admin" | "design" | "sublimation" | "dtf" | "sewing" | "embroidery" | "accounts";

export interface Dept {
  id: DeptId;
  name: string;
  short: string;
  /** Admin and Accounts can never be skipped (client rule #1 / #9). */
  mandatory: boolean;
  hue: string;   // CSS colour token for the department stripe
  staff: string[];
}

export const DEPTS: Dept[] = [
  { id: "admin",       name: "Admin",       short: "ADM", mandatory: true,  hue: "var(--dept-admin)",       staff: ["Boitumelo", "Refilwe"] },
  { id: "design",      name: "Design",      short: "DSG", mandatory: false, hue: "var(--dept-design)",      staff: ["Tebogo", "Amantle"] },
  { id: "sublimation", name: "Sublimation", short: "SUB", mandatory: false, hue: "var(--dept-sublimation)", staff: ["Kabo"] },
  { id: "dtf",         name: "DTF",         short: "DTF", mandatory: false, hue: "var(--dept-dtf)",         staff: ["Onneile", "Gape"] },
  { id: "sewing",      name: "Sewing",      short: "SEW", mandatory: false, hue: "var(--dept-sewing)",      staff: ["Mpho", "Lesego"] },
  { id: "embroidery",  name: "Embroidery",  short: "EMB", mandatory: false, hue: "var(--dept-embroidery)",  staff: ["Neo"] },
  { id: "accounts",    name: "Accounts",    short: "ACC", mandatory: true,  hue: "var(--dept-accounts)",    staff: ["Keneilwe"] },
];

export const deptById = (id: DeptId) => DEPTS.find(d => d.id === id)!;

export type OrderTypeId =
  | "stickers" | "banners" | "print_press" | "flyer_design" | "dtf_transfers" | "branded_uniforms";

export interface OrderType {
  id: OrderTypeId;
  name: string;
  /** Suggested route. The Operations Manager can add or drop the optional stops. */
  defaultRoute: DeptId[];
}

export const ORDER_TYPES: OrderType[] = [
  { id: "stickers",         name: "Stickers",         defaultRoute: ["admin", "design", "accounts"] },
  { id: "banners",          name: "Banners",          defaultRoute: ["admin", "design", "accounts"] },
  { id: "print_press",      name: "Print & Press",    defaultRoute: ["admin", "design", "sublimation", "accounts"] },
  { id: "flyer_design",     name: "Flyer Design",     defaultRoute: ["admin", "design", "accounts"] },
  { id: "dtf_transfers",    name: "DTF Transfers",    defaultRoute: ["admin", "design", "dtf", "accounts"] },
  { id: "branded_uniforms", name: "Branded Uniforms", defaultRoute: ["admin", "design", "dtf", "sewing", "embroidery", "accounts"] },
];

export const orderTypeById = (id: OrderTypeId) => ORDER_TYPES.find(t => t.id === id)!;

export type StageStatus = "queued" | "in_progress" | "done";

export interface Stage {
  dept: DeptId;
  status: StageStatus;
  assignee?: string;
  startedAt?: number;
  finishedAt?: number;
}

/** Who supplies the artwork (client rule #3). */
export type Artwork = "client_supplied" | "in_house";

/** Design sign-off gate (client rule #9): no production before the client approves. */
export type Approval = "not_required" | "pending" | "approved" | "changes_requested";

export type Fulfilment = "collection" | "delivery";
export type DeliveryStage = "not_started" | "packed" | "out_for_delivery" | "delivered";

export interface Order {
  id: string;               // JC-2609-014
  odooRef: string;          // quotation / invoice reference already living in Odoo
  odooSynced: boolean;
  customer: string;
  contact: string;          // phone
  email: string;
  type: OrderTypeId;
  description: string;
  qty: number;
  route: DeptId[];          // the departments this job actually passes through
  stages: Stage[];
  artwork: Artwork;
  approval: Approval;
  revisionsUsed: number;
  createdAt: number;
  dueAt: number;
  priority: "standard" | "rush";
  total: number;            // BWP
  deposit: number;          // BWP
  fulfilment: Fulfilment;
  address?: string;
  delivery: DeliveryStage;
  driver?: string;
  collectedAt?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Business rules
// ---------------------------------------------------------------------------

export const FREE_REVISIONS = 2;
export const EXTRA_REVISION_FEE = 150; // BWP per revision beyond the free two

export const balanceOf = (o: Order) => Math.max(0, o.total - o.deposit);

/** The stage the job is sitting on right now, or undefined when everything is done. */
export const currentStage = (o: Order) =>
  o.stages.find(s => s.status !== "done");

export const currentDept = (o: Order) => currentStage(o)?.dept;

export const isComplete = (o: Order) => o.stages.every(s => s.status === "done");

/** Production may not start until an in-house design is signed off by the client. */
export const productionBlocked = (o: Order) =>
  o.approval === "pending" || o.approval === "changes_requested";

/**
 * Admin books the job in and Design draws the proof, so both must be able to work
 * while the client is still deciding. Everything downstream of them is production,
 * and production waits for the sign-off.
 */
export const PRE_APPROVAL_DEPTS: DeptId[] = ["admin", "design"];

/** A stage is workable only when every stage before it is finished. */
export const stageUnlocked = (o: Order, dept: DeptId) => {
  const i = o.stages.findIndex(s => s.dept === dept);
  if (i < 0) return false;
  if (o.stages.slice(0, i).some(s => s.status !== "done")) return false;
  if (!PRE_APPROVAL_DEPTS.includes(dept) && productionBlocked(o)) return false;
  return true;
};

/** Production stations that come after Design on this job's own route. */
export const downstreamOfDesign = (o: Order): DeptId[] => {
  const i = o.route.indexOf("design");
  return i < 0 ? [] : o.route.slice(i + 1);
};

export const isOverdue = (o: Order, now = Date.now()) =>
  !isComplete(o) && now > o.dueAt;

export const hoursLeft = (o: Order, now = Date.now()) =>
  Math.round((o.dueAt - now) / 3_600_000);

export type OrderState = "awaiting_approval" | "in_production" | "ready" | "out_for_delivery" | "closed";

/**
 * A job only counts as waiting on the client once Design has actually sent a
 * proof. Before that it is still ours, sitting with Admin or Design.
 */
export const proofIsOut = (o: Order) =>
  productionBlocked(o) && o.stages.some(s => s.dept === "design" && s.status === "done");

export const orderState = (o: Order): OrderState => {
  if (o.collectedAt || o.delivery === "delivered") return "closed";
  if (o.delivery === "out_for_delivery") return "out_for_delivery";
  if (isComplete(o)) return "ready";
  if (proofIsOut(o)) return "awaiting_approval";
  return "in_production";
};

export const STATE_LABEL: Record<OrderState, string> = {
  awaiting_approval: "Waiting on client",
  in_production: "In production",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  closed: "Closed",
};

/** Build the stage list for a route, preserving the mandatory Admin → … → Accounts frame. */
export const buildStages = (route: DeptId[]): Stage[] =>
  route.map(dept => ({ dept, status: "queued" as StageStatus }));

/**
 * Admin first, Accounts last. The stations in between keep the order the
 * Operations Manager ticked them in, because the client was explicit that there
 * is no fixed sequence: one uniform may need embroidery before sewing, the next
 * the other way round. Duplicates and unknown departments are dropped.
 */
export const normaliseRoute = (picked: DeptId[]): DeptId[] => {
  const optional = new Set(DEPTS.filter(d => !d.mandatory).map(d => d.id));
  const middle: DeptId[] = [];
  for (const d of picked) {
    if (optional.has(d) && !middle.includes(d)) middle.push(d);
  }
  return ["admin", ...middle, "accounts"];
};

/**
 * If we are drawing the artwork, the job has to stop at Design, otherwise it
 * would sit waiting for a proof that no station is ever asked to make.
 */
export const withDesignIfNeeded = (route: DeptId[], artwork: Artwork): DeptId[] =>
  artwork === "in_house" && !route.includes("design")
    ? ["admin", "design", ...route.slice(1)]
    : route;

/** True when a route is legal: Admin first, Accounts last, no repeats. */
export const routeIsValid = (route: DeptId[]) =>
  route.length >= 2 &&
  route[0] === "admin" &&
  route[route.length - 1] === "accounts" &&
  new Set(route).size === route.length &&
  route.every(d => DEPTS.some(x => x.id === d));

export const fmtP = (n: number) =>
  `P${n.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDue = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
