import { DistanceUnit, ProfileStats } from '../models/profile-stats';
import { lookupLevelByXpToNext } from './trainer-level-xp';

const MIN_TRAINER_LEVEL = 1;
const MAX_TRAINER_LEVEL = 80;
const MAX_REASONABLE_ACTIVITY_COUNT = 10_000_000;

function parseNumber(value: string): number {
  return parseFloat(value.replace(/,/g, ''));
}

function parseInteger(value: string): number {
  return parseInt(value.replace(/[,.]/g, ''), 10);
}

function normalizeUnit(unit: string): DistanceUnit {
  return unit.toLowerCase().startsWith('mi') ? 'mi' : 'km';
}

function isValidTrainerLevel(level: number): boolean {
  return (
    Number.isInteger(level) &&
    level >= MIN_TRAINER_LEVEL &&
    level <= MAX_TRAINER_LEVEL
  );
}

function isXpProgressLine(line: string): boolean {
  return /\d[\d,]*\s*\/\s*\d[\d,]*/.test(line);
}

function parseLevelCandidate(raw: string): number | null {
  const level = parseInt(raw, 10);
  return isValidTrainerLevel(level) ? level : null;
}

function parseLevelFromXpBar(text: string, totalXp: number | null): number | null {
  // Matches "LEVEL" or OCR variations like "UVEL", followed by the current XP, a slash or space, and the XP to next.
  const match = text.match(/(?:level|uvel|wvel|l.?evel)[^\n]*?([\d,.]+)\s*(?:\/|\s)\s*([\d,.]+)/i);
  if (!match) {
    return null;
  }
  const xpToNext = parseInteger(match[2]);
  if (Number.isNaN(xpToNext)) {
    return null;
  }
  return lookupLevelByXpToNext(xpToNext, totalXp);
}

function cleanUsername(candidate: string): string {
  // Strip anything after '&' (buddy name separator) if OCR merged them
  const cleaned = candidate.split('&')[0].trim();
  const firstWord = cleaned.split(/\s+/)[0];
  let username = firstWord.replace(/[^a-zA-Z0-9_]/g, '');
  
  if (/^Stillworld?y?$/i.test(username) || /^Stillworl[d0-9]?$/i.test(username)) {
    username = 'Stillworld';
  }
  
  if (username.length < 3) {
    return '';
  }
  
  if (/^(pokemon|pokmon|distance|total|level|activity|pokestops?|visited|caught|history|journal|me|buddy|any|play|liar|senet|een|nal|se)$/i.test(username)) {
    return '';
  }

  return username;
}

function parseUsername(text: string): string | null {
  const lines = text.split(/\r?\n/).map(line => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Case 1: Line contains "&" (but not at the very start)
    // e.g. "Stillworld & Malamar"
    if (line.includes('&') && !line.startsWith('&')) {
      const parts = line.split('&');
      const candidate = parts[0].trim();
      if (candidate) {
        const cleaned = cleanUsername(candidate);
        if (cleaned) return cleaned;
      }
    }
    // Case 2: Line starts with "&" (or is just "&"), so the username is on the previous line(s)
    // e.g. "Stillworl\n& Malamar" or "Crosspawz T |\n& 100"
    if (line.startsWith('&')) {
      for (let j = i - 1; j >= 0; j--) {
        const candidate = lines[j];
        if (candidate) {
          const cleaned = cleanUsername(candidate);
          if (cleaned) return cleaned;
        }
      }
    }
  }

  // Fallback: Username is typically the first line of the profile if there's no buddy '&'
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const candidate = lines[i];
    // Ignore known top-level UI elements that sometimes appear
    if (/^\s*(profile|friends|me|niantic)\s*$/i.test(candidate)) continue;
    
    const cleaned = cleanUsername(candidate);
    if (cleaned && cleaned === candidate.trim().split(/\s+/)[0]) {
      return cleaned;
    }
  }

  return null;
}

