import { buildTimeline, normalizeProject, ringPoint } from '../sim/model.js';
import { parseProjectText, serializeProjectDocument } from '../project/format.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');
let project = normalizeProject({});
let timeline = buildTimeline(project);
let frameIndex = 0;
let playing = false;
let startAt = 0;
let startFrame = 0;
let exportAbort = null;

function setStatus(message, tone = 'neutral') {
  const status = $('status');
  status.textContent = message;
  status.dataset.tone = tone;
}

function readProject() {
  return normalizeProject({
    name: $('name').value,
    seed: Number($('seed').value),
    parameters: {
      density: Number($('density').value),
      reaction: Number($('reaction').value),
      braking: Number($('braking').value),
      duration: Number($('duration').value),
      fps: 30,
    },
  });
}

function labels() {
  $('densityOut').textContent = (+$('density').value).toFixed(2);
  $('reactionOut').textContent = `${(+$('reaction').value).toFixed(2)} s`;
  $('brakingOut').textContent = `${(+$('braking').value).toFixed(1)} m/s²`;
  $('durationOut').textContent = `${+$('duration').value} s`;
}

function rebuild() {
  project = readProject();
  timeline = buildTimeline(project);
  frameIndex = Math.min(frameIndex, timeline.frames.length - 1);
  $('scrub').max = timeline.frames.length - 1;
  $('total').textContent = `${timeline.duration.toFixed(2)}s`;
  $('finger').textContent = `#${timeline.fingerprint}`;
  labels();
  renderCurrent();
}

function narrative(frame) {
  if (frame.waveStrength < 0.035) return 'Speeds are tightly clustered. The ring is close to uniform flow.';
  if (frame.waveStrength < 0.09) return 'Speed differences are propagating between neighboring cars. A compression wave is forming.';
  return 'A strong stop-and-go pattern is present: some cars remain fast while others are forced into slower motion.';
}

