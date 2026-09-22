import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTimeline,
  frameAtTime,
  normalizeProject,
  projectFingerprint,
} from '../src/sim/model.js';

const fixture = {
  name: 'Determinism fixture',
  seed: 12345,
  parameters: {
    density: 0.61,
    reaction: 1.25,
    braking: 3.1,
    duration: 8,
    fps: 24,
  },
};

test('same saved project produces the exact same timeline', () => {
  const a = buildTimeline(fixture);
  const b = buildTimeline(JSON.parse(JSON.stringify(fixture)));
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(a.frames, b.frames);
});

test('fingerprint changes when a model input changes', () => {
  const base = projectFingerprint(fixture);
  assert.notEqual(base, projectFingerprint({ ...fixture, seed: fixture.seed + 1 }));
  assert.notEqual(base, projectFingerprint({
    ...fixture,
    parameters: { ...fixture.parameters, reaction: 1.3 },
  }));
});

test('normalization clamps all public model controls to supported bounds', () => {
  const p = normalizeProject({
    seed: -99,
    parameters: { density: 9, reaction: -4, braking: 99, duration: 2, fps: 500 },
  });
  assert.equal(p.seed, 1);
  assert.equal(p.parameters.density, 0.92);
  assert.equal(p.parameters.reaction, 0.3);
  assert.equal(p.parameters.braking, 6);
  assert.equal(p.parameters.duration, 6);
  assert.equal(p.parameters.fps, 60);
});

test('timeline dimensions agree with normalized duration and fps', () => {
  const timeline = buildTimeline(fixture);
  assert.equal(timeline.frames.length, Math.floor(timeline.duration * timeline.fps) + 1);
  assert.equal(timeline.frames[0].index, 0);
  assert.equal(timeline.frames.at(-1).index, timeline.frames.length - 1);
});

test('each generated frame preserves finite non-negative vehicle state', () => {
  const timeline = buildTimeline(fixture);
  for (const frame of timeline.frames) {
    assert.ok(Number.isFinite(frame.avgSpeed));
    assert.ok(Number.isFinite(frame.minSpeed));
    assert.ok(Number.isFinite(frame.waveStrength));
    assert.equal(frame.cars.length, timeline.vehicleCount);
    for (const car of frame.cars) {
      assert.ok(car.x >= 0 && car.x < timeline.roadLength);
      assert.ok(car.v >= 0 && car.v <= 34);
    }
  }
});

test('frameAtTime clamps outside the shared timeline', () => {
  const timeline = buildTimeline(fixture);
  assert.deepEqual(frameAtTime(timeline, -100), timeline.frames[0]);
  assert.deepEqual(frameAtTime(timeline, 10000), timeline.frames.at(-1));
});
