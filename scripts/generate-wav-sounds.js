const fs = require('fs');
const path = require('path');

function createWavHeader(dataLength, sampleRate = 44100, numChannels = 1, bitsPerSample = 16) {
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(dataLength + 36, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  return buffer;
}

function writeWavFile(filePath, samples, sampleRate = 44100) {
  const dataLength = samples.length * 2;
  const header = createWavHeader(dataLength, sampleRate);
  const dataBuffer = Buffer.alloc(dataLength);
  for (let i = 0; i < samples.length; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    const intVal = val < 0 ? val * 0x8000 : val * 0x7FFF;
    dataBuffer.writeInt16LE(intVal, i * 2);
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat([header, dataBuffer]));
  console.log(`Generated: ${path.basename(filePath)}`);
}

// ==================== RED OPTIONS ====================

// Option 1: Soft Warning Thud
function redOption1(sampleRate = 44100) {
  const duration = 0.25;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let amp = 0;
    if (t < 0.08) {
      const tPulse = t;
      const freq = 180 - tPulse * 300;
      const env = Math.sin(Math.PI * tPulse / 0.08);
      amp = Math.sin(2 * Math.PI * freq * tPulse) * env * 0.5;
    } else if (t >= 0.12 && t < 0.20) {
      const tPulse = t - 0.12;
      const freq = 160 - tPulse * 300;
      const env = Math.sin(Math.PI * tPulse / 0.08);
      amp = Math.sin(2 * Math.PI * freq * tPulse) * env * 0.4;
    }
    samples[i] = amp;
  }
  return samples;
}

// Option 2: Low-pitched Bubble Pop
function redOption2(sampleRate = 44100) {
  const duration = 0.15;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = 120 - t * 400;
    const env = Math.exp(-22 * t);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
  }
  return samples;
}

// Option 3: Gentle Error Bell (Flat chime)
function redOption3(sampleRate = 44100) {
  const duration = 0.35;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-12 * t);
    const v1 = Math.sin(2 * Math.PI * 220 * t);
    const v2 = Math.sin(2 * Math.PI * 233 * t) * 0.7;
    samples[i] = (v1 + v2) * env * 0.35;
  }
  return samples;
}

// Option 4: Quiet Slide Down (Downwards swoop)
function redOption4(sampleRate = 44100) {
  const duration = 0.25;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = 380 - (t * 900);
    const env = Math.max(0, 1 - (t / duration));
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
  }
  return samples;
}

// Option 5: Analog Synth Beep-Beep
function redOption5(sampleRate = 44100) {
  const duration = 0.2;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let amp = 0;
    if (t < 0.04) {
      const env = Math.sin(Math.PI * t / 0.04);
      amp = Math.sin(2 * Math.PI * 580 * t) * env * 0.3;
    } else if (t >= 0.08 && t < 0.12) {
      const t2 = t - 0.08;
      const env = Math.sin(Math.PI * t2 / 0.04);
      amp = Math.sin(2 * Math.PI * 580 * t2) * env * 0.3;
    }
    samples[i] = amp;
  }
  return samples;
}

// Option 6: Cartoon Trombone Wah-Wah (Buồn cười / Comical fail)
function redOption6(sampleRate = 44100) {
  const duration = 0.65;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.sin(Math.PI * t / duration); // bell curve envelope
    // pitch slides down from 200Hz to 110Hz
    const freq = 200 - (t / duration) * 90;
    // amplitude modulation at 12Hz simulates "wah-wah" vibration
    const modulation = 0.7 + 0.3 * Math.sin(2 * Math.PI * 12 * t);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * modulation * 0.45;
  }
  return samples;
}

// Option 7: 8-Bit Retro Game Over (Tèo buồn kiểu game cổ điển)
function redOption7(sampleRate = 44100) {
  const duration = 0.6;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  // Four steps: G3 (196Hz) -> E3 (165Hz) -> C3 (131Hz) -> B2 (123Hz)
  const notes = [
    { freq: 196.00, start: 0.0, end: 0.12 },
    { freq: 164.81, start: 0.12, end: 0.24 },
    { freq: 130.81, start: 0.24, end: 0.36 },
    { freq: 123.47, start: 0.36, end: 0.60 }
  ];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    const note = notes.find(n => t >= n.start && t < n.end);
    if (note) {
      // Linear decay inside each note segment
      const noteProgress = (t - note.start) / (note.end - note.start);
      const env = 1 - noteProgress;
      // Square wave for retro 8-bit sound
      const wave = Math.sign(Math.sin(2 * Math.PI * note.freq * t));
      val = wave * env * 0.2;
    }
    samples[i] = val;
  }
  return samples;
}