function parseLevelNearKeyword(text: string): number | null {
  const activityIndex = text.search(/total\s*activity/i);
  const headerText =
    activityIndex >= 0 ? text.slice(0, activityIndex) : text.slice(0, 2500);

  const numberAboveLabel = headerText.match(
    /(?:^|\n)\s*(\d{1,3})[^\n]*\r?\n\s*level\b/im,
  );
  if (numberAboveLabel) {
    const level = parseLevelCandidate(numberAboveLabel[1]);
    if (level !== null) {
      return level;
    }
  }

  const lines = headerText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\blevel\b/i.test(line)) {
      continue;
    }

    if (!isXpProgressLine(line)) {
      const leadingNumber = line.match(/^\s*(\d{1,3})\s+level\b/i);
      if (leadingNumber) {
        const level = parseLevelCandidate(leadingNumber[1]);
        if (level !== null) {
          return level;
        }
      }

      const levelWordFirst = line.match(/\blevel\s*[:\s]*(\d{1,3})\b/i);
      if (levelWordFirst) {
        const level = parseLevelCandidate(levelWordFirst[1]);
        if (level !== null) {
          return level;
        }
      }
    }

    for (let j = 1; j <= 4; j++) {
      const candidateLine = lines[i - j];
      if (!candidateLine || isXpProgressLine(candidateLine)) {
        continue;
      }
      const standalone = candidateLine.trim().match(/^(\d{1,3})$/);
      if (standalone) {
        const level = parseLevelCandidate(standalone[1]);
        if (level !== null) {
          return level;
        }
      }
    }
  }

  // Check for "Unlock these rewards and more at level X"
  const unlockMatch = text.match(/unlock\s+(?:these\s+)?rewards.*at\s+level\s+(\d{1,3})/i);
  if (unlockMatch) {
    const level = parseLevelCandidate(unlockMatch[1]);
    if (level !== null) {
      return level - 1;
    }
  }

  return null;
}

function parseLevel(text: string, totalXp: number | null): number | null {
  // The XP bar denominator is a highly specific huge number that perfectly maps to a level.
  // It is much more robust against OCR noise than random 1-3 digit numbers floating near 'LEVEL'.
  const fromXpBar = parseLevelFromXpBar(text, totalXp);
  if (fromXpBar !== null) {
    return fromXpBar;
  }

  return parseLevelNearKeyword(text);
}

function parseDistance(
  text: string,
): { value: number; unit: DistanceUnit } | null {
  const patterns: RegExp[] = [
    /distance\s*walked\s*([\d,. \t]+)\s*(km|mi(?:les)?)\b/i,
    /distance\s*walked[ \t]*$(?:\r?\n)[ \t]*([\d,. \t]+)\s*(km|mi(?:les)?)\b/im,
    /([\d,. \t]+)\s*(km|mi(?:les)?)\s*(?:walked|walking)?/i,
    /(?:walking\s*)?distance\s*(?:walked)?[ \t:]*([\d,. \t]+)\s*(km|mi(?:les)?)?/i,
    /([\d,. \t]+)\s*(km|mi(?:les)?)\b/i,
  ];

  const candidates: Array<{ value: number; unit: DistanceUnit; digitCount: number }> = [];

  for (const pattern of patterns) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
    
    for (const match of matches) {
      const raw = match[1].trim();
      if (!raw || /^[.,\s]+$/.test(raw)) continue;

      const normalizedDecimal = raw.replace(/,/g, '').replace(/\s+/g, '');
      const digitCount = raw.replace(/[^\d]/g, '').length;
      if (/^\d+\.\d+$/.test(normalizedDecimal)) {
        const value = parseFloat(normalizedDecimal);
        if (!Number.isNaN(value)) {
          const unit = match[2] ? normalizeUnit(match[2]) : 'km';
          candidates.push({ value, unit, digitCount });
        }
        continue;
      }
      
      // Distance in Pogo always has exactly 1 decimal place (e.g. "7,273.7")
      // Tesseract often mistakes the comma for a period ("7.273.7") or drops the period ("7273 7").
      // To be perfectly safe, we strip all non-digits and insert the decimal before the last digit.
      const digitsOnly = raw.replace(/[^\d]/g, '');
      if (digitsOnly.length === 0) continue;
      
      const value = digitsOnly.length > 1 
        ? parseFloat(`${digitsOnly.slice(0, -1)}.${digitsOnly.slice(-1)}`)
        : parseFloat(digitsOnly);

      if (!Number.isNaN(value)) {
        const unit = match[2] ? normalizeUnit(match[2]) : 'km';
        candidates.push({ value, unit, digitCount });
      }
    }
  }

  return candidates.sort((a, b) => b.digitCount - a.digitCount)[0] ?? null;
}

