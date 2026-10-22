# Asset provenance

- `src/render/artwork.ts`: original procedural Canvas illustrations created for Inkblast. They become local Pixi textures at startup. No original Atomic Bomberman art is copied or loaded.
- `src/audio/sound.ts`: original synthesized music patterns, character chirps and sound effects, produced by Web Audio on the device. No audio downloads, speech service or third-party runtime is used.
- `public/fonts/barlow-condensed-latin-800-normal.woff2`: Barlow Condensed by Jeremy Tribby, distributed by Fontsource under the SIL Open Font License. The license is bundled at `public/fonts/OFL.txt`.
- `docs/reference/inkblast-concept.png`: user-supplied visual direction. This reference is not loaded by the game and is not used as a static arena background.

Eleven historical arena names and mechanic families are documented in the reference audit. Theme artwork and the twelve bundled duel schemes are Inkblast interpretations.
