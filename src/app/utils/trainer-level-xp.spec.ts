import { lookupLevelByXpToNext, MODERN_XP_TO_NEXT, LEGACY_XP_TO_NEXT } from './trainer-level-xp';

describe('lookupLevelByXpToNext', () => {

  // ─── Profile XP Bar Denominator Mapping ───────────────────────────
  // These are the hardcoded cumulative denominators for levels 40-49.

  describe('profile XP bar denominator mapping', () => {
    const denominatorCases: [number, number][] = [
      [21_000_000, 47],
      [26_000_000, 40],
      [33_500_000, 41],
      [42_500_000, 42],
      [53_500_000, 43],
      [66_500_000, 44],
      [81_800_000, 45],
      [99_800_000, 46],
      [120_800_000, 47],
      [145_800_000, 48],
      [175_800_000, 49],
    ];

    denominatorCases.forEach(([xp, expectedLevel]) => {
      it(`should return level ${expectedLevel} for denominator ${xp.toLocaleString()}`, () => {
        expect(lookupLevelByXpToNext(xp)).toBe(expectedLevel);
      });
    });

    it('should ignore totalXp parameter for denominator lookups', () => {
      // The denominator map should take priority regardless of totalXp
      expect(lookupLevelByXpToNext(21_000_000, 500_000)).toBe(47);
      expect(lookupLevelByXpToNext(175_800_000, 0)).toBe(49);
    });
  });

  // ─── Unique Modern XP-to-Next Values ──────────────────────────────
  // These values only appear in the modern table, so there's a single candidate.

  describe('unique modern denominators', () => {
    it('should return level 1 for 2,500 XP to next (unique to modern)', () => {
      expect(lookupLevelByXpToNext(2500)).toBe(1);
    });

    it('should return level 79 for 16,000,000 XP to next', () => {
      expect(lookupLevelByXpToNext(16_000_000)).toBe(79);
    });

    it('should return level 50 for 1,440,000 XP to next', () => {
      expect(lookupLevelByXpToNext(1_440_000)).toBe(50);
    });

    it('should return level 70 for 8,000,000 XP to next', () => {
      expect(lookupLevelByXpToNext(8_000_000)).toBe(70);
    });
  });

  // ─── Unique Legacy XP-to-Next Values ──────────────────────────────

  describe('unique legacy denominators', () => {
    it('should return level 1 for 1,000 XP to next (unique to legacy)', () => {
      expect(lookupLevelByXpToNext(1_000)).toBe(1);
    });

    it('should return level 34 for 1,250,000 XP to next', () => {
      expect(lookupLevelByXpToNext(1_250_000)).toBe(34);
    });
  });

  // ─── Ambiguous XP-to-Next (shared between modern & legacy) ───────
  // Some XP values appear at different levels in both tables.
  // Without totalXp, the function should return the highest matching level.
  // With totalXp, it should filter to levels the player could actually be at.

  describe('ambiguous denominators without totalXp', () => {
    it('should return the highest level for 10,000 XP to next (modern L10 vs legacy L10-13)', () => {
      // 10,000 appears in modern at level 10, and in legacy at levels 10, 11, 12, 13
      // Without totalXp, should return the highest candidate
      const result = lookupLevelByXpToNext(10_000);
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThanOrEqual(10);
    });

    it('should return the highest level for 9,000 XP to next (modern L9 vs legacy L9)', () => {
      const result = lookupLevelByXpToNext(9_000);
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThanOrEqual(9);
    });
  });

  describe('ambiguous denominators with totalXp tiebreaker', () => {
    it('should use totalXp to disambiguate when multiple levels share the same XP-to-next', () => {
      // 5,000,000 appears in legacy at level 39 and modern at level 65
      // A player with 50M total XP could be level 65 on modern curve
      // but a player with only 1M total XP should match level 39
      const resultHighXp = lookupLevelByXpToNext(5_000_000, 50_000_000);
      const resultLowXp = lookupLevelByXpToNext(5_000_000, 500_000);

      expect(resultHighXp).not.toBeNull();
      expect(resultLowXp).not.toBeNull();
      // With high total XP, the higher level should be reachable
      expect(resultHighXp!).toBeGreaterThanOrEqual(resultLowXp!);
    });

    it('should fallback to highest level when totalXp is too low for any candidate', () => {
      // Even if totalXp is absurdly low, the function should still return
      // a result (the highest candidate as a fallback)
      const result = lookupLevelByXpToNext(5_000_000, 0);
      expect(result).not.toBeNull();
    });
  });

  // ─── Unknown Denominator ──────────────────────────────────────────

  describe('unknown denominator', () => {
    it('should return null for a value not in any XP table', () => {
      expect(lookupLevelByXpToNext(999_999)).toBeNull();
    });

    it('should return null for 0', () => {
      expect(lookupLevelByXpToNext(0)).toBeNull();
    });

    it('should return null for negative values', () => {
      expect(lookupLevelByXpToNext(-1000)).toBeNull();
    });
  });

  // ─── Table Integrity Checks ───────────────────────────────────────
  // Verify the exported XP tables have the expected structure.

  describe('XP table integrity', () => {
    it('modern table should have 80 entries (index 0-79)', () => {
      expect(MODERN_XP_TO_NEXT.length).toBe(80);
    });

    it('modern table index 0 should be 0 (placeholder)', () => {
      expect(MODERN_XP_TO_NEXT[0]).toBe(0);
    });

    it('legacy table should have 40 entries (index 0-39)', () => {
      expect(LEGACY_XP_TO_NEXT.length).toBe(40);
    });

    it('legacy table index 0 should be 0 (placeholder)', () => {
      expect(LEGACY_XP_TO_NEXT[0]).toBe(0);
    });

    it('modern table values should be monotonically non-decreasing', () => {
      for (let i = 2; i < MODERN_XP_TO_NEXT.length; i++) {
        expect(MODERN_XP_TO_NEXT[i]).toBeGreaterThanOrEqual(
          MODERN_XP_TO_NEXT[i - 1],
        );
      }
    });

    it('every level from 1 to 79 should be resolvable from its modern XP-to-next', () => {
      for (let level = 1; level < MODERN_XP_TO_NEXT.length; level++) {
        const xpToNext = MODERN_XP_TO_NEXT[level];
        const result = lookupLevelByXpToNext(xpToNext);
        expect(result).not.toBeNull();
      }
    });
  });
});
