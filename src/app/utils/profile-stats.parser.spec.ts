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

  it('parses Stardust from Pokémon detail screenshot text', () => {
    const text = `
Pikachu
86 / 86 HP
7.4kg WEIGHT  ELECTRIC  0.46m HEIGHT
5,163,855
STARDUST
17,797
PIKACHU CANDY
    `;
    const result = parseProfileStats(text);
    expect(result?.stardust).toBe(5163855);
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

  it('parses level 80 when line contains 80 > LEVEL', () => {
    const text = `
Stillworld
& Sendai 2026
80 >
LEVEL
TOTAL ACTIVITY
Distance Walked 28,940.9 km
Pokémon Caught 320,584
PokéStops Visited: 188,304
Total XP: 374,219,044
    `;
    const result = parseProfileStats(text);
    expect(result?.level).toBe(80);
    expect(result?.totalXp).toBe(374219044);
    expect(result?.pokemonCaught).toBe(320584);
  });

  it('parses level 80 on same line with chevron: 80 LEVEL >', () => {
    const text = `
Stillworld
& Sendai 2026
80 LEVEL >
BUDDY HISTORY SCRAPBOOK JOURNAL STYLE
TOTAL ACTIVITY
Distance Walked 28,940.9 km
    `;
    const result = parseProfileStats(text);
    expect(result?.level).toBe(80);
  });

  it('parses level 80 with OCR typo in label LEVE1 and trailing noise', () => {
    const text = `
Stillworld
80 > |
LEVE1
BUDDY SCRAPBOOK
    `;
    const result = parseProfileStats(text);
    expect(result?.level).toBe(80);
  });

  it('recovers level 80 from letter confusion BO near LEVEL label', () => {
    const text = `
Stillworld
BO >
LEVEL
BUDDY SCRAPBOOK
    `;
    const result = parseProfileStats(text);
    expect(result?.level).toBe(80);
  });

  it('parses stardust 5163855 from pikachu detail screen with section sign symbol', () => {
    const text = `
7:249) d o aE
RY x
»"
a . y
4h,
= 0.9, NL
SIN
J/
Pikachu /’

86/86 HP ?
74kg | ® | 046m
WEIGHT ELECTRIC HEIGHT

§5163855 OQ 17,797 § 1,044
STARDUST PIKACHU CANDY PIKACHU CANDY
XL
    `;
    const result = parseProfileStats(text);
    expect(result).toBeTruthy();
    expect(result?.stardust).toBe(5163855);
    expect(result?.level).toBeNull();
    expect(result?.pokemonCaught).toBeNull();
    expect(result?.username).toBeNull();
  });

  it('parses clean stardust 5343876 from Fennekin screenshot 1 stripping leading icon artifact', () => {
    const text = `
Ww 0
a I@
Ze @
| Wig =
Ji
Fennekin /’
12/12HP of
123kg | S | 041m
WEIGHT FIRE HEIGHT
15343876 2,387 S340
STARDUST FENNEKIN CANDY FENNEKIN CANDY
XL
GYMS & RAIDS TRAINER BATTLES
(0) Scratch
WEATHER BONUS
VST y = J rr
    `;
    const result = parseProfileStats(text);
    expect(result).toBeTruthy();
    expect(result?.stardust).toBe(5343876);
  });

  it('parses clean stardust 5344076 from Fennekin screenshot 2 ignoring weight line 11.51kg', () => {
    const text = `
11:00 7 J a DCD
0 ce 1v.9, &
no
WA
~ 7 /
~ Pe fi
Ves
IIL
Fennekin /’
42/42 HP of
11.51kg | S | 0.45m
WEIGHT FIRE HEIGHT
15,344,076 © 2,399 S341
STARDUST FENNEKIN CANDY FENNEKIN CANDY
XL
GYMS & RAIDS TRAINER BATTLES
(0) Scratch
WEATHER BONUS
y OR yr Fr ____F¥ J Ve a

11:09 94 all © E
cpl/9 ke
’ 0
’
/
: N
Vg /
Fennekin
42 / 42 HP
11.51kg 0.45m
N 5,344,076 = 2,399 & 341
4 800 S1
his = 25
Ww
GYMS & RAIDS
Scratch ©
&) WEATHER BONUS
    `;
    const result = parseProfileStats(text);
    expect(result).toBeTruthy();
    expect(result?.stardust).toBe(5344076);
  });

  it('parses clean stardust 5343876 from Fennekin screenshot 3 rejecting status bar time 10:2449', () => {
    const text = `
10:2449 | wl 2 [0
cpl3 Ig
{
J
[ J / 3 @ ’
Fennekin
12/12HP
12.3kg 0.41m
15,343,876 2,387 S 340
4 200 S1
54 S25
b)dd
GYMS & RAIDS
Scratch ©
&) WEATHER BONUS
    `;
    const result = parseProfileStats(text);
    expect(result).toBeTruthy();
    expect(result?.stardust).toBe(5343876);
  });

  it('parses clean stardust 5163855 from Pikachu screenshot rejecting top CP noise 1029 and stripping leading icon 4', () => {
    const text = `
7:249) d o aE
RY x
»"
a . y
4h,
= 0.9, NL
SIN
J/
Pikachu /’

86/86 HP ?
74kg | ® | 046m
WEIGHT ELECTRIC HEIGHT

§5163855 OQ 17,797 § 1,044
STARDUST PIKACHU CANDY PIKACHU CANDY
XL
Jo Jo
RAICHU MEGA RAICHU MEGA
ENERGY X ENERGY Y
GYMS & RAIDS TRAINER BATTLES
® Thunder Shock
® Thunderbolt © 8)
TTT

7:24.49 ¢ . + ul 56 E83
+ R658
1029
Wes
| © o ge ~~
Pikachu
86/86 HP
7.4kg 0.46m
45163855 @ 17,797 & 1,044
vo Qo
1 5,000 ) 4
GYMS & RAIDS
Thunder Shock
Thunderbolt ©
    `;
    const result = parseProfileStats(text);
    expect(result).toBeTruthy();
    expect(result?.stardust).toBe(5163855);
  });

  it('parses Mewtwo stardust 4174260 from OCR pass with leading 0 icon artifact (04174260) [example_screenshots/mewtwo_4174260.jpg]', () => {
    const text = `
10/11
192/192 HP
92.71kg | (e] | 1.83m
WEIGHT PSYCHIC HEIGHT
04174260 © 2,534 J 874
STARDUST MEWTWO MEWTWO
CANDY CANDY XL
QJ 18,550 Q) 7,416
MEWTWO MEGA MEWTWO MEGA
ENERGY X ENERGY Y
    `;
    const result = parseProfileStats(text);
    expect(result).toBeTruthy();
    expect(result?.stardust).toBe(4174260);
  });

  it('parses Mewtwo stardust 4174260 from OCR pass with leading 1 icon artifact and single comma (14,174260) [example_screenshots/mewtwo_4174260.jpg]', () => {
    const text = `
192 /192HP
92.71kg 1.83m
WEIGHT PSYCHIC HEIGHT
14,174260 @ 2,534 & 874
STARDUST MEWTWO MEWTWO
CANDY CANDY XL
J 18,550 7,416
MEWTWO MEGA MEWTWO MEGA
ENERGY X ENERGY Y
    `;
    const result = parseProfileStats(text);
    expect(result).toBeTruthy();
    expect(result?.stardust).toBe(4174260);
  });

  it('parses Mewtwo stardust 4174260 when space separates leading digit and icon artifact (4 174,260) [example_screenshots/mewtwo_4174260.jpg]', () => {
    const text = `
192 /192HP
92.71kg 1.83m
WEIGHT PSYCHIC HEIGHT
4 174,260 @ 2,534 & 874
STARDUST MEWTWO MEWTWO
CANDY CANDY XL
    `;
    const result = parseProfileStats(text);
    expect(result).toBeTruthy();
    expect(result?.stardust).toBe(4174260);
  });
});
