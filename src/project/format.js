import { MODEL_VERSION, normalizeProject } from '../sim/model.js';

export const PROJECT_SCHEMA = 'kinetic-project-v1';

export class ProjectFormatError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProjectFormatError';
    this.code = code;
  }
}

const LIMITS = Object.freeze({
  density: [0.25, 0.92],
  reaction: [0.3, 2.4],
  braking: [0.8, 6],
  duration: [6, 60],
  fps: [12, 60],
});

function fail(code, message) {
  throw new ProjectFormatError(code, message);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireFiniteNumber(value, label, [min, max], { integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail('INVALID_VALUE', `${label} must be a finite number.`);
  }
  if (integer && !Number.isInteger(value)) {
    fail('INVALID_VALUE', `${label} must be an integer.`);
  }
  if (value < min || value > max) {
    fail('OUT_OF_RANGE', `${label} must be between ${min} and ${max}.`);
  }
}

export function decodeProjectDocument(input) {
  if (!isRecord(input)) fail('INVALID_DOCUMENT', 'Project file must contain a JSON object.');
  if (input.schema !== PROJECT_SCHEMA) {
    fail('UNSUPPORTED_SCHEMA', `Expected schema ${PROJECT_SCHEMA}.`);
  }
  if (input.model !== MODEL_VERSION) {
    fail('UNSUPPORTED_MODEL', `This editor supports model ${MODEL_VERSION}, not ${String(input.model ?? 'missing')}.`);
  }
  if (typeof input.name !== 'string' || !input.name.trim()) {
    fail('INVALID_VALUE', 'Project name must be a non-empty string.');
  }
  if (input.name.trim().length > 120) {
    fail('INVALID_VALUE', 'Project name must be 120 characters or fewer.');
  }
  requireFiniteNumber(input.seed, 'Seed', [1, 2_147_483_647], { integer: true });
  if (!isRecord(input.parameters)) fail('INVALID_DOCUMENT', 'Project parameters are missing.');

  requireFiniteNumber(input.parameters.density, 'Traffic density', LIMITS.density);
  requireFiniteNumber(input.parameters.reaction, 'Reaction time', LIMITS.reaction);
  requireFiniteNumber(input.parameters.braking, 'Braking', LIMITS.braking);
  requireFiniteNumber(input.parameters.duration, 'Duration', LIMITS.duration);
  requireFiniteNumber(input.parameters.fps, 'Frame rate', LIMITS.fps, { integer: true });

  const normalized = normalizeProject(input);
  normalized.name = input.name.trim();
  return normalized;
}

export function parseProjectText(text) {
  if (typeof text !== 'string') fail('INVALID_DOCUMENT', 'Project file contents must be text.');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    fail('MALFORMED_JSON', 'Project file is not valid JSON.');
  }
  return decodeProjectDocument(raw);
}

export function serializeProjectDocument(projectInput) {
  const project = normalizeProject(projectInput);
  return {
    schema: PROJECT_SCHEMA,
    ...project,
  };
}
