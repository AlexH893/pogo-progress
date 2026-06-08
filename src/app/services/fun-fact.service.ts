import { Injectable } from '@angular/core';
import { ProfileStats } from '../models/profile-stats';

interface Milestone {
  threshold: number;
  generate: (val: number) => string;
}

@Injectable({
  providedIn: 'root'
})
export class FunFactService {

  private readonly DISTANCE_MILESTONES: Milestone[] = [
    { threshold: 2.74, generate: (d) => `You've crossed the Golden Gate Bridge ${(d / 2.74).toLocaleString(undefined, { maximumFractionDigits: 0 })} times!` },
    { threshold: 5, generate: (d) => `You've logged enough distance to complete a 5K race ${(d / 5).toLocaleString(undefined, { maximumFractionDigits: 0 })} times over!` },
    { threshold: 8.849, generate: (d) => `You've walked the height of Mount Everest ${(d / 8.849).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 10.94, generate: (d) => `You've walked the depth of the Mariana Trench ${(d / 10.94).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 34, generate: (d) => `You've covered the width of the English Channel ${(d / 34).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 42.195, generate: (d) => `You've walked the length of a marathon ${(d / 42.195).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 408, generate: (d) => `You've walked enough to reach the International Space Station ${(d / 408).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 446, generate: (d) => `You've walked the length of the Grand Canyon ${(d / 446).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 3474, generate: (d) => `You've walked the entire diameter of the Moon ${(d / 3474).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 3940, generate: (d) => `You've walked the length of historic Route 66 ${(d / 3940).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 4265, generate: (d) => `You've hiked the entire Pacific Crest Trail ${(d / 4265).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 4500, generate: (d) => `You've walked the equivalent of walking from New York to Los Angeles ${(d / 4500).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 6650, generate: (d) => `You've walked the entire length of the Nile River ${(d / 6650).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 9289, generate: (d) => `You've walked the length of the Trans-Siberian Railway ${(d / 9289).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 20004, generate: (d) => `You've walked from the North Pole to the South Pole ${(d / 20004).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 21196, generate: (d) => `You've walked the length of the Great Wall of China ${(d / 21196).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 40075, generate: (d) => `You've walked enough to circle the Earth ${(d / 40075).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!` },
    { threshold: 384400, generate: (d) => `You've walked all the way to the Moon! (${(d / 384400).toFixed(2)} times)` },
  ];

  private readonly POPULATION_MILESTONES: Milestone[] = [
    { threshold: 1000, generate: () => `You've caught enough total Pokémon to exceed the entire population of Vatican City!` },
    { threshold: 5000, generate: () => `Your lifetime catches rival the residents of a famous mountain town like Aspen, Colorado!` },
    { threshold: 10000, generate: () => `You've caught enough Pokémon to fully populate the scenic town of Sedona, Arizona!` },
    { threshold: 25000, generate: () => `Your total catches rival the population of Key West, Florida!` },
    { threshold: 39000, generate: () => `If you kept every Pokémon you've caught, you'd have more residents than the entire country of Monaco!` },
    { threshold: 85000, generate: () => `You've caught enough Pokémon to rival the population of Santa Fe, New Mexico!` },
    { threshold: 100000, generate: () => `Your total lifetime catches rival the population of a mid-sized city like Green Bay, Wisconsin!` },
    { threshold: 250000, generate: () => `Your lifetime catches rival the population of Boise, Idaho!` },
    { threshold: 500000, generate: () => `You've caught enough Pokémon over your journey to completely populate the city of Miami, Florida!` },
    { threshold: 750000, generate: () => `You've caught enough Pokémon to outnumber the entire population of Seattle, Washington!` },
    { threshold: 1000000, generate: () => `Over your career, you've caught a number of Pokémon larger than the entire population of San Francisco!` },
    { threshold: 2000000, generate: () => `Your total catches exceed the population of Paris, France!` },
    { threshold: 4000000, generate: () => `You've caught enough Pokémon to populate the entire city of Los Angeles!` },
    { threshold: 8300000, generate: () => `Incredible! Your total lifetime catches match the sprawling population of New York City!` },
    { threshold: 14000000, generate: () => `Mind-blowing! Your lifetime catches outnumber the vast population of Tokyo, Japan!` },
  ];

  generateFacts(stats: ProfileStats | null, dailyAverages?: any): string[] {
    if (!stats) return [];

    const facts: string[] = [];
    const distance = stats.distanceWalked || 0;
    const caught = stats.pokemonCaught || 0;
    const xp = stats.totalXp || 0;
    const stops = stats.pokestopsVisited || 0;

    // 1. Distance Milestones (Pick the highest achieved, plus one random other achieved)
    if (distance > 0) {
      const passedDistances = this.DISTANCE_MILESTONES.filter(m => distance >= m.threshold);
      if (passedDistances.length > 0) {
        const highest = passedDistances[passedDistances.length - 1];
        facts.push(highest.generate(distance));

        if (passedDistances.length > 1) {
          const others = passedDistances.slice(0, passedDistances.length - 1);
          const randomOther = others[Math.floor(Math.random() * others.length)];
          facts.push(randomOther.generate(distance));
        }
      }
    }

    // 2. Population Milestones (Pick the highest achieved, plus one random other achieved)
    if (caught > 0) {
      const passedPops = this.POPULATION_MILESTONES.filter(m => caught >= m.threshold);
      if (passedPops.length > 0) {
        const highest = passedPops[passedPops.length - 1];
        facts.push(highest.generate(caught));

        if (passedPops.length > 1) {
          const others = passedPops.slice(0, passedPops.length - 1);
          const randomOther = others[Math.floor(Math.random() * others.length)];
          facts.push(randomOther.generate(caught));
        }
      }

      // Base catch facts
      facts.push(`You've caught enough Pokémon to fill ${(caught / 30).toLocaleString(undefined, { maximumFractionDigits: 0 })} standard PC boxes in the main series games!`);
      
      // Catch time estimation (10-17s per catch, average 12)
      facts.push(`If each catch takes roughly 12 seconds, you've spent ${(caught * 12 / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 })} hours just throwing Poké Balls!`);

      // Snorlax weight fact — a Snorlax weighs 460 kg, a blue whale ~140 tons
      const totalWeightTons = (caught * 460) / 1000;
      if (totalWeightTons >= 140) {
        const blueWhales = totalWeightTons / 140;
        facts.push(`If every Pokémon you caught weighed as much as a Snorlax (460 kg), your collection would weigh ${totalWeightTons.toLocaleString(undefined, { maximumFractionDigits: 0 })} tons — heavier than ${blueWhales.toFixed(1)} blue whales!`);
      }
    }

    // 3. PokéStop facts
    if (stops > 0) {
      facts.push(`At 50 XP per spin, you've earned at least ${(stops * 50).toLocaleString()} XP just from spinning Pokéstops!`);
      facts.push(`At 5 seconds per spin, you've spent ${(stops * 5 / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 })} hours just spinning at Pokéstops!`);
    }

    // 4. XP facts (thresholds updated for Oct 2025 rebalance)
    if (xp > 0) {
      if (xp < 3953000) {
        facts.push(`You are ${((xp / 3953000) * 100).toFixed(1)}% of the way to Level 40!`);
      } else if (xp < 12753000) {
        facts.push(`You are ${((xp / 12753000) * 100).toFixed(1)}% of the way to Level 50!`);
      } else if (xp < 203353000) {
        facts.push(`You are ${((xp / 203353000) * 100).toFixed(1)}% of the way to Level 80!`);
      } else {
        facts.push(`You have enough XP to reach Level 80 ${(xp / 203353000).toFixed(2)} times!`);
      }
      facts.push(`You've earned enough XP to reach Level 40 over ${(xp / 3953000).toLocaleString(undefined, { maximumFractionDigits: 1 })} times!`);

      // Main series XP comparison: reaching Level 100 requires ~1,000,000 XP
      // in the Medium Fast growth rate (the most common group)
      if (xp >= 6000000) {
        const pokemonMaxed = Math.floor(xp / 1000000);
        const partiesMaxed = xp / 6000000;
        facts.push(`In main series terms, your ${xp.toLocaleString()} XP could raise ${pokemonMaxed.toLocaleString()} Pokémon to Level 100 — that's ${partiesMaxed.toFixed(1)} full parties of six!`);
      }
    }

    // 5. Cross-metric facts
    if (distance > 0 && caught > 0) {
      facts.push(`You catch an average of ${(caught / distance).toFixed(1)} Pokémon per kilometer walked.`);
      facts.push(`You walk about ${((distance / caught) * 1000).toFixed(0)} meters for every Pokémon you catch.`);
      
      const pacePerPokemonMins = (distance / caught) * 12; // assuming 12 mins per km (5km/h)
      if (pacePerPokemonMins < 60) {
        facts.push(`At a typical walking pace, you catch a Pokémon roughly every ~${pacePerPokemonMins.toFixed(1)} minutes you spend walking!`);
      }
      
      facts.push(`You take about ${((distance / caught) * 1300).toFixed(0)} steps for every Pokémon you add to your collection!`);
      facts.push(`If you walked a full marathon (42.2km), you'd be on pace to catch ${((caught / distance) * 42.195).toFixed(0)} Pokémon along the way!`);
    }

    if (caught > 0 && xp > 0) {
      const xpPerCatch = xp / caught;
      facts.push(`Your XP-to-catch ratio is ${xpPerCatch.toLocaleString(undefined, { maximumFractionDigits: 0 })} XP per Pokémon — ${xpPerCatch > 500 ? 'you\'re an XP-grinding machine!' : xpPerCatch > 300 ? 'a solid XP earner!' : 'pure catch dedication!'}`);
    }

    if (distance > 0 && stops > 0) {
      facts.push(`You spin a PokéStop every ${(distance / stops).toFixed(2)} km you walk.`);
    }

    if (distance > 0 && xp > 0) {
      facts.push(`You earn an average of ${(xp / distance).toLocaleString(undefined, { maximumFractionDigits: 0 })} XP per kilometer walked.`);
    }

    // 6. Pace facts (if daily averages are available)
    if (dailyAverages) {
      if (dailyAverages.totalXp > 0) {
        if (xp < 12753000) {
          const daysTo50 = (12753000 - xp) / dailyAverages.totalXp;
          const yearsTo50 = daysTo50 / 365;
          if (daysTo50 < 365) {
            facts.push(`At your current pace of ${Math.round(dailyAverages.totalXp).toLocaleString()} XP/day, you will reach Level 50 in ${Math.round(daysTo50).toLocaleString()} days!`);
          } else {
            facts.push(`At your current pace of ${Math.round(dailyAverages.totalXp).toLocaleString()} XP/day, you will reach Level 50 in ${yearsTo50.toFixed(1)} years!`);
          }
        }
        if (xp < 203353000) {
          const daysTo80 = (203353000 - xp) / dailyAverages.totalXp;
          const yearsTo80 = daysTo80 / 365;
          if (daysTo80 < 365) {
            facts.push(`At your current pace of ${Math.round(dailyAverages.totalXp).toLocaleString()} XP/day, you will reach Level 80 in ${Math.round(daysTo80).toLocaleString()} days!`);
          } else {
            facts.push(`At your current pace of ${Math.round(dailyAverages.totalXp).toLocaleString()} XP/day, you will reach Level 80 in ${yearsTo80.toFixed(1)} years!`);
          }
        }
      }

      if (dailyAverages.pokemonCaught > 0 && caught < 1000000) {
        const daysTo1M = (1000000 - caught) / dailyAverages.pokemonCaught;
        if (daysTo1M < 365) {
          facts.push(`At your current pace, you'll hit 1,000,000 catches in ${Math.round(daysTo1M).toLocaleString()} days!`);
        } else {
          const yearsTo1M = daysTo1M / 365;
          facts.push(`At your current pace, you'll hit 1,000,000 catches in ${yearsTo1M.toFixed(1)} years!`);
        }
      }
    }

    return facts;
  }
}
