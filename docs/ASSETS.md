# Asset provenance

- `src/render/artwork.ts`: original procedural Canvas illustrations created for Inkblast. They become local Pixi textures at startup. No original Atomic Bomberman art is copied or loaded.
- `public/share/inkblast-v1.jpg`, `public/favicon.png`, and `public/apple-touch-icon.png`: share artwork and icons composed from the same original game textures and bundled Barlow font. Regenerate with `npm run render:share` (requires Playwright Chromium), or `CHROME_CHANNEL=chrome npm run render:share` to use installed Google Chrome. These committed static assets need no browser rendering at build time or when a link is shared. When changing the share image, use a new versioned filename and update the absolute social image URLs in `index.html` to help refresh image caches.
- `src/audio/sound.ts`: original synthesized music patterns, character chirps and sound effects, produced by Web Audio on the device. No audio downloads, speech service or third-party runtime is used.
- `public/fonts/barlow-condensed-latin-800-normal.woff2`: Barlow Condensed by Jeremy Tribby, distributed by Fontsource under the SIL Open Font License. The license is bundled at `public/fonts/OFL.txt`.
- `docs/reference/inkblast-concept.png`: user-supplied visual direction. This reference is not loaded by the game and is not used as a static arena background.

Eleven historical arena names and mechanic families are documented in the reference audit. Theme artwork and the twelve bundled duel schemes are Inkblast interpretations.
