// The monitor expression AST the app stores (mirror of the frontend's lib/invariants/ast —
// the pieces a CLI needs to WRITE a rule; validation and rendering stay server-side). A
// monitor is `cmp(lhs, op, rhs)` where each side is a bound metric (ref) or an exact
// rational literal (lit). The composer speaks in directions — "alert when it falls below
// 25,000" — and so does the CLI; these helpers translate.

export type CmpOp = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq';

export interface RefTerm {
  type: 'ref';
  alias: string;
  // Exact multiplier on the metric — how a warning tier says "reserves >= liabilities × 1.05".
  scale?: { num: string; den: string };
}
export interface LitTerm {
  type: 'lit';
  num: string; // decimal bigint string (may be negative)
  den: string; // decimal bigint string, > 0
}
export type Term = RefTerm | LitTerm;

export interface InvariantExpr {
  type: 'cmp';
  op: CmpOp;
  lhs: Term;
  rhs: Term;
}

/** Which way a value fails: below a floor, or above a cap. */
export type Direction = 'below' | 'above';
/** Floors and caps, inclusive — the two operators the composer offers. */
export const DIRECTION_OP: Record<Direction, CmpOp> = { below: 'gte', above: 'lte' };

// Aliases are identifier-shaped so rendered rules read like assertions ("share_price >= 1").
export const ALIAS_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;

// A metric label → the identifier it's bound as, the way the composer does it.
export function toAlias(label: string): string {
  const cleaned = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (!cleaned) return 'value';
  return /^[a-z_]/.test(cleaned) ? cleaned : `_${cleaned}`.slice(0, 40);
}

// '1.02' → { num: '102', den: '100' }. Thresholds are exact rationals, never floats.
export function decimalToRational(input: string): { num: string; den: string } | null {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(input.trim().replace(/,/g, ''));
  if (!m) return null;
  const [, sign, whole, frac = ''] = m;
  const den = BigInt('1' + '0'.repeat(frac.length));
  const abs = BigInt(whole + frac);
  const num = sign === '-' ? -abs : abs;
  return { num: num.toString(), den: den.toString() };
}

/** "metric <op> threshold". */
export function buildBoundExpr(alias: string, op: CmpOp, threshold: string): InvariantExpr {
  const lit = decimalToRational(threshold);
  if (!lit) throw new Error(`Threshold must be a plain number like 25000 or 1.02 (got: ${threshold})`);
  if (!ALIAS_RE.test(alias)) throw new Error(`Bad alias: ${alias}`);
  return { type: 'cmp', op, lhs: { type: 'ref', alias }, rhs: { type: 'lit', ...lit } };
}

/** "metric <op> otherMetric". */
export function buildCompareExpr(lhsAlias: string, op: CmpOp, rhsAlias: string): InvariantExpr {
  if (!ALIAS_RE.test(lhsAlias) || !ALIAS_RE.test(rhsAlias) || lhsAlias === rhsAlias) {
    throw new Error(`Bad aliases for a comparison: ${lhsAlias} vs ${rhsAlias}`);
  }
  return { type: 'cmp', op, lhs: { type: 'ref', alias: lhsAlias }, rhs: { type: 'ref', alias: rhsAlias } };
}

// "reserves >= liabilities" warned at 5% → "reserves >= liabilities × 1.05" (a cap flips to
// × 0.95). The percentage is a plain decimal; the scale stays an exact rational.
export function buildWarnCompareExpr(lhsAlias: string, op: CmpOp, rhsAlias: string, pct: string): InvariantExpr {
  const p = decimalToRational(pct);
  const dir: Direction | null = op === 'gte' || op === 'gt' ? 'below' : op === 'lte' || op === 'lt' ? 'above' : null;
  if (!p || !dir) throw new Error(`--warn-pct must be a plain percentage like 5 or 2.5 (got: ${pct})`);
  const pn = BigInt(p.num);
  const pd = BigInt(p.den);
  if (pn <= BigInt(0)) throw new Error('--warn-pct must be greater than 0');
  const hundred = BigInt(100);
  // 1 ± p/100 = (100·pd ± pn) / (100·pd)
  const den = hundred * pd;
  const num = dir === 'below' ? den + pn : den - pn;
  if (num <= BigInt(0)) throw new Error('--warn-pct must be under 100 for a cap');
  return {
    type: 'cmp',
    op,
    lhs: { type: 'ref', alias: lhsAlias },
    rhs: { type: 'ref', alias: rhsAlias, scale: { num: num.toString(), den: den.toString() } },
  };
}

// "30m" / "2h" / "1d" / an ISO date → the instant it names. For snoozes.
export function parseUntil(raw: string, now: Date = new Date()): Date {
  const m = /^(\d+)\s*(m|min|h|hr|d)$/i.exec(raw.trim());
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const ms = unit.startsWith('m') ? 60_000 : unit.startsWith('h') ? 3_600_000 : 86_400_000;
    return new Date(now.getTime() + n * ms);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`Give a duration (30m, 2h, 1d) or an ISO date (got: ${raw})`);
  return d;
}
