const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const sourcePath = process.env.LCD_SOURCE || path.join(__dirname, '../EyeHelperPosition/lcd.js');
const source = fs.readFileSync(sourcePath, 'utf8');

// Minimal deterministic substitutes, not validation of the real Q or mraa packages.
function harness() {
  const timers = [];
  function Q(value) { return { state: 'fulfilled', value }; }
  Q.reject = reason => ({ state: 'rejected', reason });
  Q.defer = () => {
    const promise = { state: 'pending', settlements: 0 };
    return {
      promise,
      resolve() { promise.settlements++; promise.state = 'fulfilled'; },
      reject(reason) { promise.settlements++; promise.state = 'rejected'; promise.reason = reason; }
    };
  };
  const context = {
    exports: {},
    require(name) {
      if (name === 'q') return Q;
      if (name === 'mraa') return { MRAA_SUCCESS: 0 };
      throw new Error('Unexpected dependency: ' + name);
    },
    setTimeout(callback, milliseconds) { timers.push({ callback, milliseconds }); }
  };
  vm.runInNewContext('(function (exports, require) {\n' + source + '\n})(exports, require);',
    context, { timeout: 1000, filename: sourcePath });
  const device = Object.create(context.exports.LCD.prototype);
  Object.assign(device, { _queue: [], _busy: false, _error: null, _defer: null });
  return {
    device, context, timers,
    tick() { assert.ok(timers.length); timers.shift().callback(); }
  };
}

test('a terminal delay settles all quiescence callers once and retains microsecond units', () => {
  const h = harness();
  h.device.wait(4500);
  const pending = h.device.waitForQuiescent();
  assert.equal(pending.state, 'pending');
  assert.equal(h.device.waitForQuiescent(), pending);
  assert.equal(h.timers[0].milliseconds, 4.5);
  h.tick();
  assert.equal(pending.state, 'fulfilled');
  assert.equal(pending.settlements, 1);
  assert.equal(h.device._defer, null);
  assert.equal(h.device._busy, false);
  assert.equal(h.device.waitForQuiescent().state, 'fulfilled');
  h.device._exec();
  assert.equal(pending.settlements, 1);
});

test('multiple waits and intervening commands execute in order before completion', () => {
  const h = harness();
  const writes = [];
  const bus = { write(value) { assert.equal(this, bus); writes.push(value); return 0; } };
  h.device.wait(1000);
  h.device.queue('write', bus, ['first'], 0);
  h.device.wait(2000);
  h.device.queue('write', bus, ['second'], 0);
  h.device.wait(3000);
  const pending = h.device.waitForQuiescent();
  h.tick();
  assert.deepEqual(writes, ['first']);
  assert.equal(pending.state, 'pending');
  h.tick();
  assert.deepEqual(writes, ['first', 'second']);
  assert.equal(pending.state, 'pending');
  h.tick();
  assert.equal(pending.state, 'fulfilled');
  assert.equal(pending.settlements, 1);
  assert.equal(h.device._queue.length, 0);
});

test('synchronous command success is quiescent and command-then-wait still settles', () => {
  const h = harness();
  const bus = { write() { return 0; } };
  h.device.queue('write', bus, [], 0);
  assert.equal(h.device.waitForQuiescent().state, 'fulfilled');
  h.device.wait(1000);
  const pending = h.device.waitForQuiescent();
  h.tick();
  assert.equal(pending.state, 'fulfilled');
});

test('an extra execution request cannot finish a delay that is still running', () => {
  const h = harness();
  h.device.wait(1000);
  const pending = h.device.waitForQuiescent();
  h.device._exec();
  assert.equal(h.device._busy, true);
  assert.equal(pending.state, 'pending');
  h.tick();
  assert.equal(pending.state, 'fulfilled');
});

for (const mode of ['status', 'throw']) {
  test(`${mode} failure rejects and remains an error until explicitly cleared`, () => {
    const h = harness();
    let calls = 0;
    const bus = {
      fail() { if (mode === 'throw') throw new Error('fake write failure'); return 7; },
      write() { calls++; return 0; }
    };
    h.device.wait(1000);
    h.device.queue('fail', bus, [], 0);
    h.device.queue('write', bus, [], 0);
    const pending = h.device.waitForQuiescent();
    h.tick();
    assert.equal(pending.state, 'rejected');
    assert.equal(pending.settlements, 1);
    assert.equal(h.device._busy, false);
    assert.equal(h.device.waitForQuiescent().state, 'rejected');
    assert.equal(calls, 0);
    h.device.clearError(true);
    assert.equal(calls, 1);
    assert.equal(h.device.waitForQuiescent().state, 'fulfilled');
    assert.equal(pending.state, 'rejected', 'clearing must not resolve an old failed promise');
  });
}

test('clearing without resume discards queued commands and allows a fresh terminal wait', () => {
  const h = harness();
  let calls = 0;
  const bus = { fail() { return 1; }, write() { calls++; return 0; } };
  h.device.queue('fail', bus, [], 0);
  h.device.queue('write', bus, [], 0);
  assert.equal(h.device.waitForQuiescent().state, 'rejected');
  h.device.clearError();
  assert.equal(h.device._queue.length, 0);
  assert.equal(calls, 0);
  h.device.wait(1000);
  const pending = h.device.waitForQuiescent();
  h.tick();
  assert.equal(pending.state, 'fulfilled');
});

test('a final failed command is not mistaken for successful empty-queue completion', () => {
  const h = harness();
  h.device.wait(1000);
  h.device.queue('fail', { fail() { return 1; } }, [], 0);
  const pending = h.device.waitForQuiescent();
  h.tick();
  h.device._exec();
  assert.equal(h.device._queue.length, 0);
  assert.equal(pending.state, 'rejected');
  assert.equal(pending.settlements, 1);
  assert.equal(h.device.waitForQuiescent().state, 'rejected');
});

test('loading and running the queue does not leak lcd or next globals', () => {
  const h = harness();
  h.device.queue('write', { write() {} }, []);
  assert.equal(Object.hasOwn(h.context, 'lcd'), false);
  assert.equal(Object.hasOwn(h.context, 'next'), false);
  assert.equal(h.context.exports.lcd.lcdAddress, 0x3e);
});
