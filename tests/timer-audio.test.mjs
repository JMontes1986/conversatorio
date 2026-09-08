import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TimerAudio } from '../src/lib/timer-audio.ts';

test('Audio remains inactive until enabled by a control; expiry never resumes it', async () => {
  const original = globalThis.AudioContext;
  let created = 0;
  let resumed = 0;
  let notes = 0;
  let closed = 0;
  let context;
  globalThis.AudioContext = class {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    constructor() { created++; context = this; }
    async resume() { resumed++; this.state = 'running'; }
    async close() { closed++; this.state = 'closed'; }
    createOscillator() {
      return { frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() { notes++; }, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    }
  };
  try {
    const audio = new TimerAudio();
    audio.ring();
    assert.equal(created, 0);
    assert.equal(notes, 0);
    assert.equal(await audio.enable(), true);
    audio.ring();
    assert.equal(created, 1);
    assert.equal(notes, 2);
    context.state = 'suspended';
    audio.ring();
    assert.equal(resumed, 1);
    assert.equal(notes, 2);
    assert.equal(await audio.enable(), true);
    audio.dispose();
    audio.ring();
    assert.equal(closed, 1);
    assert.equal(await audio.enable(), false);
    assert.equal(created, 1);
  } finally {
    if (original === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = original;
  }
});

test('Missing audio support leaves timer controls usable', async () => {
  const original = globalThis.AudioContext;
  delete globalThis.AudioContext;
  try {
    const audio = new TimerAudio();
    assert.equal(await audio.enable(), false);
    assert.doesNotThrow(() => audio.ring());
    audio.dispose();
  } finally { if (original !== undefined) globalThis.AudioContext = original; }
});
