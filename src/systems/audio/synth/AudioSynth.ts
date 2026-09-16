/**
 * Procedural Audio Synthesizer for The Last Signal.
 *
 * Generates lightweight, high-fidelity procedural PCM WAV data URIs in-memory.
 * Zero external asset dependencies, zero network requests, instant startup,
 * and reliable across all environments including headless CI.
 */
import type { AudioClipId } from '../types';

export class AudioSynth {
  private static readonly cache = new Map<AudioClipId, string>();

  /**
   * Retrieves the base64 WAV data URI for the specified audio clip,
   * generating it on first access.
   */
  static getClipUri(id: AudioClipId): string {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const uri = this.generateClip(id);
    this.cache.set(id, uri);
    return uri;
  }

  private static generateClip(id: AudioClipId): string {
    const sampleRate = 22050;

    switch (id) {
      case 'footstep_concrete':
        return this.createFootstepConcrete(sampleRate);
      case 'footstep_metal':
        return this.createFootstepMetal(sampleRate);
      case 'footstep_snow':
        return this.createFootstepSnow(sampleRate);
      case 'footstep_wood':
        return this.createFootstepWood(sampleRate);
      case 'landing_thud':
        return this.createLandingThud(sampleRate);
      case 'ambience_wind':
        return this.createAmbienceWind(sampleRate);
      case 'ambience_facility_hum':
        return this.createFacilityHum(sampleRate);
      case 'generator_rumble':
        return this.createGeneratorRumble(sampleRate);
      case 'electrical_spark':
        return this.createElectricalSpark(sampleRate);
      case 'radio_static':
        return this.createRadioStatic(sampleRate);
      case 'radio_carrier':
        return this.createRadioCarrier(sampleRate);
      case 'threat_heartbeat':
        return this.createThreatHeartbeat(sampleRate);
      case 'threat_pursuit':
        return this.createThreatPursuit(sampleRate);
      case 'threat_distortion':
        return this.createThreatDistortion(sampleRate);
    }
  }

