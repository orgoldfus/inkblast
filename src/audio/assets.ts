export const MUSIC_FILE = "audio/music/fuse-funk.mp3";

export const EFFECT_FILES = {
  explode: "audio/effects/explode.mp3",
  pickup: "audio/effects/pickup.mp3",
  result: "audio/effects/result.mp3",
} as const;

export type SampleEffect = keyof typeof EFFECT_FILES;
