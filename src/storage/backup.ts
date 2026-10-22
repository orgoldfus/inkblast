import { validateScheme } from "../content/schemes";
import {
  loadMaps,
  loadProgress,
  loadSettings,
  normalizeProgress,
  normalizeSettings,
  saveMap,
  saveProgress,
  saveSettings,
} from "./storage";

export async function exportBackup(): Promise<string> {
  const [settings, maps, progress] = await Promise.all([
    loadSettings(),
    loadMaps(),
    loadProgress(),
  ]);
  return JSON.stringify(
    { format: "inkblast-backup", version: 1, settings, maps, progress },
    null,
    2,
  );
}

export async function importBackup(text: string): Promise<number> {
  if (text.length > 2_000_000)
    throw new Error("This backup is too large. The limit is 2 MB.");
  const data = JSON.parse(text);
  if (
    !data ||
    data.format !== "inkblast-backup" ||
    data.version !== 1 ||
    !Array.isArray(data.maps) ||
    data.maps.length > 200
  )
    throw new Error(
      "Choose an Inkblast version 1 backup with at most 200 maps.",
    );
  const maps = data.maps.map((map: unknown) => {
    const checked = validateScheme(map);
    if (!checked.scheme)
      throw new Error(
        `A map in this backup is invalid: ${checked.errors.join(" ")}`,
      );
    return checked.scheme;
  });
  await saveSettings(normalizeSettings(data.settings));
  await saveProgress(normalizeProgress(data.progress));
  for (const map of maps) await saveMap(map);
  return maps.length;
}