function renderScene(c, x, frame, tl, title = project.name) {
  const { width: w, height: h } = x;
  c.clearRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d141e');
  g.addColorStop(1, '#07090d');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#eef3f9';
  c.font = `700 ${Math.max(22, w * 0.052)}px system-ui`;
  c.fillText(title, w * 0.08, h * 0.09);
  c.fillStyle = '#7f8ea2';
  c.font = `500 ${Math.max(12, w * 0.024)}px ui-monospace,monospace`;
  c.fillText('KINETIC / SIMPLIFIED TRAFFIC RING', w * 0.08, h * 0.125);
  c.fillStyle = '#637187';
  c.font = `600 ${Math.max(10, w * 0.017)}px ui-monospace,monospace`;
  c.fillText(
    `density ${tl.project.parameters.density.toFixed(2)}  •  reaction ${tl.project.parameters.reaction.toFixed(2)}s  •  braking ${tl.project.parameters.braking.toFixed(1)}m/s²  •  #${tl.fingerprint}`,
    w * 0.08,
    h * 0.155,
  );
  c.save();
  c.translate(w / 2, h * 0.48);
  c.strokeStyle = '#283241';
  c.lineWidth = Math.max(24, w * 0.09);
  c.beginPath();
  c.ellipse(0, 0, w * 0.36, h * 0.19, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = '#0a0d12';
  c.lineWidth = Math.max(2, w * 0.008);
  c.setLineDash([14, 16]);
  c.beginPath();
  c.ellipse(0, 0, w * 0.36, h * 0.19, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  for (const car of frame.cars) {
    const p = ringPoint(car.x, tl.roadLength, w, h);
    const ratio = Math.min(1, car.v / tl.targetSpeed);
    const r = Math.round(245 - 150 * ratio);
    const gg = Math.round(95 + 135 * ratio);
    const b = Math.round(100 + 110 * ratio);
    c.save();
    c.translate(p.x, p.y + h * 0.01);
    c.rotate(p.theta + Math.PI / 2);
    c.fillStyle = `rgb(${r},${gg},${b})`;
    c.shadowColor = `rgba(${r},${gg},${b},.38)`;
    c.shadowBlur = w * 0.016;
    c.fillRect(-w * 0.009, -w * 0.02, w * 0.018, w * 0.04);
    c.restore();
  }
  const y = h * 0.76;
  c.fillStyle = '#111823';
  c.fillRect(w * 0.07, y - h * 0.055, w * 0.86, h * 0.13);
  [
    ['AVG SPEED', `${(frame.avgSpeed * 2.23694).toFixed(1)} mph`],
    ['MIN SPEED', `${(frame.minSpeed * 2.23694).toFixed(1)} mph`],
    ['WAVE', frame.waveStrength.toFixed(3)],
  ].forEach(([a, b], i) => {
    const xx = w * (0.11 + i * 0.285);
    c.fillStyle = '#6f7f94';
    c.font = `600 ${Math.max(10, w * 0.018)}px ui-monospace`;
    c.fillText(a, xx, y);
    c.fillStyle = '#edf2f7';
    c.font = `700 ${Math.max(18, w * 0.037)}px system-ui`;
    c.fillText(b, xx, y + h * 0.04);
  });
  c.fillStyle = '#8d9aab';
  c.font = `500 ${Math.max(11, w * 0.02)}px system-ui`;
  c.fillText(`t = ${frame.t.toFixed(2)} s  •  ${tl.vehicleCount} cars  •  seed ${tl.project.seed}`, w * 0.08, h * 0.9);
  c.fillStyle = '#566274';
  c.font = `500 ${Math.max(10, w * 0.016)}px system-ui`;
  c.fillText('Educational toy model — not calibrated for real-world traffic prediction.', w * 0.08, h * 0.935);
}

function renderCurrent() {
  const frame = timeline.frames[frameIndex];
  renderScene(ctx, canvas, frame, timeline);
  $('scrub').value = frameIndex;
  $('time').textContent = `${frame.t.toFixed(2)}s`;
  $('cars').textContent = timeline.vehicleCount;
  $('avg').textContent = `${(frame.avgSpeed * 2.23694).toFixed(1)} mph`;
  $('min').textContent = `${(frame.minSpeed * 2.23694).toFixed(1)} mph`;
  $('wave').textContent = frame.waveStrength.toFixed(3);
  $('narrative').textContent = narrative(frame);
}

function loop(now) {
  if (!playing) return;
  frameIndex = Math.min(
    timeline.frames.length - 1,
    startFrame + Math.floor(((now - startAt) / 1000) * timeline.fps),
  );
  renderCurrent();
  if (frameIndex >= timeline.frames.length - 1) {
    playing = false;
    $('play').textContent = '▶';
    return;
  }
  requestAnimationFrame(loop);
}

function toggle() {
  if (playing) {
    playing = false;
    $('play').textContent = '▶';
    return;
  }
  if (frameIndex >= timeline.frames.length - 1) frameIndex = 0;
  playing = true;
  startFrame = frameIndex;
  startAt = performance.now();
  $('play').textContent = 'Ⅱ';
  requestAnimationFrame(loop);
}

function save() {
  const payload = serializeProjectDocument(project);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kinetic-project'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus(`Project saved • #${timeline.fingerprint}`, 'success');
}

function applyProject(nextProject) {
  project = nextProject;
  $('name').value = project.name;
  $('seed').value = project.seed;
  $('density').value = project.parameters.density;
  $('reaction').value = project.parameters.reaction;
  $('braking').value = project.parameters.braking;
  $('duration').value = project.parameters.duration;
  rebuild();
}

async function load(file) {
  const nextProject = parseProjectText(await file.text());
  applyProject(nextProject);
  setStatus(`Project loaded • #${timeline.fingerprint}`, 'success');
}

function mime() {
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
}

async function exportVideo() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    setStatus('Video export unsupported in this browser', 'error');
    return;
  }
  const type = mime();
  if (!type) {
    setStatus('No supported WebM encoder found', 'error');
    return;
  }
  const out = document.createElement('canvas');
  out.width = 720;
  out.height = 1280;
  const oc = out.getContext('2d');
  const stream = out.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 });
  const chunks = [];
  rec.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const done = new Promise((resolve, reject) => {
    rec.onstop = resolve;
    rec.onerror = () => reject(rec.error || new Error('MediaRecorder failed'));
  });
  exportAbort = new AbortController();
  $('exportState').hidden = false;
  $('export').disabled = true;
  setStatus('Exporting exact timeline');
  rec.start();
  const exportStartedAt = performance.now();
  try {
    for (let i = 0; i < timeline.frames.length; i += 1) {
      if (exportAbort.signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      renderScene(oc, out, timeline.frames[i], timeline);
      track.requestFrame?.();
      const pct = Math.round((i / (timeline.frames.length - 1)) * 100);
      $('progressText').textContent = `${pct}%`;
      $('progress').value = pct;
      if (i < timeline.frames.length - 1) {
        const deadline = exportStartedAt + ((i + 1) / timeline.fps) * 1000;
        const delay = deadline - performance.now();
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        else await new Promise(requestAnimationFrame);
      }
    }
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kinetic'}-${timeline.fingerprint}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setStatus(`Export complete • #${timeline.fingerprint} • ${Math.round(blob.size / 1024)} KB`, 'success');
  } catch (error) {
    if (rec.state !== 'inactive') rec.stop();
    setStatus(error.name === 'AbortError' ? 'Export cancelled' : `Export failed: ${error.message}`, error.name === 'AbortError' ? 'neutral' : 'error');
  } finally {
    exportAbort = null;
    $('exportState').hidden = true;
    $('export').disabled = false;
  }
}

['density', 'reaction', 'braking', 'duration'].forEach((id) => $(id).addEventListener('input', rebuild));
['name', 'seed'].forEach((id) => $(id).addEventListener('change', rebuild));
$('play').onclick = toggle;
$('reset').onclick = () => {
  playing = false;
  frameIndex = 0;
  $('play').textContent = '▶';
  renderCurrent();
};
$('scrub').oninput = () => {
  playing = false;
  frameIndex = +$('scrub').value;
  $('play').textContent = '▶';
  renderCurrent();
};
$('save').onclick = save;
$('load').onchange = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await load(file);
  } catch (error) {
    setStatus(`Load failed • ${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
};
$('export').onclick = () => exportVideo().catch((error) => setStatus(`Export failed: ${error.message}`, 'error'));
$('cancel').onclick = () => exportAbort?.abort();

rebuild();
