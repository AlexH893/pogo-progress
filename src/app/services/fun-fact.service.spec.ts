import { TestBed } from '@angular/core/testing';
import { FunFactService } from './fun-fact.service';
import { ProfileStats } from '../models/profile-stats';

describe('FunFactService', () => {
  let service: FunFactService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FunFactService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate empty facts if stats are null', () => {
    const facts = service.generateFacts(null);
    expect(facts.length).toBe(0);
  });

  it('should generate distance facts', () => {
    const stats: ProfileStats = {
      username: 'Test',
      level: 40,
      distanceWalked: 100, // Should trigger Golden Gate Bridge and 5K
      distanceUnit: 'km',
      pokemonCaught: 0,
      pokestopsVisited: 0,
      totalXp: 0
    };
    const facts = service.generateFacts(stats);
    expect(facts.length).toBeGreaterThan(0);
    const hasMarathon = facts.some(f => f.includes('marathon'));
    expect(hasMarathon).toBeTrue();
  });

  it('should generate population facts and catch time', () => {
    const stats: ProfileStats = {
      username: 'Test',
      level: 40,
      distanceWalked: 0,
      distanceUnit: 'km',
      pokemonCaught: 50000, // Should trigger Monaco/Vatican
      pokestopsVisited: 0,
      totalXp: 0
    };
    const facts = service.generateFacts(stats);
    expect(facts.length).toBeGreaterThan(0);
    
    const hasCatchTime = facts.some(f => f.includes('hours just throwing Poké Balls'));
    expect(hasCatchTime).toBeTrue();
  });

  it('should generate XP milestones', () => {
    const stats: ProfileStats = {
      username: 'Test',
      level: 40,
      distanceWalked: 0,
      distanceUnit: 'km',
      pokemonCaught: 0,
      pokestopsVisited: 0,
      totalXp: 10000000 // Part way to 50
    };
    const facts = service.generateFacts(stats);
    const hasLevel50 = facts.some(f => f.includes('% of the way to Level 50'));
    expect(hasLevel50).toBeTrue();
  });

  it('should calculate daily averages if provided', () => {
    const stats: ProfileStats = {
      username: 'Test',
      level: 40,
      distanceWalked: 0,
      distanceUnit: 'km',
      pokemonCaught: 0,
      pokestopsVisited: 0,
      totalXp: 1000000
    };
    const dailyAverages = {
      totalXp: 100000
    };
    const facts = service.generateFacts(stats, dailyAverages);
    const hasPaceFact = facts.some(f => f.includes('At your current pace of 100,000 XP/day, you will reach Level 50 in'));
    expect(hasPaceFact).toBeTrue();
  });
});