// Option 8: Sad Spring / Boing Down
function redOption8(sampleRate = 44100) {
  const duration = 0.45;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-6 * t);
    // base frequency slides down from 280Hz to 90Hz
    const baseFreq = 280 - (t / duration) * 190;
    // frequency modulates rapidly to create springy "boing"
    const freq = baseFreq + 25 * Math.sin(2 * Math.PI * 45 * t);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
  }
  return samples;
}


// ==================== YELLOW OPTIONS ====================

// Option 1: Wood Block Click
function yellowOption1(sampleRate = 44100) {
  const duration = 0.08;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-60 * t);
    samples[i] = Math.sin(2 * Math.PI * 700 * t) * env * 0.3;
  }
  return samples;
}

// Option 2: High-pitch Water Drop
function yellowOption2(sampleRate = 44100) {
  const duration = 0.12;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = 1000 + (t * 6000);
    const env = Math.exp(-35 * t);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
  }
  return samples;
}

// Option 3: Acoustic Guitar Pluck
function yellowOption3(sampleRate = 44100) {
  const duration = 0.45;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  const freq = 329.63; // E4
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-10 * t);
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic1 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.25;
    const harmonic2 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.1;
    samples[i] = (fundamental + harmonic1 + harmonic2) * env * 0.35;
  }
  return samples;
}

// Option 4: Soft Tambourine/Shaker Tap
function yellowOption4(sampleRate = 44100) {
  const duration = 0.06;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-70 * t);
    const noise = Math.random() - 0.5;
    samples[i] = noise * env * 0.25;
  }
  return samples;
}

// Option 5: Muted Marimba Hit
function yellowOption5(sampleRate = 44100) {
  const duration = 0.25;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  const freq = 523.25; // C5
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-22 * t);
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const malletBounce = Math.sin(2 * Math.PI * freq * 3.1 * t) * 0.2;
    samples[i] = (fundamental + malletBounce) * env * 0.4;
  }
  return samples;
}

// Option 6: Comical Plink Down
function yellowOption6(sampleRate = 44100) {
  const duration = 0.18;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = 800 - t * 1500; // slides down from 800Hz to 530Hz
    const env = Math.exp(-30 * t);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.35;
  }
  return samples;
}

// Option 7: 8-Bit Jump Fail (Tiếng rơi nhảy hụt)
function yellowOption7(sampleRate = 44100) {
  const duration = 0.25;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    // slides up then drops off
    const freq = t < 0.12 ? 300 + t * 1200 : 150 - (t - 0.12) * 200;
    const env = Math.exp(-15 * t);
    const wave = Math.sign(Math.sin(2 * Math.PI * freq * t));
    val = wave * env * 0.18;
    samples[i] = val;
  }
  return samples;
}

// Option 8: Double Sad Blip (Còi buồn đôi)
function yellowOption8(sampleRate = 44100) {
  const duration = 0.3;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    if (t < 0.1) {
      const env = Math.exp(-25 * t);
      // Triangle wave approximation
      const phase = 2 * Math.PI * 330 * t;
      val = Math.asin(Math.sin(phase)) * env * 0.3;
    } else if (t >= 0.12 && t < 0.25) {
      const t2 = t - 0.12;
      const env = Math.exp(-20 * t2);
      const phase = 2 * Math.PI * 220 * t2;
      val = Math.asin(Math.sin(phase)) * env * 0.35;
    }
    samples[i] = val;
  }
  return samples;
}


// ==================== GREEN OPTIONS ====================

// Option 1: Standard Chime (Default)
function greenOption1(sampleRate = 44100) {
  const duration = 0.5;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    if (t < 0.4) {
      const env1 = Math.exp(-12 * t);
      val += Math.sin(2 * Math.PI * 880 * t) * env1 * 0.3;
    }
    if (t >= 0.08) {
      const t2 = t - 0.08;
      const env2 = Math.exp(-8 * t2);
      val += Math.sin(2 * Math.PI * 1318.51 * t2) * env2 * 0.4;
    }
    samples[i] = val;
  }
  return samples;
}

