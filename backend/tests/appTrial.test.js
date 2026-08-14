import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canStartAppTrial,
  describeAppTrial,
  expireStaleAppTrials,
  hasConsumedTrial,
  isAppAccessValid,
  isPaidOrGranted,
  isTrialCurrentlyActive,
  isTrialExpired,
  normalizeTrialDays,
} from '../utils/appTrial.js';

test('normalizeTrialDays defaults to 7 and allows 0', () => {
  assert.equal(normalizeTrialDays(undefined), 7);
  assert.equal(normalizeTrialDays(null), 7);
  assert.equal(normalizeTrialDays(0), 0);
  assert.equal(normalizeTrialDays(7), 7);
  assert.equal(normalizeTrialDays(90), 90);
  assert.equal(normalizeTrialDays(400), 90);
});

test('first install is trial-eligible; uninstall consumes the trial', () => {
  const appDef = { trialDays: 7 };
  assert.equal(canStartAppTrial(appDef, {}), true);
  assert.equal(canStartAppTrial(appDef, undefined), true);

  const afterUninstall = {
    isInstalled: false,
    isEnabled: false,
    installedAt: new Date('2026-01-01'),
    uninstalledAt: new Date('2026-01-03'),
    trialUsed: true,
    trialStartedAt: new Date('2026-01-01'),
    trialEndsAt: new Date('2026-01-08'),
  };
  assert.equal(hasConsumedTrial(afterUninstall), true);
  assert.equal(canStartAppTrial(appDef, afterUninstall), false);
});

test('prior install without trial flags still blocks a new trial', () => {
  assert.equal(canStartAppTrial({ trialDays: 7 }, { uninstalledAt: new Date() }), false);
  assert.equal(canStartAppTrial({ trialDays: 7 }, { installedAt: new Date() }), false);
});

test('trialDays 0 disables trials', () => {
  assert.equal(canStartAppTrial({ trialDays: 0 }, {}), false);
});

test('paid and granted records keep access after the trial clock', () => {
  const now = new Date('2026-08-14');
  const paid = {
    isInstalled: true,
    isEnabled: true,
    trialEndsAt: new Date('2026-08-01'),
    billing: { status: 'paid', paidAt: new Date('2026-08-02') },
  };
  assert.equal(isPaidOrGranted(paid), true);
  assert.equal(isAppAccessValid(paid, now), true);
  assert.equal(isTrialExpired(paid, now), false);
});

test('active trial grants access; expired trial does not', () => {
  const now = new Date('2026-08-14T12:00:00Z');
  const active = {
    isInstalled: true,
    isEnabled: true,
    trialUsed: true,
    trialEndsAt: new Date('2026-08-20T12:00:00Z'),
    billing: { status: 'trial' },
  };
  const expired = {
    ...active,
    trialEndsAt: new Date('2026-08-10T12:00:00Z'),
  };

  assert.equal(isTrialCurrentlyActive(active, now), true);
  assert.equal(isAppAccessValid(active, now), true);
  assert.equal(isTrialExpired(expired, now), true);
  assert.equal(isAppAccessValid(expired, now), false);
});

test('grandfathered installs without a trial clock stay valid', () => {
  const record = { isInstalled: true, isEnabled: true, installedAt: new Date() };
  assert.equal(isAppAccessValid(record), true);
});

test('describeAppTrial marks first paid install as eligible', () => {
  const info = describeAppTrial({
    appDef: { trialDays: 7 },
    record: {},
    isPaid: true,
    includedInPlan: false,
  });
  assert.equal(info.trialEligible, true);
  assert.equal(info.trialDays, 7);
  assert.equal(info.trialUsed, false);
});

test('expireStaleAppTrials disables expired trial apps', () => {
  const now = new Date('2026-08-14');
  const tenant = {
    settings: {
      installedApps: {
        zatca_phase2_pro: {
          isInstalled: true,
          isEnabled: true,
          trialEndsAt: new Date('2026-08-01'),
          billing: { status: 'trial' },
        },
      },
    },
    markModified() {},
  };

  assert.equal(expireStaleAppTrials(tenant, now), true);
  assert.equal(tenant.settings.installedApps.zatca_phase2_pro.isEnabled, false);
  assert.equal(tenant.settings.installedApps.zatca_phase2_pro.billing.status, 'expired');
});
