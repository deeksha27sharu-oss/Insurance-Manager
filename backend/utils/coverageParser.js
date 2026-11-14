export function parseCoverageLimit(str) {
  if (!str) return 100000; 
  let s = String(str).toLowerCase().replace(/,/g, "");

  if (s.includes("no upper limit") || s.includes("unlimited")) {
    return 6500000;
  }

  const numbers = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(k|thousand|lakh|lakhs|lac|lacs|crore|crores|cr)?/g)];
  if (numbers.length === 0) return 100000;

  let maxAmount = 0;

  for (const match of numbers) {
    let num = parseFloat(match[1]);
    let unit = match[2];

    if (unit === "k" || unit === "thousand") num *= 1000;
    else if (["lakh", "lakhs", "lac", "lacs"].includes(unit)) num *= 100000;
    else if (["crore", "crores", "cr"].includes(unit)) num *= 10000000;

    if (num > maxAmount) maxAmount = num;
  }

  return maxAmount > 0 ? maxAmount : 100000;
}