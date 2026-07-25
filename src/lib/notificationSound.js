import sound1 from "@/assets/sounds/sound1.mp3";
import sound2 from "@/assets/sounds/sound2.mp3";
import sound3 from "@/assets/sounds/sound3.mp3";
import sound4 from "@/assets/sounds/sound4.mp3";
import sound5 from "@/assets/sounds/sound5.mp3";
import sound6 from "@/assets/sounds/sound6.mp3";
import sound7 from "@/assets/sounds/sound7.mp3";
import sound8 from "@/assets/sounds/sound8.mp3";
import sound9 from "@/assets/sounds/sound9.mp3";
import sound10 from "@/assets/sounds/sound10.mp3";
import sound11 from "@/assets/sounds/sound11.mp3";
import sound12 from "@/assets/sounds/sound12.mp3";
import sound13 from "@/assets/sounds/sound13.mp3";

export const NOTIFICATION_SOUND_STORAGE_KEY = "stage_notification_sound";

/** @typedef {'whistle'|'stadium_cheer'|'trophy'|'cyber_ping'|'kickoff'|'goal_alert'|'arena_pulse'} SynthSoundId */

function playSynth(ctx, gainNode, soundId) {
  const t = ctx.currentTime;

  if (soundId === "cyber_ping") {
    const osc = ctx.createOscillator();
    osc.connect(gainNode);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    gainNode.gain.setValueAtTime(0.5, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t);
    osc.stop(t + 0.25);
    return;
  }

  if (soundId === "stadium_cheer") {
    const bufSize = ctx.sampleRate * 0.6;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;
    src.connect(filter);
    filter.connect(gainNode);
    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.linearRampToValueAtTime(0.4, t + 0.2);
    gainNode.gain.linearRampToValueAtTime(0.2, t + 0.4);
    gainNode.gain.linearRampToValueAtTime(0.001, t + 0.6);
    src.start(t);
    src.stop(t + 0.6);
    return;
  }

  if (soundId === "whistle") {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 8;
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gainNode);
    osc.type = "sine";
    osc.frequency.setValueAtTime(2800, t);
    gainNode.gain.setValueAtTime(0.4, t);
    gainNode.gain.setValueAtTime(0.4, t + 0.35);
    gainNode.gain.linearRampToValueAtTime(0.001, t + 0.5);
    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 0.5);
    osc.stop(t + 0.5);
    return;
  }

  if (soundId === "trophy") {
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.connect(gainNode);
      osc.type = "triangle";
      const start = t + i * 0.13;
      osc.frequency.setValueAtTime(freq, start);
      gainNode.gain.setValueAtTime(0.35, start);
      osc.start(start);
      osc.stop(start + (i === 3 ? 0.35 : 0.1));
    });
    return;
  }

  if (soundId === "kickoff") {
    const osc = ctx.createOscillator();
    osc.connect(gainNode);
    osc.type = "square";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.2);
    gainNode.gain.setValueAtTime(0.35, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
    return;
  }

  if (soundId === "goal_alert") {
    [880, 1108, 1318].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.connect(gainNode);
      osc.type = "sawtooth";
      const start = t + i * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gainNode.gain.setValueAtTime(0.25, start);
      gainNode.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.start(start);
      osc.stop(start + 0.16);
    });
    return;
  }

  if (soundId === "arena_pulse") {
    const osc = ctx.createOscillator();
    osc.connect(gainNode);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.15);
    osc.frequency.linearRampToValueAtTime(90, t + 0.45);
    gainNode.gain.setValueAtTime(0.45, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}

export const NOTIFICATION_SOUNDS = [
  { id: "whistle", label: "Referee Whistle", type: "synth", icon: "whistle", category: "sport" },
  { id: "kickoff", label: "Kick-off", type: "synth", icon: "boot", category: "sport" },
  { id: "goal_alert", label: "Goal Alert", type: "synth", icon: "goal", category: "sport" },
  { id: "stadium_cheer", label: "Stadium Roar", type: "synth", icon: "crowd", category: "sport" },
  { id: "trophy", label: "Victory Fanfare", type: "synth", icon: "trophy", category: "sport" },
  { id: "arena_pulse", label: "Arena Pulse", type: "synth", icon: "pulse", category: "sport" },
  { id: "cyber_ping", label: "Cyber Ping", type: "synth", icon: "zap", category: "digital" },
  { id: "sound1", label: "Classic Chime", type: "mp3", icon: "bell", category: "classic", src: sound1 },
  { id: "sound2", label: "Soft Pop", type: "mp3", icon: "pop", category: "classic", src: sound2 },
  { id: "sound3", label: "Digital Tap", type: "mp3", icon: "tap", category: "classic", src: sound3 },
  { id: "sound4", label: "Bright Ding", type: "mp3", icon: "ding", category: "classic", src: sound4 },
  { id: "sound5", label: "Low Tone", type: "mp3", icon: "tone", category: "classic", src: sound5 },
  { id: "sound6", label: "Quick Blip", type: "mp3", icon: "blip", category: "classic", src: sound6 },
  { id: "sound7", label: "Smooth Alert", type: "mp3", icon: "smooth", category: "classic", src: sound7 },
  { id: "sound8", label: "Rising Note", type: "mp3", icon: "rise", category: "classic", src: sound8 },
  { id: "sound9", label: "Stadium Echo", type: "mp3", icon: "echo", category: "classic", src: sound9 },
  { id: "sound10", label: "Match Ready", type: "mp3", icon: "match", category: "classic", src: sound10 },
  { id: "sound11", label: "Locker Room", type: "mp3", icon: "locker", category: "classic", src: sound11 },
  { id: "sound12", label: "Final Whistle", type: "mp3", icon: "final", category: "classic", src: sound12 },
  { id: "sound13", label: "Champion Call", type: "mp3", icon: "champion", category: "classic", src: sound13 },
];

export function getSelectedNotificationSoundId() {
  return localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY) || "whistle";
}

export function playNotificationSound(soundId = getSelectedNotificationSoundId()) {
  const sound = NOTIFICATION_SOUNDS.find((s) => s.id === soundId) || NOTIFICATION_SOUNDS[0];
  if (!sound) return;

  if (sound.type === "synth") {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      playSynth(ctx, gain, sound.id);
      setTimeout(() => ctx.close().catch(() => {}), 1200);
    } catch {
      /* ignore */
    }
    return;
  }

  if (sound.src) {
    const audio = new Audio(sound.src);
    audio.volume = 0.9;
    audio.play().catch(() => {});
  }
}
