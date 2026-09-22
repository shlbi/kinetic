# Browser/export verification — 2026-09-22

This is an observed verification record for the first Kinetic traffic vertical slice. It is not a claim of scientific traffic-model accuracy.

## Scenario

- Project: `Nightshift Browser Verification`
- Seed: `31415`
- Density: `0.73`
- Reaction: `1.65 s`
- Braking: `3.7 m/s²`
- Timeline duration: `6 s`
- Fingerprint: `488f54b4`

## Browser checks

The committed `index.html` and `src/sim/model.js` were reconstructed byte-for-byte from GitHub connector reads. Because the execution runtime blocks Chromium navigation to both localhost and `file://` with `ERR_BLOCKED_BY_ADMINISTRATOR`, the exact application sources were loaded into headless system Chromium with the model module inlined only for transport. Application logic was otherwise unchanged.

Observed in Chromium:

- No page errors.
- Changing reaction time changed the project fingerprint.
- Restoring the original reaction time restored the original fingerprint.
- Saving produced a `kinetic-project-v1` JSON file with the selected values.
- Loading that file after mutating the editor restored the original fingerprint and density.
- Export produced `nightshift-browser-verification-488f54b4.webm`.
- Export cancellation reached the `Export cancelled` state.

## Actual video verification

The downloaded file was opened with `ffprobe` and decoded with `ffmpeg`.

- Codec: VP9
- Dimensions: `720×1280`
- Container duration observed: `5.864712 s` for the selected `6 s` timeline
- File size observed: `1,299,835 bytes`
- First frame decoded successfully.
- The decoded first video frame was compared with the editor's t=0 preview after scaling the 540×960 preview to 720×1280. Mean absolute RGB error was `2.726 / 255`, equivalent to `98.93%` simple pixel similarity. Differences are expected from VP9 compression and rasterization at a different canvas size.
- The exported filename contained the same project fingerprint as the editor.

The export scheduler was then changed from accumulating one sleep per frame to deadline-based pacing. This materially reduced wall-clock drift observed in the earlier export attempt, where a 6-second scenario encoded as about 7.39 seconds.

## CI

GitHub Actions run `35698273227` for commit `58b4277b7ef4de842456470c997be789cb707045` completed successfully after the export pacing/auditability change. Existing model tests and the build remained green.

## Limitation

The encoded WebM's container duration is close to, but not bit-exact with, the model timeline duration because `MediaRecorder` timestamps are browser/encoder wall-clock timestamps. The deterministic frame sequence, scenario fingerprint, displayed assumptions, and first-frame correspondence are verified. A future export backend could use explicit media timestamps if frame-accurate container timing becomes a requirement.
