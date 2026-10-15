import test from 'node:test';
import assert from 'node:assert/strict';
import { WidgetPetDispatcher, requestWidgetPetAction } from '../src/services/widgetPetCommands.ts';
const request = changes => ({ requestId: 'request-one', userId: 'A', sessionToken: 'session-one', action: 'feed', ...changes });
const stamp = () => ({ userId: 'A', token: 'session-one' });
const result = changes => ({ ...request(), success: true, message: '', ...changes });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('dispatcher rejects stale sessions, other owners, malformed actions and whole-pet snapshots', async () => {
  let calls = 0;
  const dispatcher = new WidgetPetDispatcher('A', stamp, async () => { calls++; return { success: true, message: '' }; });
  for (const value of [null, {}, request({ userId: 'B' }), request({ sessionToken: 'old' }), request({ action: 'reset' }), { ...request(), pet: { health: 100 } }]) assert.equal(await dispatcher.handle(value), null);
  const wrongContext = new WidgetPetDispatcher('A', () => ({ userId: 'B', token: 'session-one' }), async () => { calls++; return { success: true, message: '' }; });
  assert.equal(await wrongContext.handle(request({ userId: 'B' })), null);
  assert.equal(calls, 0);
});

test('duplicate in-flight requests share one operation and confirmation', async () => {
  let calls = 0;
  const done = deferred();
  const dispatcher = new WidgetPetDispatcher('A', stamp, async () => { calls++; await done.promise; return { success: true, message: '' }; });
  const first = dispatcher.handle(request());
  const second = dispatcher.handle(request());
  done.resolve();
  assert.deepEqual(await first, await second);
  assert.equal(calls, 1);
});

test('save failures are confirmed as failures without optimistic success or duplicate re-execution', async () => {
  let calls = 0;
  const dispatcher = new WidgetPetDispatcher('A', stamp, async () => { calls++; throw new Error('Pet saved, settings failed'); });
  const first = await dispatcher.handle(request());
  assert.equal(first.success, false);
  assert.equal(first.message, 'Pet saved, settings failed');
  assert.deepEqual(await dispatcher.handle(request()), first);
  assert.equal(calls, 1);
});

test('reusing a request ID for another action is rejected', async () => {
  const dispatcher = new WidgetPetDispatcher('A', stamp, async () => ({ success: true, message: '' }));
  await dispatcher.handle(request());
  assert.equal((await dispatcher.handle(request({ action: 'play' }))).success, false);
});

test('bounded deduplication retains pending work and permits continued use after settled requests', async () => {
  let count = 0;
  const dispatcher = new WidgetPetDispatcher('A', stamp, async () => { count++; return { success: true, message: '' }; });
  for (let i = 0; i < 260; i++) assert.equal((await dispatcher.handle(request({ requestId: String(i) }))).success, true);
  assert.equal(count, 260);
});

test('request registers confirmation before emitting and accepts a synchronous matching reply', async () => {
  const events = [];
  let handler;
  const response = await requestWidgetPetAction({
    listen: async callback => { events.push('listen'); handler = callback; return () => events.push('cleanup'); },
    emit: async () => { events.push('emit'); handler(result()); },
  }, request(), () => true, 1000);
  assert.equal(response.success, true);
  assert.deepEqual(events, ['listen', 'emit', 'cleanup']);
});

test('foreign/stale replies are ignored and only the correlated result settles the request', async () => {
  let handler;
  const response = await requestWidgetPetAction({
    listen: async callback => { handler = callback; return () => {}; },
    emit: async () => {
      handler(result({ sessionToken: 'old' }));
      handler(result({ requestId: 'other' }));
      handler(result({ userId: 'B' }));
      handler(result({ action: 'play' }));
      handler(result({ success: false, message: 'Limit reached' }));
    },
  }, request(), () => true, 1000);
  assert.equal(response.success, false);
  assert.equal(response.message, 'Limit reached');
});

test('timeout is reported as an unknown outcome and removes the listener', async () => {
  let cleaned = false;
  await assert.rejects(requestWidgetPetAction({ listen: async () => () => { cleaned = true; }, emit: async () => {} }, request(), () => true, 10), /could not be confirmed/);
  assert.equal(cleaned, true);
});

test('timeout before listener registration finishes cleans up without sending a late command', async () => {
  const registration = deferred();
  let emitted = false, cleaned = false;
  await assert.rejects(requestWidgetPetAction({ listen: () => registration.promise, emit: async () => { emitted = true; } }, request(), () => true, 10));
  registration.resolve(() => { cleaned = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cleaned, true);
  assert.equal(emitted, false);
});

test('account switch before emit prevents the operation and disposes the listener', async () => {
  let emitted = false, cleaned = false;
  await assert.rejects(requestWidgetPetAction({
    listen: async () => () => { cleaned = true; }, emit: async () => { emitted = true; },
  }, request(), () => false, 1000), /session has changed/);
  assert.equal(emitted, false);
  assert.equal(cleaned, true);
});

test('synchronous listener and send errors are handled and confirmation resources are released', async () => {
  await assert.rejects(requestWidgetPetAction({ listen: () => { throw new Error('Unavailable'); }, emit: async () => {} }, request(), () => true, 1000), /listener could not/);
  let cleaned = false;
  await assert.rejects(requestWidgetPetAction({ listen: async () => () => { cleaned = true; }, emit: () => { throw new Error('Unavailable'); } }, request(), () => true, 1000), /could not be confirmed/);
  assert.equal(cleaned, true);
});
