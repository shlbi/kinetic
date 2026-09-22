import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROJECT_SCHEMA,
  ProjectFormatError,
  decodeProjectDocument,
  parseProjectText,
  serializeProjectDocument,
} from '../src/project/format.js';
import { MODEL_VERSION, projectFingerprint } from '../src/sim/model.js';

const valid = {
  schema: PROJECT_SCHEMA,
  name: 'Wave demo',
  model: MODEL_VERSION,
  seed: 42,
  parameters: {
    density: 0.58,
    reaction: 1.1,
    braking: 2.8,
    duration: 18,
    fps: 30,
  },
};

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof ProjectFormatError && error.code === code);
}

test('valid project documents preserve deterministic scenario identity', () => {
  const decoded = decodeProjectDocument(valid);
  assert.equal(decoded.model, MODEL_VERSION);
  assert.equal(projectFingerprint(decoded), projectFingerprint(valid));
});

test('serialized projects include an explicit schema and round-trip', () => {
  const document = serializeProjectDocument(valid);
  assert.equal(document.schema, PROJECT_SCHEMA);
  assert.deepEqual(parseProjectText(JSON.stringify(document)), decodeProjectDocument(document));
});

test('malformed JSON is rejected with a stable error code', () => {
  expectCode(() => parseProjectText('{ nope'), 'MALFORMED_JSON');
});

test('unknown schemas are rejected instead of guessed', () => {
  expectCode(() => decodeProjectDocument({ ...valid, schema: 'kinetic-project-v99' }), 'UNSUPPORTED_SCHEMA');
});

test('unknown model versions are rejected instead of coerced', () => {
  expectCode(() => decodeProjectDocument({ ...valid, model: 'traffic-ring-v2' }), 'UNSUPPORTED_MODEL');
});

test('missing parameter objects are rejected', () => {
  const { parameters, ...withoutParameters } = valid;
  void parameters;
  expectCode(() => decodeProjectDocument(withoutParameters), 'INVALID_DOCUMENT');
});

test('out-of-range values are rejected instead of silently clamped', () => {
  expectCode(
    () => decodeProjectDocument({ ...valid, parameters: { ...valid.parameters, reaction: 9 } }),
    'OUT_OF_RANGE',
  );
});

test('seed and fps require integer values', () => {
  expectCode(() => decodeProjectDocument({ ...valid, seed: 4.2 }), 'INVALID_VALUE');
  expectCode(
    () => decodeProjectDocument({ ...valid, parameters: { ...valid.parameters, fps: 29.97 } }),
    'INVALID_VALUE',
  );
});

test('project names are required and bounded', () => {
  expectCode(() => decodeProjectDocument({ ...valid, name: '   ' }), 'INVALID_VALUE');
  expectCode(() => decodeProjectDocument({ ...valid, name: 'x'.repeat(121) }), 'INVALID_VALUE');
});
