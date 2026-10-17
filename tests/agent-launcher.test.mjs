import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureGateway, probeGateway } from '../scripts/start-agent-desktop.mjs';

test('launcher reuses a ready service without starting duplicate processes', async () => {
  assert.equal(await ensureGateway({ probe: async () => 'ready', start: () => assert.fail('duplicate process') }), 'reused');
});

test('launcher waits for readiness after starting a missing service', async () => {
  const states = ['absent', 'absent', 'ready']; let starts = 0;
  assert.equal(await ensureGateway({ probe: async () => states.shift(), start: async () => { starts++; return { exitCode: null }; }, pause: async () => {} }), 'started');
  assert.equal(starts, 1);
});

test('launcher refuses occupied ports and stops waiting after startup failure', async () => {
  await assert.rejects(ensureGateway({ probe: async () => 'incompatible', start: () => assert.fail('occupied port') }), /PORT_UNAVAILABLE/);
  await assert.rejects(ensureGateway({ probe: async () => 'absent', start: async () => ({ exitCode: 1 }) }), /SERVICE_START_FAILED/);
  await assert.rejects(ensureGateway({ probe: async () => 'absent', start: async () => ({ exitCode: null }), pause: async () => {}, attempts: 2 }), /SERVICE_START_FAILED/);
});

test('readiness probe checks service identity and distinguishes connection refusal from timeout', async () => {
  const good = async () => new Response(JSON.stringify({ service: 'motibuddy-private-ai', protocol: 1 }));
  const other = async () => new Response(JSON.stringify({ service: 'other' }));
  const fail = code => async () => { throw new Error('fetch failed', { cause: { code } }); };
  assert.equal(await probeGateway(undefined, good), 'ready');
  assert.equal(await probeGateway(undefined, other), 'incompatible');
  assert.equal(await probeGateway(undefined, fail('ECONNREFUSED')), 'absent');
  assert.equal(await probeGateway(undefined, fail('ETIMEDOUT')), 'incompatible');
});
