/**
 * XP required to reach the next trainer level (profile bar denominator).
 * Source: https://leekduck.com/references/trainer-levels/
 * Index = current level, value = XP needed to advance to level + 1.
 */
export const MODERN_XP_TO_NEXT: readonly number[] = [
  0,
  2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
  12000, 14000, 16000, 18000, 21000, 24500, 28000, 31500, 35000, 42000,
  49000, 56000, 63000, 70000, 83000, 96000, 109000, 122000, 135000, 158000,
  181000, 204000, 227000, 250000, 290000, 330000, 370000, 410000, 450000, 520000,
  590000, 660000, 730000, 800000, 900000, 1000000, 1100000, 1200000, 1300000, 1440000,
  1580000, 1720000, 1860000, 2000000, 2200000, 2400000, 2600000, 2800000, 3000000, 3350000,
  3700000, 4050000, 4400000, 4750000, 5250000, 5750000, 6250000, 6750000, 7250000, 8000000,
  8750000, 9500000, 10250000, 11000000, 12000000, 13000000, 14000000, 15000000, 16000000,
];

export const LEGACY_XP_TO_NEXT: readonly number[] = [
  0,
  1_000,       // 1->2
  2_000,       // 2->3
  3_000,       // 3->4
  4_000,       // 4->5
  5_000,       // 5->6
  6_000,       // 6->7
  7_000,       // 7->8
  8_000,       // 8->9
  9_000,       // 9->10
  10_000,      // 10->11
  10_000,      // 11->12
  10_000,      // 12->13
  10_000,      // 13->14
  15_000,      // 14->15
  20_000,      // 15->16
  20_000,      // 16->17
  20_000,      // 17->18
  25_000,      // 18->19
  25_000,      // 19->20
  50_000,      // 20->21
  75_000,      // 21->22
  100_000,     // 22->23
  125_000,     // 23->24
  150_000,     // 24->25
  190_000,     // 25->26
  200_000,     // 26->27
  250_000,     // 27->28
  300_000,     // 28->29
  350_000,     // 29->30
  500_000,     // 30->31
  500_000,     // 31->32
  750_000,     // 32->33
  1_000_000,   // 33->34
  1_250_000,   // 34->35
  1_500_000,   // 35->36
  2_000_000,   // 36->37
  2_500_000,   // 37->38
  3_000_000,   // 38->39
  5_000_000,   // 39->40
];

const xpCandidates = new Map<number, { level: number; cumulativeXp: number }[]>();

function buildCumulativeXp(table: readonly number[]) {
  const cumulative = [0];
  let sum = 0;
  for (let i = 1; i < table.length; i++) {
    sum += table[i - 1];
    cumulative.push(sum);
  }
  return cumulative;
}

const modernCumulative = buildCumulativeXp(MODERN_XP_TO_NEXT);
const legacyCumulative = buildCumulativeXp(LEGACY_XP_TO_NEXT);

function addCandidate(xp: number, level: number, cumulativeXp: number) {
  if (!xpCandidates.has(xp)) xpCandidates.set(xp, []);
  xpCandidates.get(xp)!.push({ level, cumulativeXp });
}

for (let level = 1; level < MODERN_XP_TO_NEXT.length; level++) {
  if (MODERN_XP_TO_NEXT[level] > 0) {
    addCandidate(MODERN_XP_TO_NEXT[level], level, modernCumulative[level]);
  }
}

for (let level = 1; level < LEGACY_XP_TO_NEXT.length; level++) {
  if (LEGACY_XP_TO_NEXT[level] > 0) {
    addCandidate(LEGACY_XP_TO_NEXT[level], level, legacyCumulative[level]);
  }
}

// Levels 41-50 show the total cumulative XP required for that level in the denominator,
// instead of the XP required from previous level.
const profileXpBarDenominatorToLevel = new Map<number, number>([
  [21_000_000, 47], // XP required for 47 -> 48
  [26_000_000, 40], // sometimes displayed if 40 but advancing
  [33_500_000, 41],
  [42_500_000, 42],
  [53_500_000, 43],
  [66_500_000, 44],
  [81_800_000, 45],
  [99_800_000, 46],
  [120_800_000, 47],
  [145_800_000, 48],
  [175_800_000, 49],
]);

export function lookupLevelByXpToNext(xpToNext: number, totalXp: number | null = null): number | null {
  const denominatorLvl = profileXpBarDenominatorToLevel.get(xpToNext);
  if (denominatorLvl) {
    return denominatorLvl;
  }

  const candidates = xpCandidates.get(xpToNext);
  if (!candidates || candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1 || totalXp === null) {
    // Return highest level if we don't have total XP to disambiguate
    return Math.max(...candidates.map(c => c.level));
  }

  // Filter candidates where the user has at least the cumulative XP required to reach that level.
  const validCandidates = candidates.filter(c => totalXp >= c.cumulativeXp);
  
  if (validCandidates.length === 0) {
    // If none are mathematically possible, fallback to the highest (modern) curve to be safe
    return Math.max(...candidates.map(c => c.level));
  }

  // Return the highest valid level
  return Math.max(...validCandidates.map(c => c.level));
}
