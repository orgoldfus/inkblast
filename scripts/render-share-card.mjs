import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  server: { host: "127.0.0.1", port: 0 },
});
let browser;

try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL });
  const page = await browser.newPage();
  await page.route("**/__share-card", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body></body></html>",
    }),
  );
  await page.goto(`${server.resolvedUrls.local[0]}__share-card`);
  const assets = await page.evaluate(async () => {
    const [{ createArenaArt }, { THEMES }] = await Promise.all([
      import("/src/render/artwork.ts"),
      import("/src/content/catalog.ts"),
    ]);
    const font = new FontFace(
      "Barlow",
      'url("/fonts/barlow-condensed-latin-800-normal.woff2")',
      { weight: "800" },
    );
    document.fonts.add(await font.load());
    const art = createArenaArt(THEMES[0]);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    const ink = "#0b1c29";
    const cream = "#fff0ce";
    const orange = "#ffae38";

    function polygon(points, color) {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    function burst(x, y, radius, color) {
      const points = Array.from({ length: 32 }, (_, i) => {
        const angle = (i * Math.PI) / 16;
        const r = radius * (i % 2 ? 0.68 : 1 + (i % 3) * 0.06);
        return [x + Math.cos(angle) * r, y + Math.sin(angle) * r];
      });
      polygon(points, color);
    }

    function sprite(texture, x, y, width, rotation = 0) {
      const source = texture.source.resource;
      const height = (width * source.height) / source.width;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(source, -width / 2, -height / 2, width, height);
      ctx.restore();
    }

    function label(text, x, y, size, color) {
      ctx.font = `800 ${size}px Barlow`;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    }

    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, 1200, 630);
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.translate(940, 310);
    ctx.rotate(-0.16);
    for (let row = -4; row <= 4; row++) {
      for (let col = -4; col <= 4; col++) {
        sprite(art.floors[(row + col + 8) % 4], col * 85, row * 85, 82);
      }
    }
    ctx.restore();
    const shade = ctx.createLinearGradient(480, 0, 780, 0);
    shade.addColorStop(0, ink);
    shade.addColorStop(1, "#0b1c2900");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 780, 630);

    burst(942, 304, 269, "#071722");
    burst(942, 304, 249, "#f45a32");
    burst(942, 304, 215, orange);
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let y = 130; y < 490; y += 14) {
      for (let x = 760; x < 1130; x += 14) {
        if (Math.hypot(x - 942, y - 304) > 166) continue;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
      }
    }
    ctx.restore();
    sprite(art.bombs[0], 942, 280, 325, 0.18);
    sprite(art.spark, 1014, 147, 85, 0.2);
    sprite(art.players[0][3][1], 773, 417, 230, -0.16);
    sprite(art.players[1][2][3], 1082, 420, 230, 0.14);
    sprite(art.debris, 700, 182, 39, -0.4);
    sprite(art.debris, 1145, 109, 30, 0.6);
    sprite(art.spark, 1156, 525, 50, -0.2);

    label("THE COMIC ARENA BRAWLER", 62, 79, 24, orange);
    ctx.save();
    ctx.translate(60, 242);
    ctx.transform(1, -0.035, -0.09, 1, 0, 0);
    ctx.font = "800 146px Barlow";
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#071722";
    ctx.strokeText("INKBLAST", 4, 7);
    ctx.fillStyle = cream;
    ctx.fillText("INKBLAST", 0, 0);
    polygon(
      [
        [-4, 17],
        [516, 4],
        [513, 13],
        [-4, 24],
      ],
      orange,
    );
    ctx.restore();
    label("SMALL ARENA.", 62, 366, 76, cream);
    label("BIG TROUBLE.", 62, 443, 76, orange);
    label("Light the fuse. Outsmart your rival.", 65, 494, 29, cream);

    ctx.fillStyle = cream;
    ctx.fillRect(0, 558, 1200, 72);
    label("PLAY IN YOUR BROWSER", 62, 604, 28, ink);
    label("NO DOWNLOADS. NO ACCOUNTS.", 728, 604, 26, ink);
    polygon(
      [
        [359, 581],
        [375, 590],
        [359, 599],
      ],
      ink,
    );
    const results = [
      {
        name: "share/inkblast-v1.jpg",
        data: canvas.toDataURL("image/jpeg", 0.92),
      },
    ];

    for (const [name, size] of [
      ["favicon.png", 64],
      ["apple-touch-icon.png", 180],
    ]) {
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = orange;
      ctx.fillRect(0, 0, size, size);
      sprite(art.bombs[0], size * 0.5, size * 0.45, size * 1.02, 0.1);
      sprite(art.spark, size * 0.7, size * 0.13, size * 0.24);
      results.push({ name, data: canvas.toDataURL("image/png") });
    }
    art.destroy();
    return results;
  });
  for (const { name, data } of assets) {
    const destination = path.join(root, "public", name);
    await mkdir(path.dirname(destination), { recursive: true });
    const buffer = Buffer.from(data.split(",")[1], "base64");
    await writeFile(destination, buffer);
    console.log(`${name}: ${Math.round(buffer.length / 1024)} KB`);
  }
} finally {
  await browser?.close();
  await server.close();
}
