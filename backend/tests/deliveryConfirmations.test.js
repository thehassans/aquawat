import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeliveryEmail,
  buildDeliverySms,
  resolveTenantSmsSettings,
} from '../services/inventory/deliveryConfirmations.js';

test('buildDeliveryEmail includes transfer name and origin', () => {
  const { subject, text, html } = buildDeliveryEmail({
    transfer: { name: 'WH/OUT/0001', origin: 'INV-9', trackingReference: 'TRK1' },
    partner: { name: 'Acme' },
    tenant: { name: 'Demo Co' },
  });
  assert.match(subject, /WH\/OUT\/0001/);
  assert.match(text, /Acme/);
  assert.match(text, /INV-9/);
  assert.match(text, /TRK1/);
  assert.match(html, /WH\/OUT\/0001/);
});

test('buildDeliverySms is compact', () => {
  const body = buildDeliverySms({
    transfer: { name: 'OUT/1', trackingReference: 'X' },
    partner: { name: 'Bob' },
    tenant: { name: 'Shop' },
  });
  assert.match(body, /OUT\/1/);
  assert.match(body, /Bob/);
  assert.match(body, /Tracking: X/);
});

test('resolveTenantSmsSettings prefers communication.sms', () => {
  const sms = resolveTenantSmsSettings({
    settings: {
      sms: { enabled: false, provider: 'twilio' },
      communication: { sms: { enabled: true, provider: 'unifonic', unifonicAppSid: 'a' } },
    },
  });
  assert.equal(sms.provider, 'unifonic');
  assert.equal(sms.enabled, true);
});

test('resolveTenantSmsSettings falls back to legacy settings.sms', () => {
  const sms = resolveTenantSmsSettings({
    settings: { sms: { enabled: true, provider: 'twilio', fromNumber: '+1' } },
  });
  assert.equal(sms.provider, 'twilio');
  assert.equal(sms.enabled, true);
});
