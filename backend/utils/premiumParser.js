const MULTIPLIERS = {
  k: 1_000,
  thousand: 1_000,
  lakh: 1_00_000,
  lakhs: 1_00_000,
  lac: 1_00_000,
  lacs: 1_00_000,
  lakhs_: 1_00_000,
  crore: 1_00_00_000,
  crores: 1_00_00_000,
  cr: 1_00_00_000,
};

export function parsePremiumToNumber(str) {
  if (str === null || str === undefined) return 0;
  if (typeof str === "number") return Number.isFinite(str) ? Math.round(str) : 0;

  let s = String(str).toLowerCase().trim();
  if (!s) return 0;

  s = s.replace(/[₹,]/g, " ").replace(/\s+/g, " ").trim();

  if (!/\d/.test(s)) return 0;

  const re = /(\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|crores?|cr)?/i;
  const m = s.match(re);
  if (!m) return 0;

  const num = parseFloat(m[1]);
  const unit = (m[2] || "").toLowerCase();

  let value = num;
  if (unit && MULTIPLIERS[unit]) value = num * MULTIPLIERS[unit];

  const isMonthly =
    /\bper month\b/.test(s) || /\/\s*month\b/.test(s) || /\bmonthly\b/.test(s);

  if (isMonthly) value = value * 12;

  return Math.round(value);
}