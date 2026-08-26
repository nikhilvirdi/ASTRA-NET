import { describe, it, expect } from 'vitest';
import {
  formatTime,
  formatDistance,
  formatMillionsDistance,
  formatSpeed,
  formatLength,
  getNeoComparisonLabel,
} from './format-preferences.js';

describe('formatTime', () => {
  const afternoonDate = new Date('2026-07-14T14:30:00Z');
  const morningDate = new Date('2026-07-14T09:05:00Z');

  it('formats 24h time correctly', () => {
    const res = formatTime(afternoonDate, '24h');
    const resMorning = formatTime(morningDate, '24h');
    expect(res).toMatch(/\d{2}:\d{2}/);
    expect(resMorning).toMatch(/\d{2}:\d{2}/);
  });

  it('formats 12h time correctly with AM/PM', () => {
    const res = formatTime(afternoonDate, '12h');
    const resMorning = formatTime(morningDate, '12h');
    expect(res).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(resMorning).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it('handles null, undefined and invalid date gracefully', () => {
    expect(formatTime(null, '24h')).toBe('—');
    expect(formatTime(undefined, '12h')).toBe('—');
    expect(formatTime('invalid-date', '24h')).toBe('—');
  });

  it('accepts ISO string and timestamp numbers', () => {
    expect(formatTime('2026-07-14T14:30:00Z', '24h')).not.toBe('—');
    expect(formatTime(1784040000000, '12h')).not.toBe('—');
  });
});

describe('formatDistance', () => {
  it('formats metric distances (km)', () => {
    expect(formatDistance(120, 'metric')).toBe('120 km');
    expect(formatDistance(120.456, 'metric', 1)).toBe('120.5 km');
  });

  it('formats imperial distances (mi) using 1 km = 0.621371 mi', () => {
    // 120 * 0.621371 = 74.56452 -> 75 mi
    expect(formatDistance(120, 'imperial')).toBe('75 mi');
    expect(formatDistance(100, 'imperial', 1)).toBe('62.1 mi');
  });
});

describe('formatMillionsDistance', () => {
  it('formats millions of kilometers in metric', () => {
    expect(formatMillionsDistance(4_120_000, 'metric', 2)).toBe('4.12M km');
  });

  it('formats millions of miles in imperial', () => {
    // 4_120_000 * 0.621371 = 2_560_048.52 -> 2.56M mi
    expect(formatMillionsDistance(4_120_000, 'imperial', 2)).toBe('2.56M mi');
  });
});

describe('formatSpeed', () => {
  it('formats km/s speed in metric', () => {
    expect(formatSpeed(333, 'metric', 'km/s')).toBe('333 km/s');
    expect(formatSpeed(28.46, 'metric', 'km/s', 1)).toBe('28.5 km/s');
  });

  it('formats km/s speed in imperial (mi/s)', () => {
    // 333 * 0.621371 = 206.916 -> 207 mi/s
    expect(formatSpeed(333, 'imperial', 'km/s')).toBe('207 mi/s');
    expect(formatSpeed(28.4, 'imperial', 'km/s', 1)).toBe('17.6 mi/s');
  });

  it('formats km/h speed in metric and imperial (mph)', () => {
    expect(formatSpeed(100, 'metric', 'km/h')).toBe('100 km/h');
    // 100 * 0.621371 = 62.1371 -> 62 mph
    expect(formatSpeed(100, 'imperial', 'km/h')).toBe('62 mph');
  });
});

describe('formatLength', () => {
  it('formats meters in metric', () => {
    expect(formatLength(300, 'metric')).toBe('300m');
  });

  it('formats feet in imperial using 1 m = 3.28084 ft', () => {
    // 300 * 3.28084 = 984.252 -> 984ft
    expect(formatLength(300, 'imperial')).toBe('984ft');
    // 830 * 3.28084 = 2723.0972 -> 2,723ft
    expect(formatLength(830, 'imperial')).toBe('2,723ft');
  });
});

describe('getNeoComparisonLabel', () => {
  it('returns metric landmark scales', () => {
    expect(getNeoComparisonLabel(30, 'metric')).toBe('Blue Whale (30m)');
    expect(getNeoComparisonLabel(93, 'metric')).toBe('Statue of Liberty (93m)');
    expect(getNeoComparisonLabel(300, 'metric')).toBe('Eiffel Tower (300m)');
    expect(getNeoComparisonLabel(830, 'metric')).toBe('Burj Khalifa (830m)');
    expect(getNeoComparisonLabel(1500, 'metric')).toBe('1.5km Mountain Scale');
  });

  it('returns imperial landmark scales', () => {
    expect(getNeoComparisonLabel(30, 'imperial')).toBe('Blue Whale (98ft)');
    expect(getNeoComparisonLabel(93, 'imperial')).toBe('Statue of Liberty (305ft)');
    expect(getNeoComparisonLabel(300, 'imperial')).toBe('Eiffel Tower (984ft)');
    expect(getNeoComparisonLabel(830, 'imperial')).toBe('Burj Khalifa (2,723ft)');
    expect(getNeoComparisonLabel(1500, 'imperial')).toBe('0.9mi Mountain Scale');
  });
});
