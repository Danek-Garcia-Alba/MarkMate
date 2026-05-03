import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "public", "remotion-assets", "markmate-pulse.wav");
const sampleRate = 48000;
const durationSeconds = 48;
const tempo = 158;
const totalSamples = durationSeconds * sampleRate;
const beatSeconds = 60 / tempo;
const data = new Float32Array(totalSamples);

const notes = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196,
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392,
  A4: 440,
  C5: 523.25,
};

const clamp = (value) => Math.max(-1, Math.min(1, value));

function addTone(freq, start, length, volume, type = "sine") {
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(totalSamples, startSample + Math.floor(length * sampleRate));
  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / sampleRate;
    const progress = t / length;
    const attack = Math.min(1, progress / 0.08);
    const release = Math.min(1, (1 - progress) / 0.18);
    const envelope = Math.max(0, Math.min(attack, release));
    const phase = 2 * Math.PI * freq * t;
    const oscillator =
      type === "triangle"
        ? (2 / Math.PI) * Math.asin(Math.sin(phase))
        : type === "square"
          ? Math.sign(Math.sin(phase))
          : Math.sin(phase);
    data[i] += oscillator * envelope * volume;
  }
}

function addKick(start) {
  const startSample = Math.floor(start * sampleRate);
  const length = 0.42;
  const endSample = Math.min(totalSamples, startSample + Math.floor(length * sampleRate));
  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / sampleRate;
    const env = Math.exp(-t * 8.5);
    const freq = 92 - 52 * Math.min(1, t / length);
    data[i] += Math.sin(2 * Math.PI * freq * t) * env * 0.62;
  }
}

function addSnare(start) {
  const startSample = Math.floor(start * sampleRate);
  const length = 0.18;
  const endSample = Math.min(totalSamples, startSample + Math.floor(length * sampleRate));
  let seed = 42;
  for (let i = startSample; i < endSample; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const t = (i - startSample) / sampleRate;
    const env = Math.exp(-t * 18);
    data[i] += noise * env * 0.18 + Math.sin(2 * Math.PI * 210 * t) * env * 0.09;
  }
}

function addHat(start) {
  const startSample = Math.floor(start * sampleRate);
  const length = 0.07;
  const endSample = Math.min(totalSamples, startSample + Math.floor(length * sampleRate));
  let seed = 7;
  for (let i = startSample; i < endSample; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const t = (i - startSample) / sampleRate;
    data[i] += noise * Math.exp(-t * 45) * 0.08;
  }
}

function addImpact(start) {
  addKick(start);
  addTone(notes.C3 / 2, start, 0.62, 0.22, "sine");
  const startSample = Math.floor(start * sampleRate);
  const length = 0.42;
  const endSample = Math.min(totalSamples, startSample + Math.floor(length * sampleRate));
  let seed = 99;
  for (let i = startSample; i < endSample; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const t = (i - startSample) / sampleRate;
    data[i] += noise * Math.exp(-t * 8) * 0.16;
  }
}

function addRiser(start, length = 1.1) {
  const startSample = Math.max(0, Math.floor(start * sampleRate));
  const endSample = Math.min(totalSamples, startSample + Math.floor(length * sampleRate));
  let seed = 123;
  for (let i = startSample; i < endSample; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const t = (i - startSample) / sampleRate;
    const progress = t / length;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const freq = 520 + progress * 2200;
    const tone = Math.sin(2 * Math.PI * freq * t);
    data[i] += (noise * 0.07 + tone * 0.06) * progress * Math.min(1, (1 - progress) / 0.12);
  }
}

const chordLoop = [
  [notes.D3, notes.F3, notes.A3, notes.C4],
  [notes.A3, notes.C4, notes.E4, notes.G4],
  [notes.G3, notes.C4, notes.D4, notes.F4],
  [notes.F3, notes.A3, notes.C4, notes.E4],
];

for (let bar = 0; bar < Math.ceil(durationSeconds / (beatSeconds * 4)); bar++) {
  const barStart = bar * beatSeconds * 4;
  const chord = chordLoop[bar % chordLoop.length];
  for (const note of chord) {
    addTone(note, barStart, beatSeconds * 3.8, 0.052, "triangle");
  }
  addTone(chord[0] / 2, barStart, beatSeconds * 3.9, 0.082, "sine");
}

const melody = [
  notes.D4,
  notes.F4,
  notes.A4,
  notes.G4,
  notes.E4,
  notes.F4,
  notes.C5,
  notes.A4,
];

for (let step = 0; step < durationSeconds / (beatSeconds / 2); step++) {
  const start = step * (beatSeconds / 2);
  if (step % 4 !== 3) {
    const note = melody[step % melody.length];
    addTone(note, start, beatSeconds * 0.42, step > 16 ? 0.095 : 0.065, "triangle");
  }
}

for (let beat = 0; beat < durationSeconds / beatSeconds; beat++) {
  const start = beat * beatSeconds;
  if (beat % 4 === 0 || beat % 4 === 2 || beat > 64) addKick(start);
  if (beat % 4 === 1 || beat % 4 === 3) addSnare(start);
  addHat(start);
  addHat(start + beatSeconds / 2);
  if (beat > 32) addHat(start + beatSeconds / 4);
  if (beat > 32) addHat(start + (beatSeconds * 3) / 4);
}

const sceneStarts = [0, 3.5, 8.5, 14.5, 20.5, 26.2, 32, 37.7, 42.8];
for (const start of sceneStarts) {
  addImpact(start);
  if (start > 0) addRiser(start - 1.05, 1.05);
}

for (let step = 0; step < durationSeconds / (beatSeconds / 4); step++) {
  const start = step * (beatSeconds / 4);
  if (step % 3 === 0) {
    const note = melody[(step / 3) % melody.length | 0];
    addTone(note * 2, start, beatSeconds * 0.18, 0.034, "square");
  }
}

const fadeSamples = Math.floor(sampleRate * 1.25);
for (let i = 0; i < totalSamples; i++) {
  const fadeIn = Math.min(1, i / fadeSamples);
  const fadeOut = Math.min(1, (totalSamples - i) / fadeSamples);
  data[i] = clamp(data[i] * fadeIn * fadeOut * 0.85);
}

const byteRate = sampleRate * 2;
const blockAlign = 2;
const buffer = Buffer.alloc(44 + totalSamples * 2);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + totalSamples * 2, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(totalSamples * 2, 40);

for (let i = 0; i < totalSamples; i++) {
  buffer.writeInt16LE(Math.round(clamp(data[i]) * 32767), 44 + i * 2);
}

mkdirSync(dirname(output), {recursive: true});
writeFileSync(output, buffer);
console.log(`Generated ${output}`);
