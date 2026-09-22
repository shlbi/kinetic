const TAU = Math.PI * 2;

export const MODEL_VERSION = 'traffic-ring-v1';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeProject(input = {}) {
  const p = input.parameters ?? input;
  return {
    name: String(input.name ?? 'Traffic Wave Study'),
    model: MODEL_VERSION,
    seed: Math.trunc(clamp(Number(input.seed ?? 42), 1, 2_147_483_647)),
    parameters: {
      density: clamp(Number(p.density ?? 0.58), 0.25, 0.92),
      reaction: clamp(Number(p.reaction ?? 1.1), 0.3, 2.4),
      braking: clamp(Number(p.braking ?? 2.8), 0.8, 6),
      duration: clamp(Number(p.duration ?? 18), 6, 60),
      fps: Math.trunc(clamp(Number(p.fps ?? 30), 12, 60)),
    },
  };
}

export function projectFingerprint(projectInput) {
  const project = normalizeProject(projectInput);
  const text = JSON.stringify(project);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function circularGap(a, b, roadLength) {
  let gap = b - a;
  if (gap <= 0) gap += roadLength;
  return gap;
}

export function buildTimeline(projectInput) {
  const project = normalizeProject(projectInput);
  const { density, reaction, braking, duration, fps } = project.parameters;
  const roadLength = 1000;
  const vehicleCount = Math.round(10 + density * 34);
  const dt = 1 / fps;
  const totalFrames = Math.floor(duration * fps) + 1;
  const rng = mulberry32(project.seed);
  const targetSpeed = 27;
  const vehicleLength = 5;

  const cars = Array.from({ length: vehicleCount }, (_, i) => ({
    x: (i / vehicleCount) * roadLength,
    v: targetSpeed * (0.9 + rng() * 0.07),
  }));

  // A small deterministic perturbation is enough to seed a traffic wave.
  const disturbed = Math.floor(rng() * vehicleCount);
  cars[disturbed].v *= 0.45;

  const frames = [];
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const speeds = cars.map((car) => car.v);
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((sum, speed) => sum + (speed - avgSpeed) ** 2, 0) / speeds.length;
    const minSpeed = Math.min(...speeds);

    frames.push({
      index: frameIndex,
      t: frameIndex * dt,
      avgSpeed,
      minSpeed,
      waveStrength: Math.sqrt(variance) / targetSpeed,
      cars: cars.map((car, id) => ({ id, x: car.x, v: car.v })),
    });

    const next = cars.map((car, i) => {
      const leader = cars[(i + 1) % vehicleCount];
      const gap = circularGap(car.x, leader.x, roadLength) - vehicleLength;
      const safeGap = 7 + car.v * reaction + (car.v * car.v) / (2 * braking * 7.5);
      const freeRoad = clamp((gap - safeGap) / Math.max(safeGap, 1), -1, 1);
      const speedPull = clamp((targetSpeed - car.v) / targetSpeed, -1, 1);
      let acceleration = 2.4 * speedPull + 4.2 * freeRoad;

      if (gap < safeGap) {
        acceleration -= braking * clamp((safeGap - gap) / Math.max(safeGap, 1), 0, 1.5);
      }

      acceleration = clamp(acceleration, -braking, 2.6);
      const v = clamp(car.v + acceleration * dt, 0, 34);
      return { x: (car.x + v * dt) % roadLength, v };
    });

    for (let i = 0; i < cars.length; i += 1) cars[i] = next[i];
  }

  return {
    project,
    fingerprint: projectFingerprint(project),
    roadLength,
    targetSpeed,
    vehicleCount,
    fps,
    duration,
    frames,
  };
}

export function frameAtTime(timeline, seconds) {
  const index = clamp(Math.round(seconds * timeline.fps), 0, timeline.frames.length - 1);
  return timeline.frames[index];
}

export function ringPoint(position, roadLength, width, height) {
  const theta = (position / roadLength) * TAU - Math.PI / 2;
  const rx = width * 0.34;
  const ry = height * 0.26;
  return {
    x: width / 2 + Math.cos(theta) * rx,
    y: height * 0.47 + Math.sin(theta) * ry,
    theta,
  };
}
