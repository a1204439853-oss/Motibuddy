import test from 'node:test';
import assert from 'node:assert/strict';
import { registerExitPreparation, prepareApplicationExit } from '../src/services/exitPreparation.ts';
import { WriteBarrier } from '../src/services/writeBarrier.ts';
test('focus exit preparation admits its last write before the write barrier closes', async () => {
  const writes = new WriteBarrier(), order = [];
  const unregister = registerExitPreparation(async () => { await writes.run(async () => { order.push('last-focus-checkpoint'); }); });
  try { await prepareApplicationExit(); await writes.closeAndDrain(); order.push('exit'); assert.deepEqual(order,['last-focus-checkpoint','exit']); }
  finally { unregister(); }
});
test('a failed focus finalization prevents safe exit and leaves preparations retryable', async () => {
  let fail = true;
  const unregister = registerExitPreparation(async () => { if(fail)throw Error('test save failed'); });
  try { await assert.rejects(prepareApplicationExit());fail=false;await prepareApplicationExit(); }
  finally { unregister(); }
});
