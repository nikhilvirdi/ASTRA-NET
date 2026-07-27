import { describe, it, expect } from 'vitest';
import {
  applyAlertUpdate,
  defaultUserSettings,
  mergeIntoStored,
  parseUserSettings,
} from './user-settings.js';
import { ALERTABLE_EVENT_TYPES } from '../util/event-types.js';

describe('parseUserSettings — total over an untrusted JSONB blob', () => {
  it.each([[null], [undefined], [{}], ['a string'], [42], [[]], [{ alerts: null }]])(
    'yields valid defaults for %p',
    (stored) => {
      const settings = parseUserSettings(stored);
      expect(Object.keys(settings.alerts).sort()).toEqual([...ALERTABLE_EVENT_TYPES].sort());
      expect(Object.values(settings.alerts).every((v) => v === false)).toBe(true);
    },
  );

  it('defaults every alert to off — nothing can deliver them yet', () => {
    expect(defaultUserSettings().alerts).toEqual({
      iss_pass: false,
      aurora: false,
      meteor_shower: false,
      neo_approach: false,
    });
  });

  it('reads stored booleans back faithfully', () => {
    const settings = parseUserSettings({ alerts: { iss_pass: true, aurora: false } });
    expect(settings.alerts.iss_pass).toBe(true);
    expect(settings.alerts.aurora).toBe(false);
  });

  it('fills in a key an older build never wrote', () => {
    const settings = parseUserSettings({ alerts: { iss_pass: true } });
    expect(settings.alerts.neo_approach).toBe(false);
  });

  it('ignores a truthy non-boolean rather than reading it as enabled', () => {
    // A bad write must never silently turn an alert on.
    const settings = parseUserSettings({ alerts: { iss_pass: 'yes', aurora: 1 } });
    expect(settings.alerts.iss_pass).toBe(false);
    expect(settings.alerts.aurora).toBe(false);
  });

  it('ignores unknown alert keys from a future build', () => {
    const settings = parseUserSettings({ alerts: { comet: true, iss_pass: true } });
    expect(settings.alerts).not.toHaveProperty('comet');
    expect(settings.alerts.iss_pass).toBe(true);
  });
});

describe('applyAlertUpdate', () => {
  it('changes only the keys sent', () => {
    const current = parseUserSettings({ alerts: { iss_pass: true, aurora: true } });
    const updated = applyAlertUpdate(current, { aurora: false });

    expect(updated.alerts.aurora).toBe(false);
    expect(updated.alerts.iss_pass).toBe(true);
  });

  it('does not mutate the input', () => {
    const current = parseUserSettings({ alerts: { iss_pass: true } });
    applyAlertUpdate(current, { iss_pass: false });
    expect(current.alerts.iss_pass).toBe(true);
  });

  it('ignores a non-boolean value', () => {
    const current = parseUserSettings({ alerts: { iss_pass: true } });
    const updated = applyAlertUpdate(current, { iss_pass: undefined });
    expect(updated.alerts.iss_pass).toBe(true);
  });
});

describe('mergeIntoStored', () => {
  it("preserves another feature's keys instead of clobbering the blob", () => {
    const stored = { theme: 'red-light', alerts: { iss_pass: false } };
    const merged = mergeIntoStored(stored, parseUserSettings({ alerts: { iss_pass: true } }));

    expect(merged.theme).toBe('red-light');
    expect(merged.alerts).toEqual({
      iss_pass: true,
      aurora: false,
      meteor_shower: false,
      neo_approach: false,
    });
  });

  it.each([[null], ['a string'], [[]], [undefined]])(
    'starts from an empty object when the stored value is %p',
    (stored) => {
      const merged = mergeIntoStored(stored, defaultUserSettings());
      expect(merged.alerts).toEqual(defaultUserSettings().alerts);
    },
  );
});