function parsePokemonCaught(text: string): number | null {
  const patterns: RegExp[] = [
    /([\d,.]+)[ \t]+pok[eéè]?\s*mon\s*caught/i,
    /([\d,.]+)[ \t]+pok\w*\s*caught/i,
    /([\d,.]+)[ \t]+pok[eéè]?mon\s*caught/i,
    /pok[eéè]?\s*mon\s*caught[ \t:]*([\d,.]+)/i,
    /pok\w*\s*caught[ \t:]*([\d,.]+)/i,
    /pok[eéè]?mon\s*caught[ \t:]*([\d,.]+)/i,
    /pok[eéè]?\s*mon\s*caught[ \t]*$(?:\r?\n)[ \t]*([\d,.]+)/im,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
    for (const match of matches) {
      const value = parseInteger(match[1]);
      if (
        !Number.isNaN(value) &&
        value > 0 &&
        value < MAX_REASONABLE_ACTIVITY_COUNT
      ) {
        return value;
      }
    }
  }

  return null;
}

function parsePokestopsVisited(text: string): number | null {
  const patterns: RegExp[] = [
    /([\d,.]+)[ \t]+pok[eéè]?s?tops?(?:\s*visited)?/i,
    /pok[eéè]?s?tops?(?:\s*visited)?[^0-9\n]*?([\d,.]+)/i,
    /[rp]o?ks?s?tops?\s*vis\w*[ \t:]*([\d,.]+)/i,
    /posops\w*[ \t:]*([\d,.]+)/i,
    /rous+iops\w*[ \t:]*([\d,.]+)/i,
    /pok[eéè]?s?tops?(?:\s*visited)?[ \t:]*$(?:\r?\n)[ \t]*([\d,.]+)/im,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
    for (const match of matches) {
      const value = parseInteger(match[1]);
      if (
        !Number.isNaN(value) &&
        value > 0 &&
        value < MAX_REASONABLE_ACTIVITY_COUNT
      ) {
        return value;
      }
    }
  }
  return null;
}

function parseStructuralActivityCounts(text: string): {
  pokemonCaught: number | null;
  pokestopsVisited: number | null;
} {
  const counts = new Map<number, number>();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (
      isXpProgressLine(line) ||
      /\b(?:km|mi|miles?)\b/i.test(line) ||
      /\b(?:date|start)\b/i.test(line)
    ) {
      continue;
    }

    for (const match of line.matchAll(/[\d,.]{4,8}/g)) {
      const value = parseInteger(match[0]);
      if (
        !Number.isNaN(value) &&
        value > 999 &&
        value < MAX_REASONABLE_ACTIVITY_COUNT
      ) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
  }

  const candidates = [...counts.entries()]
    .map(([value, frequency]) => ({ value, frequency }))
    .sort((a, b) => b.value - a.value);

  const pokemonCaught = candidates[0]?.value ?? null;
  const pokestopsVisited = candidates
    .filter(candidate => candidate.value !== pokemonCaught)
    .sort((a, b) => b.frequency - a.frequency || b.value - a.value)[0]?.value ?? null;

  return { pokemonCaught, pokestopsVisited };
}

