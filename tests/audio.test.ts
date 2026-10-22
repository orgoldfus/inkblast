import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sound } from "../src/audio/sound";
import { DEFAULT_SETTINGS } from "../src/rules/settings";

function audioNode() {
  return {
    buffer: null as unknown,
    loop: false,
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    playbackRate: { value: 1, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
}

describe("generated game audio", () => {
  let sound: Sound;
  let sources: ReturnType<typeof audioNode>[];
  let gains: ReturnType<typeof audioNode>[];
  let context: {
    currentTime: number;
    state: string;
    destination: object;
    createGain: ReturnType<typeof vi.fn>;
    createBufferSource: ReturnType<typeof vi.fn>;
    createOscillator: ReturnType<typeof vi.fn>;
    decodeAudioData: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    sources = [];
    gains = [];
    context = {
      currentTime: 1,
      state: "running",
      destination: {},
      createGain: vi.fn(() => {
        const node = audioNode();
        gains.push(node);
        return node;
      }),
      createBufferSource: vi.fn(() => {
        const node = audioNode();
        sources.push(node);
        return node;
      }),
      createOscillator: vi.fn(audioNode),
      decodeAudioData: vi.fn(async () => ({ duration: 63.84 })),
    };
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return context;
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    sound = new Sound();
    sound.configure(DEFAULT_SETTINGS);
  });

  afterEach(() => {
    sound.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loops decoded music, mutes immediately, stops on pause and reuses the decoded asset", async () => {
    await sound.unlock();
    sound.start(0);
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    expect(sources[0].loop).toBe(true);
    expect(sources[0].start).toHaveBeenCalledOnce();
    sound.configure({ ...DEFAULT_SETTINGS, music: 0, effects: 0, voices: 0 });
    expect(gains.slice(0, 3).map((gain) => gain.gain.value)).toEqual([0, 0, 0]);
    sound.stop();
    expect(sources[0].stop).toHaveBeenCalledOnce();
    sound.configure(DEFAULT_SETTINGS);
    sound.start(0, true);
    await vi.waitFor(() => expect(sources).toHaveLength(2));
    expect(sources[1].playbackRate.value).toBe(1.12);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).includes("music/")),
    ).toHaveLength(1);
  });

  it("does not start a late music download after leaving the match", async () => {
    let complete!: (value: unknown) => void;
    context.decodeAudioData.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    sound.configure({ ...DEFAULT_SETTINGS, effects: 0 });
    await sound.unlock();
    sound.start(0);
    await vi.waitFor(() =>
      expect(context.decodeAudioData).toHaveBeenCalledOnce(),
    );
    sound.stop();
    complete({ duration: 64 });
    await vi.advanceTimersByTimeAsync(200);
    expect(sources).toHaveLength(0);
  });

  it("uses generated effects, caps chain reaction duplicates and speeds up on hurry", async () => {
    await sound.unlock();
    sound.start(0);
    await vi.waitFor(() =>
      expect(context.decodeAudioData).toHaveBeenCalledTimes(4),
    );
    sound.play([{ type: "explode" }, { type: "explode" }]);
    expect(sources.filter((source) => !source.loop)).toHaveLength(1);
    context.currentTime += 0.1;
    sound.play([{ type: "pickup" }, { type: "result" }, { type: "hurry" }]);
    expect(sources.filter((source) => !source.loop)).toHaveLength(3);
    expect(
      sources.find((source) => source.loop)!.playbackRate.setTargetAtTime,
    ).toHaveBeenCalledWith(1.12, 1.1, 0.3);
  });

  it("continues synthesized music when generated files are unavailable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Offline"));
    await sound.unlock();
    sound.start(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(context.createOscillator).toHaveBeenCalled();
    expect(context.createBufferSource).not.toHaveBeenCalled();
  });
});
