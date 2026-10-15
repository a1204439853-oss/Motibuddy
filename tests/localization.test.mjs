import test from 'node:test';
import assert from 'node:assert/strict';
import { LocaleStore, LOCALE_KEY, translate, label, localeStore } from '../src/i18n/core.ts';
import { zhCN } from '../src/i18n/messages.ts';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function cache(entries = []) {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
test('language persists separately without changing account, task, pet or session data', () => {
  const storage = cache([['users', '[{"id":"A"}]'], ['activeSession', 'keep-session'], ['pet_A', 'keep-pet'], ['tasks_A', 'keep-tasks']]);
  const before = [...storage.values];
  const store = new LocaleStore(storage); store.set('zh-CN');
  assert.equal(new LocaleStore(storage).getSnapshot(), 'zh-CN');
  assert.deepEqual([...storage.values].filter(([key]) => key !== LOCALE_KEY), before);
});
test('invalid or unreadable saved preferences fall back without clearing storage', () => {
  const storage = cache([[LOCALE_KEY, 'not-a-locale']]);
  assert.equal(new LocaleStore(storage).getSnapshot(), 'en-US');
  assert.equal(storage.getItem(LOCALE_KEY), 'not-a-locale');
  assert.equal(new LocaleStore({ getItem: () => { throw new Error('denied'); }, setItem: () => assert.fail() }).getSnapshot(), 'en-US');
});
test('failed preference writes do not publish a false saved language', () => {
  let updates = 0;
  const store = new LocaleStore({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
  store.subscribe(() => { updates++; });
  assert.throws(() => store.set('zh-CN'));
  assert.equal(store.getSnapshot(), 'en-US'); assert.equal(updates, 0);
});
test('cross-window preference updates publish once without re-writing or echoing', () => {
  const storage = cache(); let updates = 0;
  const store = new LocaleStore(storage); const dispose = store.subscribe(() => { updates++; });
  store.receive('zh-CN'); store.receive('zh-CN'); store.receive({ locale: 'en-US' }); store.receive('../other');
  assert.equal(store.getSnapshot(), 'zh-CN'); assert.equal(updates, 1); assert.equal(storage.values.size, 0);
  dispose(); store.receive('en-US'); assert.equal(updates, 1);
});
test('interpolation preserves user-provided text and cannot recursively translate it', () => {
  assert.equal(translate('Welcome to MotiBuddy, {name}!', { name: 'Health / 团团 {count}' }, 'zh-CN'), '欢迎加入 MotiBuddy，Health / 团团 {count}！');
  assert.equal(translate('An unknown new message', {}, 'zh-CN'), 'An unknown new message');
  assert.equal(translate('{count} tasks', { count: 12 }, 'zh-CN'), '12 个任务');
  assert.equal(translate('Profile', {}, 'en-US'), 'Profile');
});
test('display labels change without changing the persisted enum identifiers', () => {
  localeStore.receive('zh-CN');
  try { assert.equal(label('in-progress'), '进行中'); assert.equal(label('cat'), '小猫'); assert.equal(label('urgent'), '紧急'); assert.equal(label('neutral'), '平静'); }
  finally { localeStore.receive('en-US'); }
  assert.equal(label('in-progress'), 'In Progress');
});
test('translated templates retain the same named placeholders as their English originals', () => {
  const placeholders = value => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(match => match[1]).sort();
  for (const [english, chinese] of Object.entries(zhCN)) {
    assert.ok(chinese.trim(), english);
    assert.deepEqual(placeholders(chinese), placeholders(english), english);
  }
});
test('the translation catalog has no duplicate source keys that silently shadow a translation', () => {
  const source = ts.createSourceFile('messages.ts', readFileSync(new URL('../src/i18n/messages.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const keys = new Set();
  function scan(node) {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) {
      assert.equal(keys.has(node.name.text), false, node.name.text); keys.add(node.name.text);
    }
    ts.forEachChild(node, scan);
  }
  scan(source); assert.ok(keys.size > 300);
});

test('every literal UI translation key has a Chinese translation', () => {
  const missing = new Set();
  function key(expression) {
    if (ts.isStringLiteral(expression) && !Object.hasOwn(zhCN, expression.text)) missing.add(expression.text);
    if (ts.isConditionalExpression(expression)) { key(expression.whenTrue); key(expression.whenFalse); }
  }
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!/\.tsx?$/.test(file)) continue;
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function scan(node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && node.arguments[0]) key(node.arguments[0]);
        ts.forEachChild(node, scan);
      }
      scan(source);
    }
  }
  walk(fileURLToPath(new URL('../src', import.meta.url)));
  assert.deepEqual([...missing], []);
});
