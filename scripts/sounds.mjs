import { mkdirSync, writeFileSync } from "node:fs";
import { sounds } from "../src/catalog.js";
mkdirSync("public/sounds", { recursive: true });
// Original procedural effects: no third-party recordings or copyrighted clips.
for (const s of sounds) {
  const rate = 22050,
    duration = s.index < 20 ? 1.35 : 2.4,
    n = Math.floor(rate * duration),
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      p = t / duration,
      k = s.index;
    const freq =
      k < 20
        ? [
            220 + 400 * Math.exp(-t * 5) * Math.cos(t * 22),
            380 + 150 * Math.sin(t * 25),
            160 + ((80 * Math.floor(t * 9)) % 320),
            500 + 600 * ((t * 5) % 1),
            420 - 210 * p,
            900 + 400 * Math.sin(t * 33),
            600 + 400 * Math.sin(t * 6),
            240 + 600 * Math.exp(-((t * 4) % 1) * 8),
            300 + 200 * (Math.sin(t * 20) > 0),
            330 + 170 * Math.sin(t * 40),
            1200 * Math.exp(-((t * 4) % 1) * 5),
            1000 - 850 * p,
            660 * Math.pow(1.5, Math.floor(t * 6) % 3),
            170 + 50 * Math.sin(t * 17),
            500 + Math.floor(t * 8) * 90,
            2500 + 300 * Math.sin(t * 70),
            440 + 90 * Math.sin(t * 11),
            100 + 150 * p + 40 * Math.sin(t * 50),
            850 - 500 * p + 100 * Math.sin(t * 90),
            [523, 659, 784, 1047][Math.min(3, Math.floor(p * 4))],
          ][k]
        : [
            110,
            145,
            80,
            900 * Math.exp(-(t % 1) * 2),
            300 + 500 * p,
            185,
            440 + 220 * (Math.sin(t * 8) > 0),
            330,
            600,
            130,
          ][k - 20];
    phase += (2 * Math.PI * freq) / rate;
    const gate =
      k < 20
        ? 0.55 + 0.45 * Math.sin(t * (12 + k) * Math.PI) ** 2
        : k === 23
          ? Math.exp(-(t % 1) * 5)
          : k === 27 || k === 28
            ? Math.sin(t * 13) > 0
              ? 1
              : 0
            : 1;
    const env = Math.min(1, t / 0.03, (duration - t) / 0.12),
      wave =
        Math.sin(phase) +
        0.28 * Math.sin(phase * 2) +
        0.12 * Math.sin(phase * 3);
    b.writeInt16LE(Math.round(wave * gate * env * 10500), 44 + i * 2);
  }
  writeFileSync(`public/sounds/${s.id}.wav`, b);
}
console.log("30 efectos WAV originales generados.");
