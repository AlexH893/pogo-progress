import { parseProfileStats } from './profile-stats.parser';

describe('parseProfileStats', () => {
  it('parses standard profile OCR text', () => {
    const text = `
Level 45
1,472.8 km walked
23,501 Pokémon caught
43,832 Pokéstops visited
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 45,
      distanceWalked: 1472.8,
      distanceUnit: 'km',
      pokemonCaught: 23501,
      pokestopsVisited: 43832,
      totalXp: null,
      username: null,
    });
  });

  it('parses walking distance with miles', () => {
    const text = `
Level 32
Walking Distance: 915.2 miles
Pokemon Caught: 12,882
PokéStops Visited: 183,692
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 32,
      distanceWalked: 915.2,
      distanceUnit: 'mi',
      pokemonCaught: 12882,
      pokestopsVisited: 183692,
      totalXp: null,
      username: 'Walking',
    });
  });

  it('parses level above LEVEL label and ignores XP denominator', () => {
    const text = `
Stillworld & Malamar
79
LEVEL
164,816,022 / 16,000,000
TOTAL ACTIVITY
Distance Walked
28,368.0 km
Pokémon Caught
309,542
Pokéstops Visited
183,692
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 79,
      distanceWalked: 28368.0,
      distanceUnit: 'km',
      pokemonCaught: 309542,
      pokestopsVisited: 183692,
      totalXp: null,
      username: 'Stillworld',
    });
  });

  it('infers level from XP bar when OCR omits the large level number', () => {
    const text = `
ME FRIEN p
385
Stillworl
& Malamar
LEVEL 164,816,022/ 16,000,000 1/4
TOTAL ACTIVITY
e? Distance Walked 28,368.0 km
Pokémon Caught 309,542
(@) Pokéstops Visited: 183,692
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 79,
      distanceWalked: 28368.0,
      distanceUnit: 'km',
      pokemonCaught: 309542,
      pokestopsVisited: 183692,
      totalXp: null,
      username: 'Stillworld',
    });
  });

  it('prefers Total Activity XP over the profile XP progress bar', () => {
    const text = `
Stillworld
& Malamar
79
LEVEL
164,816,022 / 16,000,000
TOTAL ACTIVITY
Distance Walked
28,368.0 km
Pokémon Caught
309,542
PokéStops Visited:
183,692
Total XP:
352,169,022
Start Date:
7/6/2016
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 79,
      distanceWalked: 28368.0,
      distanceUnit: 'km',
      pokemonCaught: 309542,
      pokestopsVisited: 183692,
      totalXp: 352169022,
      username: 'Stillworld',
    });
  });

  it('prefers the larger Total Activity XP candidate when OCR fallback adds the XP bar value', () => {
    const text = `
Stillworld
& Malamar
79
LEVEL
164,816,022 / 16,000,000
TOTAL ACTIVITY
Distance Walked
28,368.0 km
Pokémon Caught
309,542
PokéStops Visited:
183,692
Total XP: 164,816,022
Total XP:
352,169,022
Start Date:
7/6/2016
    `;
    const result = parseProfileStats(text);
    expect(result?.totalXp).toBe(352169022);
  });

  it('does not use the profile XP progress bar as bare Total XP', () => {
    const text = `
Stillworld
& Malamar
79
LEVEL
164,816,022 / 16,000,000
TOTAL ACTIVITY
Distance Walked
28,368.0 km
Pokémon Caught
309,542
PokéStops Visited:
183,692
    `;
    const result = parseProfileStats(text);
    expect(result?.totalXp).toBeNull();
  });

  it('tolerates OCR typos and extra spacing', () => {
    const text = `
LEVEL   50
527.11  km   walked
1,788  Pokernon caught
43,832 Pokéstops Visited
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 50,
      distanceWalked: 527.11,
      distanceUnit: 'km',
      pokemonCaught: 1788,
      pokestopsVisited: 43832,
      totalXp: null,
      username: null,
    });
  });

  it('parses user screenshot with Crosspawz and Total XP', () => {
    const text = `
R bls J
12:23 4 —_
° i
ME FRIENDS PARTY
377
Crosspawz T |
& 100
>
a fs : hy
"| X g
H
Le
i:
47 —_—— + >
LEVEL 13,442,433/ 21,000,000 4/4
© © 6
BUDDY SCRAPBOOK JOURNAL STYLE
HISTORY
TOTAL ACTIVITY
o! Distance Walked 8,716.5 km
Pokémon Caught 75,615
(@ Pokéstops Visited: 31,376
QD Tota xe: 113,442,433
(© start Date: © 1/2/2020
WEEKLY PROGRESS
7/14/2025 -7/21/2025
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 47,
      distanceWalked: 8716.5,
      distanceUnit: 'km',
      pokemonCaught: 75615,
      pokestopsVisited: 31376,
      totalXp: 113442433,
      username: 'Crosspawz',
    });
  });

  it('parses user screenshot with Weezing110 and Total XP', () => {
    const text = `
1:33 0 ®4081%
ME I ARTY
—-_—— 8
Weezing110
& Venusaur
” « «7
Y  @ |
\\ - » J ©
Vv
-
ww ww w -
SS ——— a
48 EEEESSESSSSE—— | >
LEVEL 29,807,155/ 25,000,000 2/4
BUDDY SCRAPBOOK JOURNAL STYLE
HISTORY
TOTAL ACTIVITY
Distance Walked 12,703.9 km
Pokémon Caught 159,622
PokéStops Visited: 14,400
Total XP: 150,807,155
Start Date: 7/7/2016
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 48,
      distanceWalked: 12703.9,
      distanceUnit: 'km',
      pokemonCaught: 159622,
      pokestopsVisited: 14400,
      totalXp: 150807155,
      username: 'Weezing110',
    });
  });

  it('parses profile text with a noisy Total XP label and XP-bar level', () => {
    const text = `
Lilyp101
& Gyarados
LEVEL 39,774,767/ 21,000,000
TOTAL ACTIVITY
Distance Walked 12,592.1 km
Pokémon Caught 66,369
PokéStops Visited: 11,779
Tou: 139,774,767
Start Date: 7/14/2016
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 47,
      distanceWalked: 12592.1,
      distanceUnit: 'km',
      pokemonCaught: 66369,
      pokestopsVisited: 11779,
      totalXp: 139774767,
      username: 'Lilyp101',
    });
  });

  it('skips impossible activity counts from noisy OCR fallbacks', () => {
    const text = `
Lilyp101 Bo
& Gyarados
47
we 35.774767/ 21000000 0/4
oF Ohuncewsled  12521km
© eokemoncanne 6360
@ Posopsviites: 11779
Distance Walked 125921km
Pokemon Caught 66369
Pokestops Visited 139,774,767
WVEL  39774767/21000000 0/4
8? Distance Walked 2s721km
@ roksstops vised: 11779
Total XP: 139,774,767
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 47,
      distanceWalked: 12592.1,
      distanceUnit: 'km',
      pokemonCaught: 66369,
      pokestopsVisited: 11779,
      totalXp: 139774767,
      username: 'Lilyp101',
    });
  });

  it('parses Lilyp101 when the right-column fallback omits Pokestops', () => {
    const text = `
Lilyp101 Bo
& Gyarados
47 ———160
we 35.774767/ 21000000 0/4
oF Ohuncewsled  12521km
© eokemoncanne 6360
@ Posopsviites: 11779
© Tour: saris
Distance Walked 125921km
Pokemon Caught 66369
Total XP: 139,774,767
2:029 TEER
ME FRIENDS® PARTY
Lilyp101 Ll
& Gyarados.
47 ———160
wi 99774767/21000000 0/4
8? Distance Walked 2s721km
§ pokemon Caught pes
@ roksstops vised: 11779
© roux 19774767
© start Date: () 711412016
2029 EE
ME FRIENDS® PA]
450
Lilyp101 3
& Gyarados
WVEL  39774767/21000000 0/4
o? Distance Walked 2s721km
@ Pomc 66360
@ roussiopsvisted: 11779
© rouie ws9774767
© start Date: © 711412016
    `;
    const result = parseProfileStats(text);
    expect(result).toEqual({
      level: 47,
      distanceWalked: 12592.1,
      distanceUnit: 'km',
      pokemonCaught: 66369,
      pokestopsVisited: 11779,
      totalXp: 139774767,
      username: 'Lilyp101',
    });
  });

  it('returns partially filled object when fields are missing', () => {
    const text = `
Level 40
TOTAL ACTIVITY
Distance Walked 100.0 km
    `;
    expect(parseProfileStats(text)).toEqual({
      level: 40,
      distanceWalked: 100,
      distanceUnit: 'km',
      pokemonCaught: null,
      pokestopsVisited: null,
      totalXp: null,
      username: null,
    });
  });

  it('returns null when all fields are missing', () => {
    const text = `
Total distance pokemon
    `;
    expect(parseProfileStats(text)).toBeNull();
  });
});