// Option 2: 8-Bit Retro Success (Level Up / Success Beep)
function greenOption2(sampleRate = 44100) {
  const duration = 0.35;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  const notes = [
    { freq: 523.25, start: 0.0, end: 0.08 }, // C5
    { freq: 659.25, start: 0.08, end: 0.16 }, // E5
    { freq: 783.99, start: 0.16, end: 0.24 }, // G5
    { freq: 1046.50, start: 0.24, end: 0.35 } // C6
  ];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    const note = notes.find(n => t >= n.start && t < n.end);
    if (note) {
      const wave = Math.sign(Math.sin(2 * Math.PI * note.freq * t));
      const env = Math.exp(-8 * (t - note.start));
      val = wave * env * 0.18;
    }
    samples[i] = val;
  }
  return samples;
}

// Option 3: Positive Guitar Harmonic
function greenOption3(sampleRate = 44100) {
  const duration = 0.7;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-5 * t);
    // 880Hz + high ring overtones
    const val = Math.sin(2 * Math.PI * 880 * t) + 
                Math.sin(2 * Math.PI * 1760 * t) * 0.3 + 
                Math.sin(2 * Math.PI * 2640 * t) * 0.15;
    samples[i] = val * env * 0.25;
  }
  return samples;
}

// Option 4: Gentle Bell Strike
function greenOption4(sampleRate = 44100) {
  const duration = 0.8;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-3.5 * t);
    // E5 bell chime
    const fundamental = Math.sin(2 * Math.PI * 659.25 * t);
    const ring = Math.sin(2 * Math.PI * 1977.75 * t) * 0.25; // overtone
    samples[i] = (fundamental + ring) * env * 0.35;
  }
  return samples;
}

// Option 5: Synth Success Beep
function greenOption5(sampleRate = 44100) {
  const duration = 0.3;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-15 * t);
    const val = Math.sin(2 * Math.PI * 523.25 * t) + Math.sin(2 * Math.PI * 1046.50 * t) * 0.3;
    // add minor echo delay
    let echo = 0;
    if (t >= 0.1) {
      echo = Math.sin(2 * Math.PI * 523.25 * (t - 0.1)) * Math.exp(-15 * (t - 0.1)) * 0.4;
    }
    samples[i] = (val + echo) * env * 0.35;
  }
  return samples;
}


// ==================== PURPLE OPTIONS ====================

// Option 1: Magical Sparkle (Default)
function purpleOption1(sampleRate = 44100) {
  const duration = 1.0;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  const notes = [
    { freq: 523.25, start: 0.0, decay: 6 },
    { freq: 659.25, start: 0.08, decay: 5 },
    { freq: 783.99, start: 0.16, decay: 4 },
    { freq: 1046.50, start: 0.24, decay: 3 }
  ];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    notes.forEach(note => {
      if (t >= note.start) {
        const tn = t - note.start;
        const env = Math.exp(-note.decay * tn);
        const sine = Math.sin(2 * Math.PI * note.freq * tn);
        const overtone = Math.sin(2 * Math.PI * note.freq * 2 * tn) * 0.15;
        val += (sine + overtone) * env * 0.25;
      }
    });
    samples[i] = val;
  }
  return samples;
}

// Option 2: 8-Bit Retro Fanfare (Cúp Chiến Thắng)
function purpleOption2(sampleRate = 44100) {
  const duration = 0.7;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  // Triumph notes: C5 (523Hz) -> G5 (784Hz) -> C6 (1046Hz) -> E6 (1318Hz) -> G6 (1568Hz)
  const notes = [
    { freq: 523.25, start: 0.0, end: 0.08 },
    { freq: 783.99, start: 0.08, end: 0.16 },
    { freq: 1046.50, start: 0.16, end: 0.24 },
    { freq: 1318.51, start: 0.24, end: 0.36 },
    { freq: 1567.98, start: 0.36, end: 0.70 }
  ];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    const note = notes.find(n => t >= n.start && t < n.end);
    if (note) {
      const wave = Math.sign(Math.sin(2 * Math.PI * note.freq * t));
      const env = Math.exp(-4 * (t - note.start));
      val = wave * env * 0.18;
    }
    samples[i] = val;
  }
  return samples;
}

// Option 3: Heavenly Harp Swell
function purpleOption3(sampleRate = 44100) {
  const duration = 1.0;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  // Pentatonic scale sweep: C5 -> D5 -> E5 -> G5 -> A5 -> C6
  const notes = [
    { freq: 523.25, start: 0.0, decay: 5 },
    { freq: 587.33, start: 0.05, decay: 5 },
    { freq: 659.25, start: 0.10, decay: 5 },
    { freq: 783.99, start: 0.15, decay: 4 },
    { freq: 880.00, start: 0.20, decay: 4 },
    { freq: 1046.50, start: 0.25, decay: 3.5 }
  ];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let val = 0;
    notes.forEach(note => {
      if (t >= note.start) {
        const tn = t - note.start;
        const env = Math.exp(-note.decay * tn);
        val += Math.sin(2 * Math.PI * note.freq * tn) * env * 0.18;
      }
    });
    samples[i] = val;
  }
  return samples;
}

