import sound1 from "@/assets/sounds/sound1.mp3";
import sound2 from "@/assets/sounds/sound2.mp3";
import sound3 from "@/assets/sounds/sound3.mp3";
import sound4 from "@/assets/sounds/sound4.mp3";
import sound5 from "@/assets/sounds/sound5.mp3";
import sound6 from "@/assets/sounds/sound6.mp3";
import sound7 from "@/assets/sounds/sound7.mp3";
import sound8 from "@/assets/sounds/sound8.mp3";
import sound9 from "@/assets/sounds/sound9.mp3";

export const NOTIFICATION_SOUND_STORAGE_KEY = "stage_notification_sound";

export const NOTIFICATION_SOUNDS = [
  { id: "sound1", label: "Sound 1", src: sound1 },
  { id: "sound2", label: "Sound 2", src: sound2 },
  { id: "sound3", label: "Sound 3", src: sound3 },
  { id: "sound4", label: "Sound 4", src: sound4 },
  { id: "sound5", label: "Sound 5", src: sound5 },
  { id: "sound6", label: "Sound 6", src: sound6 },
  { id: "sound7", label: "Sound 7", src: sound7 },
  { id: "sound8", label: "Sound 8", src: sound8 },
  { id: "sound9", label: "Sound 9", src: sound9 },
];

export function getSelectedNotificationSoundId() {
  return localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY) || "sound1";
}

export function playNotificationSound(soundId = getSelectedNotificationSoundId()) {
  const sound = NOTIFICATION_SOUNDS.find((s) => s.id === soundId) || NOTIFICATION_SOUNDS[0];
  if (!sound) return;
  const audio = new Audio(sound.src);
  audio.volume = 0.7;
  audio.play().catch(() => {});
}