  private static createFootstepConcrete(sr: number): string {
    const duration = 0.12;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 38);
      const noise = Math.random() * 2 - 1;
      const thud = Math.sin(2 * Math.PI * 95 * t);
      buf[i] = (noise * 0.4 + thud * 0.6) * env;
    }
    return this.encodeWav(buf, sr);
  }

  private static createFootstepMetal(sr: number): string {
    const duration = 0.15;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 28);
      const ping = Math.sin(2 * Math.PI * 1250 * t) * 0.4 + Math.sin(2 * Math.PI * 2400 * t) * 0.2;
      const clank = (Math.random() * 2 - 1) * 0.4;
      buf[i] = (ping + clank) * env;
    }
    return this.encodeWav(buf, sr);
  }

  private static createFootstepSnow(sr: number): string {
    const duration = 0.18;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 18) * Math.sin((Math.PI * i) / len);
      const crunch = (Math.random() * 2 - 1) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 600 * t));
      buf[i] = crunch * env * 0.7;
    }
    return this.encodeWav(buf, sr);
  }

  private static createFootstepWood(sr: number): string {
    const duration = 0.14;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 32);
      const knock = Math.sin(2 * Math.PI * 220 * t) * 0.7 + Math.sin(2 * Math.PI * 440 * t) * 0.3;
      buf[i] = knock * env;
    }
    return this.encodeWav(buf, sr);
  }

  private static createLandingThud(sr: number): string {
    const duration = 0.25;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 18);
      const boom = Math.sin(2 * Math.PI * (70 - t * 120) * t) * 0.8;
      const crunch = (Math.random() * 2 - 1) * 0.2;
      buf[i] = (boom + crunch) * env;
    }
    return this.encodeWav(buf, sr);
  }

  private static createAmbienceWind(sr: number): string {
    // 2.0s seamless loop
    const duration = 2.0;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const white = Math.random() * 2 - 1;
      // Low-pass filtered pink/brown noise
      last = (last + 0.04 * white) / 1.04;
      // Subtle wind gust oscillation
      const gust = 0.6 + 0.4 * Math.sin((2 * Math.PI * t) / duration);
      buf[i] = last * gust * 2.8;
    }
    this.applySeamlessCrossfade(buf, Math.floor(sr * 0.15));
    return this.encodeWav(buf, sr);
  }

  private static createFacilityHum(sr: number): string {
    // 1.5s seamless loop
    const duration = 1.5;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // 60Hz fundamental + 120Hz harmonic + subtle random buzz
      const h60 = Math.sin(2 * Math.PI * 60 * t) * 0.6;
      const h120 = Math.sin(2 * Math.PI * 120 * t) * 0.3;
      const h180 = Math.sin(2 * Math.PI * 180 * t) * 0.1;
      const buzz = (Math.random() * 2 - 1) * 0.05;
      buf[i] = (h60 + h120 + h180 + buzz) * 0.6;
    }
    this.applySeamlessCrossfade(buf, Math.floor(sr * 0.1));
    return this.encodeWav(buf, sr);
  }

  private static createGeneratorRumble(sr: number): string {
    // 1.5s seamless loop
    const duration = 1.5;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // Low RPM chug (~30Hz) with cylinder compression pulses
      const chug = Math.sin(2 * Math.PI * 30 * t);
      const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 15 * t)), 3) * 0.5;
      const rumbleNoise = (Math.random() * 2 - 1) * 0.15;
      buf[i] = (chug * 0.5 + pulse + rumbleNoise) * 0.8;
    }
    this.applySeamlessCrossfade(buf, Math.floor(sr * 0.1));
    return this.encodeWav(buf, sr);
  }

  private static createElectricalSpark(sr: number): string {
    const duration = 0.12;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 30);
      const arc = (Math.random() * 2 - 1) * (Math.sin(2 * Math.PI * 800 * t) > 0 ? 1 : -0.5);
      buf[i] = arc * env * 0.7;
    }
    return this.encodeWav(buf, sr);
  }

  private static createRadioStatic(sr: number): string {
    // 1.5s seamless loop
    const duration = 1.5;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    let filter = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // High-frequency hiss filter
      filter = 0.8 * filter + 0.2 * white;
      buf[i] = filter * 0.6;
    }
    this.applySeamlessCrossfade(buf, Math.floor(sr * 0.1));
    return this.encodeWav(buf, sr);
  }

  private static createRadioCarrier(sr: number): string {
    // 0.8s carrier beep tone
    const duration = 0.8;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.sin((Math.PI * i) / len);
      // Pure 880Hz sine tone
      buf[i] = Math.sin(2 * Math.PI * 880 * t) * env * 0.7;
    }
    return this.encodeWav(buf, sr);
  }

  private static createThreatHeartbeat(sr: number): string {
    // 1.2s seamless loop (double pulse: lub-dub)
    const duration = 1.2;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // Lub at t=0.1, Dub at t=0.35
      let val = 0;
      if (t >= 0.08 && t <= 0.24) {
        const dt = t - 0.08;
        val += Math.sin(2 * Math.PI * 52 * dt) * Math.exp(-dt * 26) * 0.85;
      }
      if (t >= 0.32 && t <= 0.46) {
        const dt = t - 0.32;
        val += Math.sin(2 * Math.PI * 46 * dt) * Math.exp(-dt * 30) * 0.65;
      }
      buf[i] = val;
    }
    return this.encodeWav(buf, sr);
  }

  private static createThreatPursuit(sr: number): string {
    // 1.0s dissonant musical crescendo stinger
    const duration = 1.0;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 2.5) * Math.exp(-(t - 0.4) * 2);
      // Tritone clash: C4 (261Hz) and F#4 (370Hz) with sharp harmonics
      const d1 = Math.sin(2 * Math.PI * 261.6 * t);
      const d2 = Math.sin(2 * Math.PI * 369.9 * t);
      const d3 = Math.sin(2 * Math.PI * 740.0 * t) * 0.4;
      buf[i] = ((d1 + d2 + d3) / 2.4) * Math.max(0, env);
    }
    return this.encodeWav(buf, sr);
  }

  private static createThreatDistortion(sr: number): string {
    // 0.6s eerie localized pitch-bent metallic creak
    const duration = 0.6;
    const len = Math.floor(sr * duration);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.sin((Math.PI * i) / len);
      const freq = 440 - t * 280;
      const creak = Math.sin(2 * Math.PI * freq * t) * (Math.random() * 0.3 + 0.7);
      buf[i] = creak * env * 0.75;
    }
    return this.encodeWav(buf, sr);
  }

  /** Smoothes loop boundaries to eliminate audio clicks. */
  private static applySeamlessCrossfade(buf: Float32Array, crossfadeSamples: number): void {
    const len = buf.length;
    const count = Math.min(crossfadeSamples, Math.floor(len / 4));
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const startVal = buf[i] ?? 0;
      const endVal = buf[len - count + i] ?? 0;
      const blend = startVal * t + endVal * (1 - t);
      buf[i] = blend;
      buf[len - count + i] = blend;
    }
  }

  /**
   * Encodes a mono Float32Array into a 16-bit PCM RIFF WAVE Base64 Data URI.
   */
  private static encodeWav(samples: Float32Array, sampleRate: number): string {
    const numSamples = samples.length;
    const byteRate = sampleRate * 2;
    const blockAlign = 2;
    const dataSize = numSamples * 2;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // RIFF identifier
    view.setUint8(0, 0x52); // 'R'
    view.setUint8(1, 0x49); // 'I'
    view.setUint8(2, 0x46); // 'F'
    view.setUint8(3, 0x46); // 'F'
    // file length minus RIFF header (36 + dataSize)
    view.setUint32(4, 36 + dataSize, true);
    // WAVE identifier
    view.setUint8(8, 0x57); // 'W'
    view.setUint8(9, 0x41); // 'A'
    view.setUint8(10, 0x56); // 'V'
    view.setUint8(11, 0x45); // 'E'
    // 'fmt ' chunk
    view.setUint8(12, 0x66); // 'f'
    view.setUint8(13, 0x6d); // 'm'
    view.setUint8(14, 0x74); // 't'
    view.setUint8(15, 0x20); // ' '
    view.setUint32(16, 16, true); // chunk length (16 for PCM)
    view.setUint16(20, 1, true); // sample format (1 = PCM)
    view.setUint16(22, 1, true); // channel count (1 = mono)
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, byteRate, true); // byte rate
    view.setUint16(32, blockAlign, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    // 'data' chunk
    view.setUint8(36, 0x64); // 'd'
    view.setUint8(37, 0x61); // 'a'
    view.setUint8(38, 0x74); // 't'
    view.setUint8(39, 0x61); // 'a'
    view.setUint32(40, dataSize, true);

    // Write 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
      const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    // Convert to binary string -> base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, sub as unknown as number[]);
    }

    const base64 =
      typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return `data:audio/wav;base64,${base64}`;
  }
}