// Option 4: Triumphant Brass/Chime Chord
function purpleOption4(sampleRate = 44100) {
  const duration = 0.9;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  // Major triad chord: C5 + E5 + G5 + C6 together
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-4 * t);
    const v1 = Math.sin(2 * Math.PI * 523.25 * t) * 0.35;
    const v2 = Math.sin(2 * Math.PI * 659.25 * t) * 0.3;
    const v3 = Math.sin(2 * Math.PI * 783.99 * t) * 0.25;
    const v4 = Math.sin(2 * Math.PI * 1046.50 * t) * 0.2;
    samples[i] = (v1 + v2 + v3 + v4) * env;
  }
  return samples;
}

// Option 5: Cosmic Warp (Synth Rise)
function purpleOption5(sampleRate = 44100) {
  const duration = 0.8;
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-4 * t);
    // pitch sweeps up rapidly
    const freq = 320 + Math.pow(t / duration, 1.8) * 1100; // 320Hz up to 1420Hz
    // filter effect via harmonic modulation
    const base = Math.sin(2 * Math.PI * freq * t);
    const resonantHarmonic = Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.35 * Math.sin(2 * Math.PI * 4 * t);
    samples[i] = (base + resonantHarmonic) * env * 0.35;
  }
  return samples;
}

// ==================== GENERATING ====================

const previewDir = path.join(__dirname, '..', 'web', 'public', 'audio', 'preview');

// Generate 8 Red Options
writeWavFile(path.join(previewDir, 'red_option1.wav'), redOption1());
writeWavFile(path.join(previewDir, 'red_option2.wav'), redOption2());
writeWavFile(path.join(previewDir, 'red_option3.wav'), redOption3());
writeWavFile(path.join(previewDir, 'red_option4.wav'), redOption4());
writeWavFile(path.join(previewDir, 'red_option5.wav'), redOption5());
writeWavFile(path.join(previewDir, 'red_option6.wav'), redOption6());
writeWavFile(path.join(previewDir, 'red_option7.wav'), redOption7());
writeWavFile(path.join(previewDir, 'red_option8.wav'), redOption8());

// Generate 8 Yellow Options
writeWavFile(path.join(previewDir, 'yellow_option1.wav'), yellowOption1());
writeWavFile(path.join(previewDir, 'yellow_option2.wav'), yellowOption2());
writeWavFile(path.join(previewDir, 'yellow_option3.wav'), yellowOption3());
writeWavFile(path.join(previewDir, 'yellow_option4.wav'), yellowOption4());
writeWavFile(path.join(previewDir, 'yellow_option5.wav'), yellowOption5());
writeWavFile(path.join(previewDir, 'yellow_option6.wav'), yellowOption6());
writeWavFile(path.join(previewDir, 'yellow_option7.wav'), yellowOption7());
writeWavFile(path.join(previewDir, 'yellow_option8.wav'), yellowOption8());

// Generate 5 Green Options
writeWavFile(path.join(previewDir, 'green_option1.wav'), greenOption1());
writeWavFile(path.join(previewDir, 'green_option2.wav'), greenOption2());
writeWavFile(path.join(previewDir, 'green_option3.wav'), greenOption3());
writeWavFile(path.join(previewDir, 'green_option4.wav'), greenOption4());
writeWavFile(path.join(previewDir, 'green_option5.wav'), greenOption5());

// Generate 5 Purple Options
writeWavFile(path.join(previewDir, 'purple_option1.wav'), purpleOption1());
writeWavFile(path.join(previewDir, 'purple_option2.wav'), purpleOption2());
writeWavFile(path.join(previewDir, 'purple_option3.wav'), purpleOption3());
writeWavFile(path.join(previewDir, 'purple_option4.wav'), purpleOption4());
writeWavFile(path.join(previewDir, 'purple_option5.wav'), purpleOption5());

// Overwrite default files
writeWavFile(path.join(previewDir, 'red.wav'), redOption1());
writeWavFile(path.join(previewDir, 'yellow.wav'), yellowOption1());
writeWavFile(path.join(previewDir, 'green.wav'), greenOption1());
writeWavFile(path.join(previewDir, 'purple.wav'), purpleOption1());

console.log('All 26 preview options generated successfully!');
