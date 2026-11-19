/**
 * Sound Engine for Disk Scheduling Simulator
 * Synthesizes realistic mechanical HDD actuator seek clicks and head-positioning audio
 * using the Web Audio API. 100% offline, zero external audio assets.
 */

const DiskSound = (function () {
  'use strict';

  let audioCtx = null;
  let enabled = false;
  let masterGain = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function setEnabled(val) {
    enabled = Boolean(val);
    if (enabled) {
      initAudio();
    }
  }

  function isEnabled() {
    return enabled;
  }

  function playSeek(distance = 10, isJump = false) {
    if (!enabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const duration = isJump ? 0.08 : Math.min(0.06, 0.02 + (distance / 500) * 0.04);

      // Actuator seek noise (bandpass filtered noise click)
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = isJump ? 'highpass' : 'bandpass';
      filter.frequency.setValueAtTime(isJump ? 3200 : 1200 + Math.min(2000, distance * 15), now);
      filter.Q.setValueAtTime(2.5, now);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(isJump ? 0.15 : 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      noise.start(now);
      noise.stop(now + duration);

      // Servo magnetic hum
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'triangle';
      const startFreq = isJump ? 220 : 180 + Math.min(400, distance * 3);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + duration);

      oscGain.gain.setValueAtTime(0.08, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  function playService() {
    if (!enabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  return {
    initAudio,
    setEnabled,
    isEnabled,
    playSeek,
    playService
  };
})();