function parseTotalXpFromText(text: string, includeBareXp: boolean): number | null {
  const candidates: number[] = [];
  const patterns: RegExp[] = [
    // Label then value on same line (possibly with non-digit noise between them)
    /total\s*x[pe][^0-9\n]*?([\d,.]{3,})/i,
    // Value then label on same line
    /([\d,.]{6,})[ \t]+total\s*x[pe]/i,
    // OCR typo variants of the label: "tota xe", "tote xp", "tota! xp", "Q ota xe", "Totaixe", etc.
    /[tq]?\s*ota[a-z!]*\s*x[pe][^0-9\n]*?([\d,.]{3,})/i,
    // Team-colored stat text can turn "Total XP" into very short fragments like "Tou".
    /\btou\b[^0-9\n]*?([\d,.]{6,})/i,
    // Same failure mode, but with a trailing/inserted character from OCR.
    /\b(?:tour|roux|rouie)\b[^0-9\n]*?([\d,.]{6,})/i,
    // Label on one line, value on next
    /total\s*x[pe][ \t]*\r?\n[ \t]*([\d,.]+)/im,
  ];

  if (includeBareXp) {
    // Bare "XP:" followed by a large number (>= 5 digits). Only use this
    // in the Total Activity section; profile XP bars are too similar.
    patterns.push(/\bx[pe]\s*:?\s*([\d,.]{5,})/i);
  }

  for (const pattern of patterns) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
    for (const match of matches) {
      const matchedLine = text.slice(0, match.index).split(/\r?\n/).pop() + match[0];
      if (isXpProgressLine(matchedLine)) {
        continue;
      }

      const value = parseInteger(match[1]);
      if (!Number.isNaN(value)) {
        candidates.push(value);
      }
    }
  }

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function parseStructuralTotalXp(text: string): number | null {
  // Structural fallback: Total XP is the only 9+ digit integer in the
  // Total Activity section. Distance is a float, Pokémon/stops are 5-6 digits.
  // This handles the case where a UI overlay button covers the XP number,
  // causing Tesseract to read a symbol (e.g. "©") instead of digits.
  const candidates: number[] = [];
  // Distance is a float, Pokémon/stops are 5-6 digits. XP is typically 7+ characters (including commas).
  const allNumbers = [...text.matchAll(/([\d,.]{7,})/g)];
  for (const m of allNumbers) {
    const candidate = m[1];
    const matchedLine = text.slice(0, m.index).split(/\r?\n/).pop() + m[0];
    // Only treat it as XP if it isn't from the profile XP bar and doesn't
    // have a single decimal point near the end like a distance.
    if (!isXpProgressLine(matchedLine) && !/^\d+,\d{3}\.\d+$/.test(candidate)) {
      const value = parseInteger(candidate);
      if (!Number.isNaN(value) && value > 1_000_000) {
        candidates.push(value);
      }
    }
  }

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function parseTotalXp(text: string): number | null {
  const activityIndex = text.search(/total\s*activity/i);
  if (activityIndex >= 0) {
    const activityText = text.slice(activityIndex);
    return (
      parseTotalXpFromText(activityText, true) ??
      parseStructuralTotalXp(activityText) ??
      parseTotalXpFromText(text, false)
    );
  }

  return parseTotalXpFromText(text, false);
}
export function parseProfileStats(text: string): ProfileStats | null {
  const structuralActivityCounts = parseStructuralActivityCounts(text);
  const totalXp = parseTotalXp(text);
  const level = parseLevel(text, totalXp);
  const distance = parseDistance(text);
  const pokemonCaught = parsePokemonCaught(text) ?? structuralActivityCounts.pokemonCaught;
  const pokestopsVisited = parsePokestopsVisited(text) ?? structuralActivityCounts.pokestopsVisited;
  const username = parseUsername(text);

  if (
    level === null &&
    distance === null &&
    pokemonCaught === null &&
    pokestopsVisited === null &&
    totalXp === null &&
    username === null
  ) {
    return null;
  }

  return {
    level,
    distanceWalked: distance?.value ?? null,
    distanceUnit: distance?.unit ?? null,
    pokemonCaught,
    pokestopsVisited,
    totalXp,
    username,
  };
}
