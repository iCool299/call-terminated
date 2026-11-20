// Tiny synthesised sound effects (no audio files): punchy hits, whooshes and thuds made with WebAudio.
let ac = null, noiseBuf = null, master = null;

function ctx() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
export function unlock() { ctx(); }

function noise(dur, f0, f1, gain, type = 'bandpass') {
  const a = ctx(); if (!a) return;
  const s = a.createBufferSource(); s.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, a.currentTime); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), a.currentTime + dur);
  const g = a.createGain(); g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(a.currentTime + dur + 0.02);
}
function tone(f0, f1, dur, gain, type = 'sine') {
  const a = ctx(); if (!a) return;
  const o = a.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, a.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), a.currentTime + dur);
  const g = a.createGain(); g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(a.currentTime + dur + 0.02);
}

export const sfx = {
  hit(power = 1) { noise(0.09, 2400, 500, 0.5 * power); tone(190 * (1.1 - power * 0.2), 70, 0.11, 0.5 * power); },
  hurt() { noise(0.12, 1800, 300, 0.55); tone(150, 55, 0.16, 0.6, 'triangle'); },
  whoosh() { noise(0.22, 500, 2600, 0.22); },
  thud() { tone(120, 38, 0.32, 0.9); noise(0.2, 700, 90, 0.55, 'lowpass'); },
  grab() { noise(0.1, 900, 400, 0.3); tone(240, 160, 0.08, 0.25, 'square'); },
  ko() { tone(300, 60, 0.45, 0.5, 'sawtooth'); noise(0.3, 900, 120, 0.4); },
  spawn() { tone(420, 840, 0.14, 0.18, 'square'); },
  special() { noise(0.12, 1500, 3000, 0.2); },
};
