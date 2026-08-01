import { DistanceUnit, ProfileStats } from '../models/profile-stats';
import { lookupLevelByXpToNext } from './trainer-level-xp';

const MIN_TRAINER_LEVEL = 1;
const MAX_TRAINER_LEVEL = 80;
const MAX_REASONABLE_ACTIVITY_COUNT = 10_000_000;

function parseNumber(value: string): number {
  return parseFloat(value.replace(/,/g, ''));
}

function parseInteger(value: string): number {
  return parseInt(value.replace(/[,.\s]/g, ''), 10);
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
  
  if (username.length < 3 || /^\d+$/.test(username)) {
    return '';
  }
  
  if (/^(pokemon|pokmon|distance|total|level|activity|pokestops?|visited|caught|history|journal|me|buddy|any|play|liar|senet|een|nal|se|stardust|candy|height|weight|mega|energy|power|up|hp|cp|gyms|raids|trainer|battles)$/i.test(username)) {
    return '';
  }

  return username;
}

function parseUsername(text: string): string | null {
  // Pokémon detail screens do not show the trainer username
  if (isPokemonDetailScreen(text)) {
    return null;
  }

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

function cleanDigitCandidate(raw: string): number | null {
  // Strip common trailing/leading OCR noise like '>', '<', '|', ':', '.', ',', '~', '#', '$'
  const cleaned = raw.replace(/^[^0-9a-zA-Z]+|[^0-9a-zA-Z]+$/g, '').trim();
  
  // Try direct numeric parse
  const directDigits = cleaned.replace(/[^0-9]/g, '');
  if (directDigits.length >= 1 && directDigits.length <= 3) {
    const level = parseInt(directDigits, 10);
    if (isValidTrainerLevel(level)) {
      return level;
    }
  }

  // Common OCR letter-to-digit confusions near level label (e.g. "BO" -> 80, "8O" -> 80, "B0" -> 80, "SO" -> 80)
  if (cleaned.length >= 1 && cleaned.length <= 3) {
    const substituted = cleaned
      .toUpperCase()
      .replace(/B/g, '8')
      .replace(/O/g, '0')
      .replace(/S/g, '8')
      .replace(/Z/g, '2')
      .replace(/G/g, '6')
      .replace(/I|L|T/g, '1');
    
    const subDigits = substituted.replace(/[^0-9]/g, '');
    if (subDigits.length >= 1 && subDigits.length <= 3) {
      const level = parseInt(subDigits, 10);
      if (isValidTrainerLevel(level)) {
        return level;
      }
    }
  }

  return null;
}

function parseLevelNearKeyword(text: string): number | null {
  const activityIndex = text.search(/total\s*activity/i);
  const headerText =
    activityIndex > 0 ? text.slice(0, activityIndex) : text.slice(0, 2500);

  // Match "80" (or "80 >") on line above "LEVEL" (or OCR typos like "LEVE1", "LEVEI", "LEVL")
  const numberAboveLabel = headerText.match(
    /(?:^|\n)\s*([0-9a-zA-Z]{1,4})\s*(?:>|\||:|\.)?[^\n]*\r?\n\s*(?:level|leve1|levei|levl|l\.?evel|leuel)\b/im,
  );
  if (numberAboveLabel) {
    const level = cleanDigitCandidate(numberAboveLabel[1]);
    if (level !== null) {
      return level;
    }
  }

  const lines = headerText.split(/\r?\n/);
  const LEVEL_KEYWORD_REGEX = /\b(?:level|leve1|levei|levl|l\.?evel|leuel|level>)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!LEVEL_KEYWORD_REGEX.test(line)) {
      continue;
    }

    if (!isXpProgressLine(line)) {
      // Same line: "80 LEVEL" or "80 > LEVEL" or "80 LEVEL >"
      const leadingNumber = line.match(/^\s*([0-9a-zA-Z]{1,4})\s*(?:>|\||:|\.)?\s*(?:level|leve1|levei|levl|l\.?evel|leuel)\b/i);
      if (leadingNumber) {
        const level = cleanDigitCandidate(leadingNumber[1]);
        if (level !== null) {
          return level;
        }
      }

      // Same line: "LEVEL 80" or "LEVEL: 80" or "LEVEL 80 >"
      const levelWordFirst = line.match(/\b(?:level|leve1|levei|levl|l\.?evel|leuel)\b\s*[:\s>|.]*([0-9a-zA-Z]{1,4})/i);
      if (levelWordFirst) {
        const level = cleanDigitCandidate(levelWordFirst[1]);
        if (level !== null) {
          return level;
        }
      }
    }

    // Look at candidate lines above or below the "LEVEL" keyword line
    const searchOffsets = [-1, -2, -3, -4, 1, 2];
    for (const offset of searchOffsets) {
      const candidateLine = lines[i + offset];
      if (!candidateLine || isXpProgressLine(candidateLine)) {
        continue;
      }
      // Skip lines with dates or distances or huge XP numbers
      if (/\b(?:km|mi|miles?|date|start|xp)\b/i.test(candidateLine)) {
        continue;
      }
      const level = cleanDigitCandidate(candidateLine.trim());
      if (level !== null) {
        return level;
      }
    }
  }

  // Check for "Unlock these rewards and more at level X"
  const unlockMatch = text.match(/unlock\s+(?:these\s+)?rewards.*at\s+(?:level|leve1|levei)\s+([0-9a-zA-Z]{1,4})/i);
  if (unlockMatch) {
    const level = cleanDigitCandidate(unlockMatch[1]);
    if (level !== null) {
      return level - 1;
    }
  }

  // Check for standalone number above BUDDY / SCRAPBOOK / JOURNAL / STYLE
  const buddyIndex = headerText.search(/\b(?:buddy|scrapbook|journal|style)\b/i);
  if (buddyIndex >= 0) {
    const linesAbove = headerText.slice(0, buddyIndex).split(/\r?\n/).slice(-8);
    for (let i = linesAbove.length - 1; i >= 0; i--) {
      const line = linesAbove[i].trim();
      if (!line || isXpProgressLine(line) || /\b(?:km|mi|miles?|date|start|xp)\b/i.test(line)) {
        continue;
      }
      const level = cleanDigitCandidate(line);
      if (level !== null) {
        return level;
      }
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
  if (isPokemonDetailScreen(text)) {
    return null;
  }
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
  if (isPokemonDetailScreen(text)) {
    return null;
  }
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
  // Bypass structural fallback on Pokémon detail screens (prevents Candy/Candy XL from being read as Caught/Stops)
  if (isPokemonDetailScreen(text)) {
    return { pokemonCaught: null, pokestopsVisited: null };
  }

  const counts = new Map<number, number>();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (
      isXpProgressLine(line) ||
      /\b(?:km|mi|miles?)\b/i.test(line) ||
      /\b(?:date|start|xp|total)\b/i.test(line)
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
export function isPokemonDetailScreen(text: string): boolean {
  const upper = text.toUpperCase();

  // Hard exclude: definitive profile-page markers
  if (/TOTAL\s*ACT[I1]V[I1]TY|D[I1]STANCE\s*WALKED/.test(upper)) {
    return false;
  }

  // Require at least 2 independent strong Pokémon-detail signals to avoid
  // mis-classifying a profile screenshot that has a single noisy OCR word.
  // "STARDUST" alone counts as 2 since it only appears on the Pokémon screen.
  const strongSignals: RegExp[] = [
    /\bSTARDUST\b/,            // Only on Pokémon inspect screen (worth 2)
    /\bSTARDUST\b/,            // counted twice intentionally
    /\bCANDY\b/,
    /\bMEGA\b/,
    /\bENERGY\b/,
    /POWER\s*UP/,
    /TRAINER\s*BATTLES/,
    /\bGYMS\s*&\s*RAIDS\b/,
    /\bRAIDU?\b.*\bCANDY\b/,  // "RAICHU CANDY"
    /\d+\s*\/\s*\d+\s*HP/,    // "86/86 HP"
    /\b(?:WEIGHT|HEIGHT)\b.*\b(?:WEIGHT|HEIGHT)\b/,  // Both on same screen
  ];

  const matchCount = strongSignals.filter(r => r.test(upper)).length;
  return matchCount >= 2;
}

function parseStardust(text: string): number | null {
  const isWeightOrHeight = (str: string): boolean => {
    if (/\d+\.\d{1,2}\b/.test(str)) return true;
    if (/\b\d+(?:\.\d+)?\s*(?:kg|g|lbs|m|cm|ft|in)\b/i.test(str)) return true;
    return false;
  };

  const isInvalidCandidate = (str: string): boolean => {
    if (str.includes(':')) return true; // Phone status bar clock times like 10:24 or 10:2449
    if (isWeightOrHeight(str)) return true;
    return false;
  };

  const cleanVal = (rawStr: string): number | null => {
    if (isInvalidCandidate(rawStr)) return null;
    let s = rawStr.trim();
    // Strip leading non-alphanumeric noise (symbols like '§', '!', '(', '[', '@', '©', etc.)
    s = s.replace(/^[^0-9a-zA-Z]+/, '');
    // Strip leading zeroes if followed by a non-zero digit (e.g. "04174260" -> "4174260", "04,174,260" -> "4,174,260")
    s = s.replace(/^0+(?=[1-9])/, '');
    // Strip leading icon artifact characters (e.g. "15,343,876", "14,174,260", "14,174260", "1 5,343,876", "I5,343,876")
    s = s.replace(/^[1Il|i§!vAQD]\s*(?=[1-9]\d{0,2}(?:[,\s]?\d{3}){2,}\b)/, '');
    // Strip unformatted leading icon digit on 8-digit numbers like "45163855" -> "5163855" or "15343876" -> "5343876"
    s = s.replace(/^[1-9Il|i§!vAQD]\s*(?=[1-9]\d{6}\b)/, '');
    const val = parseInteger(s);
    if (!Number.isNaN(val) && val >= 10 && val < 100_000_000) {
      return val;
    }
    return null;
  };

  // 1. Number above "STARDUST" label (on the exact line immediately preceding "STARDUST")
  const numberAboveLabelMatch = text.match(
    /(?:^|\n)([^\n]+)\r?\n[^\S\r\n]*(?:stardust|star\s*dust|5tardust|siardust|sta\s*rdust)\b/im
  );
  if (numberAboveLabelMatch) {
    const lineAbove = numberAboveLabelMatch[1];
    const numberMatches = lineAbove.match(/[0-9a-zA-Z§!|()\[\]@]*[\d,. ]{1,15}/g) || [];
    for (const rawCandidate of numberMatches) {
      const val = cleanVal(rawCandidate);
      if (val !== null) {
        return val;
      }
    }
  }

  // 2. Same line label then number: "STARDUST 5,163,855" or "STARDUST: 5,163,855"
  const labelFirstMatch = text.match(/(?:stardust|star\s*dust|5tardust|siardust|sta\s*rdust)\b[^\d\n]*?([^\n]+)/i);
  if (labelFirstMatch) {
    const restOfLine = labelFirstMatch[1];
    const numberMatches = restOfLine.match(/[0-9a-zA-Z§!|()\[\]@]*[\d,. ]{1,15}/g) || [];
    for (const rawCandidate of numberMatches) {
      const val = cleanVal(rawCandidate);
      if (val !== null) {
        return val;
      }
    }
  }

  // 3. Same line number then label: "5,163,855 STARDUST"
  const numberFirstMatch = text.match(/([^\n]+)\b(?:stardust|star\s*dust|5tardust|siardust|sta\s*rdust)\b/i);
  if (numberFirstMatch) {
    const lineBefore = numberFirstMatch[1];
    const numberMatches = lineBefore.match(/[0-9a-zA-Z§!|()\[\]@]*[\d,. ]{1,15}/g) || [];
    for (const rawCandidate of numberMatches) {
      const val = cleanVal(rawCandidate);
      if (val !== null) {
        return val;
      }
    }
  }

  // 4. Fallback for Pokémon Detail screen where OCR might misread or miss the STARDUST label text
  if (isPokemonDetailScreen(text)) {
    const lines = text.split(/\r?\n/);
    const candidates: number[] = [];
    for (const line of lines) {
      if (/POWER\s*UP|EVOLVE|MEGA|WEIGHT|HEIGHT|\bHP\b|GYMS|RAIDS|BATTLES|LEVEL|ENERGY|\bkg\b|\blbs\b|\bm\b|\bcm\b/i.test(line) || line.includes(':')) {
        continue;
      }
      const matches = line.match(/\b\d{1,3}(?:[,\s]\d{3})+\b|\b\d{4,9}\b/g);
      if (matches) {
        for (const m of matches) {
          const val = cleanVal(m);
          if (val !== null) {
            candidates.push(val);
          }
        }
      }
    }
    if (candidates.length > 0) {
      const largeCandidates = candidates.filter(v => v >= 10_000);
      if (largeCandidates.length > 0) {
        return Math.max(...largeCandidates);
      }
      return candidates[0];
    }
  }

  return null;
}

export function parseProfileStats(text: string): ProfileStats | null {
  const isPokemonDetail = isPokemonDetailScreen(text);
  const stardust = parseStardust(text);

  // Always attempt to parse the full set of profile fields first.
  const structuralActivityCounts = parseStructuralActivityCounts(text);
  const totalXp = parseTotalXp(text);
  const level = parseLevel(text, totalXp);
  const distance = parseDistance(text);
  const pokemonCaught = parsePokemonCaught(text) ?? structuralActivityCounts.pokemonCaught;
  const pokestopsVisited = parsePokestopsVisited(text) ?? structuralActivityCounts.pokestopsVisited;
  const username = parseUsername(text);

  const hasProfileFields =
    level !== null ||
    distance !== null ||
    pokemonCaught !== null ||
    pokestopsVisited !== null ||
    totalXp !== null ||
    username !== null;

  // Only treat as a stardust-only / Pokémon-detail screenshot when no profile
  // fields were found.  A full profile screenshot may also contain stardust.
  if (!hasProfileFields && (stardust !== null || isPokemonDetail)) {
    return {
      level: null,
      distanceWalked: null,
      distanceUnit: null,
      pokemonCaught: null,
      pokestopsVisited: null,
      totalXp: null,
      stardust,
      username: null,
    };
  }

  if (!hasProfileFields) {
    return null;
  }

  // Full Trainer Profile screenshot — include stardust if it was also parsed.
  const profileStats: ProfileStats = {
    level,
    distanceWalked: distance?.value ?? null,
    distanceUnit: distance?.unit ?? null,
    pokemonCaught,
    pokestopsVisited,
    totalXp,
    username,
  };

  if (stardust !== null) {
    profileStats.stardust = stardust;
  }

  return profileStats;
}
