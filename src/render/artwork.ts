import { Texture } from "pixi.js";
import type { Direction, ItemType, Theme } from "../core/types";

export const TILE = 80;
const INK = "#071722";
const CREAM = "#fff0c8";
type Painter = (ctx: CanvasRenderingContext2D) => void;
export interface ArenaArt {
  floors: Texture[];
  walls: Texture[];
  perimeter: Texture[];
  bricks: Texture[];
  players: Texture[][][];
  bombs: Texture[];
  flames: Texture[];
  pickups: Map<ItemType, Texture>;
  spark: Texture;
  debris: Texture;
  shadow: Texture;
  hazard: Texture;
  destroy(): void;
}

const hex = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;
function tint(color: number, amount: number): string {
  const c = [color >> 16, (color >> 8) & 255, color & 255];
  return `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v + amount)))).join(",")})`;
}
function path(
  ctx: CanvasRenderingContext2D,
  points: number[],
  fill: string,
  stroke = INK,
  width = 3,
): void {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2)
    ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (width > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke = INK,
  width = 3,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (width > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
function line(
  ctx: CanvasRenderingContext2D,
  points: number[],
  color: string,
  width = 2,
): void {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2)
    ctx.lineTo(points[i], points[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outer: number,
  inner: number,
  fill: string,
  count = 8,
  rotation = 0,
  strokeWidth = 1.5,
): void {
  const points: number[] = [];
  for (let i = 0; i < count * 2; i++) {
    const angle = (i * Math.PI) / count + rotation;
    const radius = i % 2 ? inner : outer;
    points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  path(ctx, points, fill, INK, strokeWidth);
}
function texture(width: number, height: number, paint: Painter): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas drawing is unavailable.");
  ctx.scale(2, 2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  paint(ctx);
  return Texture.from(canvas);
}
function grain(
  ctx: CanvasRenderingContext2D,
  seed: number,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
): void {
  let n = seed >>> 0;
  const random = (): number => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const px = x + random() * w,
      py = y + random() * h;
    ctx.fillStyle = i % 3 ? "rgba(5,18,27,.11)" : "rgba(255,244,210,.13)";
    ctx.fillRect(px, py, random() * 1.6 + 0.4, random() * 1.5 + 0.4);
  }
}

function floorMotif(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  variant: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.48;
  switch (theme.id) {
    case "green":
    case "forest": {
      for (const [x, y] of [
        [12, 58],
        [60, 24],
        [49, 68],
      ]) {
        line(
          ctx,
          [x - 4, y, x - 7, y - 7, x, y - 3, x + 3, y - 11, x + 5, y],
          tint(theme.accent, -28),
          1.5,
        );
      }
      if (theme.id === "forest") {
        ctx.save();
        ctx.translate(55, 55);
        ctx.rotate(variant * 0.8);
        path(
          ctx,
          [-9, 0, -4, -5, 7, -6, 10, 0, 4, 5, -6, 4],
          tint(theme.accent, -6),
          INK,
          0.7,
        );
        line(ctx, [-8, 0, 8, 0], INK, 0.7);
        ctx.restore();
      }
      break;
    }
    case "hockey": {
      for (let i = 0; i < 5; i++)
        line(ctx, [7 + i * 8, 15, 19 + i * 8, 44], "#daf6ef", 1);
      line(ctx, [44, 51, 60, 32, 72, 30], "#c4e9eb", 1.4);
      if (variant === 0) {
        line(ctx, [0, 40, 80, 40], "#ce5b64", 6);
        line(ctx, [0, 39, 80, 39], "#f9b1af", 1);
      } else {
        ellipse(ctx, 61, 62, 7, 5, "rgba(190,238,239,.12)", "#c9edf0", 1);
      }
      break;
    }
    case "egypt": {
      line(ctx, [0, 32, 19, 32, 22, 35, 80, 35], tint(theme.floor, -27), 2);
      line(ctx, [22, 0, 22, 33, 57, 35, 57, 79], tint(theme.floor, -27), 1.3);
      if (variant === 1) {
        path(ctx, [39, 48, 48, 61, 30, 61], tint(theme.accent, 0), INK, 1);
        line(ctx, [39, 46, 39, 63], INK, 1);
        line(ctx, [29, 65, 49, 65], INK, 1);
      }
      break;
    }
    case "mine": {
      for (let i = 0; i < 3; i++)
        path(
          ctx,
          [
            13 + i * 19,
            43 + i * 7,
            19 + i * 19,
            37 + i * 7,
            27 + i * 19,
            43 + i * 7,
            24 + i * 19,
            50 + i * 7,
            16 + i * 19,
            49 + i * 7,
          ],
          tint(theme.floor, -30),
          INK,
          1,
        );
      if (variant === 0) {
        line(ctx, [6, 12, 68, 27], "#a69676", 3);
        line(ctx, [7, 18, 68, 33], "#252a30", 2);
        for (let i = 0; i < 5; i++)
          line(
            ctx,
            [17 + i * 11, 11 + i * 3, 15 + i * 11, 23 + i * 3],
            "#454550",
            2,
          );
      }
      break;
    }
    case "beach": {
      for (let y = 18; y < 76; y += 19) {
        ctx.beginPath();
        ctx.moveTo(6, y);
        ctx.bezierCurveTo(20, y - 6, 40, y + 7, 72, y - 2);
        ctx.strokeStyle = "#e4c690";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (variant === 2) {
        path(
          ctx,
          [49, 60, 41, 47, 45, 39, 55, 36, 65, 43, 64, 52, 55, 61],
          "#e5c1a0",
          "#715b3f",
          1.2,
        );
        for (let i = 0; i < 4; i++)
          line(ctx, [52, 58, 44 + i * 6, 42], "#a27960", 1);
      }
      break;
    }
    case "aliens": {
      path(
        ctx,
        [17, 13, 62, 13, 72, 26, 72, 56, 60, 69, 20, 69, 8, 56, 8, 26],
        "rgba(7,15,29,.1)",
        "#8682a0",
        1.5,
      );
      line(ctx, [15, 29, 15, 50, 22, 58], tint(theme.accent, -20), 2);
      for (let i = 0; i < 3; i++)
        ellipse(ctx, 57 + i * 4, 23, 1, 1, hex(theme.accent), INK, 0);
      break;
    }
    case "haunted": {
      for (let x = 9; x < 80; x += 24) {
        line(ctx, [x, 1, x + 2, 39, x - 1, 79], "#222630", 2);
        line(ctx, [x + 4, 2, x + 6, 31, x + 3, 60], "#8a8580", 1);
        ellipse(ctx, x + 8, 12, 1, 1, INK, INK, 0);
      }
      if (variant === 2) {
        for (let i = 0; i < 3; i++)
          line(ctx, [3, 3, 10 + i * 9, 34 - i * 8], "#a7b2ad", 0.7);
        line(ctx, [7, 20, 20, 16, 14, 6], "#a7b2ad", 0.7);
      }
      break;
    }
    case "ocean": {
      for (const [x, y, r] of [
        [17, 22, 4],
        [62, 49, 3],
        [58, 14, 2],
      ])
        ellipse(ctx, x, y, r, r, "rgba(100,211,212,.05)", "#98d9ce", 1);
      line(ctx, [10, 67, 13, 53, 10, 47, 17, 36], "#77bda0", 2);
      line(ctx, [13, 57, 21, 49, 22, 42], "#77bda0", 1.5);
      ctx.beginPath();
      ctx.moveTo(26, 69);
      ctx.bezierCurveTo(39, 61, 54, 76, 74, 66);
      ctx.strokeStyle = "#6ba3ae";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case "city": {
      if (variant === 1) {
        ellipse(ctx, 40, 42, 23, 21, "#44464b", "#8e8c87", 2);
        for (let i = 0; i < 6; i++)
          line(ctx, [24, 29 + i * 5, 56, 29 + i * 5], "#262b34", 2);
        line(ctx, [32, 23, 32, 61], "#262b34", 2);
        line(ctx, [48, 23, 48, 61], "#262b34", 2);
      } else if (variant === 2) {
        path(ctx, [44, 42, 64, 39, 68, 55, 47, 60], "#b5b29c", INK, 0.6);
        line(ctx, [49, 46, 61, 44], "#686a66", 1);
        line(ctx, [50, 50, 63, 48], "#686a66", 1);
      } else {
        line(ctx, [11, 64, 20, 55, 18, 48], "#303038", 2);
      }
      break;
    }
  }
  ctx.restore();
}

function makeFloor(theme: Theme, variant: number): Texture {
  return texture(80, 80, (ctx) => {
    const base = variant % 2 ? theme.floor : theme.floorAlt;
    const gradient = ctx.createLinearGradient(0, 0, 80, 90);
    gradient.addColorStop(0, tint(base, 32));
    gradient.addColorStop(1, tint(base, 11));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 80, 80);
    line(ctx, [0, 79, 79, 79, 79, 0], "#112631", 2);
    line(ctx, [1, 77, 1, 1, 77, 1], tint(base, 27), 1);
    grain(ctx, variant * 91 + 7, 3, 4, 74, 72, 150);
    line(
      ctx,
      [12 + variant * 5, 22, 17 + variant * 5, 17],
      "rgba(232,238,222,.12)",
      1,
    );
    if (variant === 2)
      line(ctx, [54, 52, 49, 59, 53, 63, 51, 69], "rgba(10,25,35,.3)", 1);
    for (let i = 0; i < 5; i++)
      line(ctx, [6 + i * 3, 68, 13 + i * 3, 60], "rgba(9,25,35,.09)", 1);
    floorMotif(ctx, theme, variant);
  });
}
function makeWall(theme: Theme, variant: number): Texture {
  return texture(88, 104, (ctx) => {
    ellipse(ctx, 46, 90, 37, 10, "rgba(1,10,18,.3)", INK, 0);
    path(
      ctx,
      [7, 20, 75, 19, 82, 28, 80, 88, 13, 88, 6, 77],
      tint(theme.wall, -42),
    );
    path(ctx, [9, 66, 78, 65, 78, 85, 15, 85], tint(theme.wall, -31), INK, 2);
    const grad = ctx.createLinearGradient(10, 20, 78, 73);
    grad.addColorStop(0, tint(theme.wall, 76));
    grad.addColorStop(1, tint(theme.wall, 29));
    ctx.beginPath();
    ctx.moveTo(9, 20);
    ctx.lineTo(76, 20);
    ctx.lineTo(78, 68);
    ctx.lineTo(10, 69);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    line(ctx, [13, 63, 13, 24, 71, 24], "#bec8bc", 1.3);
    line(ctx, [17, 67, 75, 67, 75, 27], tint(theme.wall, -26), 2);
    grain(ctx, variant + 31, 14, 27, 58, 36, 120);
    line(ctx, [17, 28, 28, 39, 26, 43, 41, 57], "rgba(8,22,30,.5)", 1);
    line(ctx, [57, 28, 55, 32, 64, 41], "rgba(8,22,30,.5)", 1);
    for (const [x, y] of [
      [15, 26],
      [71, 26],
      [15, 62],
      [71, 62],
    ]) {
      ellipse(ctx, x, y, 1.6, 1.6, "#d0d4bf", INK, 1);
    }
    line(ctx, [17, 73, 20, 80, 20, 84], tint(theme.wall, -49), 1);
    for (let i = 0; i < 8; i++)
      line(ctx, [48 + i * 3, 83, 52 + i * 3, 75], "rgba(5,18,27,.27)", 0.8);
    if (variant === 2)
      line(ctx, [43, 21, 39, 30, 45, 34, 40, 42], "#122b37", 1.3);
  });
}
function makeBrick(theme: Theme, variant: number): Texture {
  return texture(88, 104, (ctx) => {
    ellipse(ctx, 45, 90, 37, 9, "rgba(1,10,18,.32)", INK, 0);
    path(
      ctx,
      [8, 20, 77, 19, 81, 85, 74, 91, 12, 88, 7, 77],
      tint(theme.brick, -60),
    );
    path(ctx, [8, 21, 76, 20, 77, 72, 10, 73], tint(theme.brick, -20));
    for (let row = 0; row < 3; row++) {
      const edges = row % 2 ? [9, 28, 61, 77] : [9, 43 + variant * 2, 77];
      for (let j = 0; j < edges.length - 1; j++) {
        const x = edges[j],
          right = edges[j + 1],
          y = 21 + row * 17;
        path(
          ctx,
          [x + 1, y, right - 1, y + 0.5, right - 1.5, y + 16, x + 1, y + 16],
          tint(theme.brick, 24 - row * 12 + (j % 2) * 5),
          INK,
          1.5,
        );
        line(ctx, [x + 3, y + 3, right - 3, y + 3], tint(theme.brick, 57), 1);
      }
    }
    path(ctx, [10, 74, 76, 73, 75, 88, 13, 87], tint(theme.brick, -48), INK, 2);
    line(ctx, [32, 75, 33, 86], tint(theme.brick, -80), 1.5);
    line(ctx, [65, 75, 62, 85], tint(theme.brick, -80), 1.5);
    grain(ctx, 51 + variant * 11, 12, 23, 61, 63, 90);
    line(ctx, [12, 64, 18, 64, 19, 69], "#562c1d", 1);
    if (variant > 0) line(ctx, [57, 37, 54, 44, 58, 49], "#74421f", 1.2);
    obstacleMotif(ctx, theme, variant);
  });
}

function obstacleMotif(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  variant: number,
): void {
  switch (theme.id) {
    case "green":
    case "forest":
    case "beach":
      path(
        ctx,
        [10, 22, 76, 21, 77, 73, 11, 73],
        tint(theme.brick, -4),
        INK,
        2,
      );
      for (let x = 24; x < 76; x += 17) {
        line(ctx, [x, 24, x, 71], tint(theme.brick, -42), 1.4);
        line(
          ctx,
          [x + 4, 27, x + 6, 42, x + 3, 59],
          tint(theme.brick, 22),
          0.8,
        );
      }
      path(
        ctx,
        [12, 23, 20, 23, 75, 65, 75, 72, 67, 72, 12, 31],
        tint(theme.brick, 29),
        INK,
        1.5,
      );
      path(
        ctx,
        [67, 23, 76, 23, 76, 30, 20, 72, 12, 72, 12, 65],
        tint(theme.brick, 18),
        INK,
        1.5,
      );
      for (const [x, y] of [
        [17, 28],
        [70, 28],
        [17, 67],
        [70, 67],
      ])
        ellipse(ctx, x, y, 1.6, 1.6, INK, INK, 0);
      if (theme.id === "forest") {
        path(
          ctx,
          [
            13, 61, 21, 58, 18, 51, 25, 53, 30, 48, 34, 57, 40, 61, 32, 66, 20,
            65,
          ],
          "#78904e",
          INK,
          1,
        );
      }
      if (theme.id === "beach") {
        line(ctx, [39, 29, 39, 47, 49, 47], "#efddaa", 2);
        ellipse(ctx, 39, 29, 3, 3, "#efddaa", INK, 1);
      }
      break;
    case "hockey":
      path(
        ctx,
        [12, 23, 74, 22, 75, 71, 12, 72],
        "rgba(214,251,253,.32)",
        "#bdf3ee",
        2,
      );
      line(ctx, [45, 23, 39, 36, 46, 45, 33, 58, 37, 71], "#e4ffed", 2);
      line(ctx, [46, 45, 62, 40, 69, 48], "#d2f5f0", 1.5);
      line(ctx, [15, 27, 34, 25], "#f3ffe9", 3);
      break;
    case "egypt":
      path(
        ctx,
        [33, 29, 55, 29, 55, 64, 33, 64],
        tint(theme.brick, 10),
        INK,
        1,
      );
      ellipse(ctx, 44, 37, 5, 3, "rgba(0,0,0,0)", "#6f552d", 1.5);
      line(ctx, [44, 40, 44, 56, 37, 50, 44, 56, 51, 50], "#6f552d", 1.8);
      line(ctx, [38, 61, 50, 61], "#6f552d", 1.5);
      break;
    case "mine":
      for (let i = 0; i < 3; i++)
        path(
          ctx,
          [
            17 + i * 17,
            34,
            23 + i * 17,
            28,
            30 + i * 17,
            36,
            27 + i * 17,
            51,
            19 + i * 17,
            49,
          ],
          "#353247",
          INK,
          2,
        );
      line(ctx, [13, 58, 74, 58], "#b09a72", 5);
      line(ctx, [13, 56, 74, 56], "#d4bd89", 1);
      break;
    case "aliens":
      path(
        ctx,
        [15, 26, 68, 26, 73, 33, 73, 62, 65, 69, 18, 69, 12, 62, 12, 34],
        "#574a78",
        INK,
        2,
      );
      ellipse(ctx, 44, 47, 17, 16, "#98b44f", INK, 3);
      ellipse(ctx, 42, 44, 10, 11, "#c1d76b", INK, 1);
      line(ctx, [18, 35, 18, 58], "#9987b6", 2);
      line(ctx, [67, 35, 67, 58], "#9987b6", 2);
      break;
    case "haunted":
      path(
        ctx,
        [29, 28, 25, 35, 29, 44, 25, 52, 34, 61, 31, 71],
        "#292737",
        INK,
        1.5,
      );
      ellipse(ctx, 54, 44, 10, 11, "#595666", INK, 2);
      ellipse(ctx, 50, 42, 2, 3, "#c8cfb4", INK, 0);
      ellipse(ctx, 58, 42, 2, 3, "#c8cfb4", INK, 0);
      line(ctx, [51, 51, 57, 51], "#d2cfb1", 2);
      break;
    case "ocean":
      line(ctx, [23, 69, 24, 48, 18, 40, 18, 32], "#e7a187", 4);
      line(ctx, [24, 53, 32, 45, 34, 35], "#e7a187", 3);
      line(ctx, [59, 65, 63, 53, 58, 44, 61, 31], "#8ec5b1", 3);
      ellipse(ctx, 45, 54, 7, 6, "#d5a28d", INK, 1);
      ellipse(ctx, 45, 54, 3, 2, "#794e51", INK, 0);
      break;
    case "city":
      path(ctx, [16, 29, 68, 27, 70, 62, 18, 65], "#997c58", INK, 2);
      line(ctx, [42, 29, 43, 63], "#d3b77b", 5);
      path(ctx, [24, 40, 35, 39, 36, 51, 25, 52], "#d5caa8", INK, 0.8);
      line(ctx, [26, 43, 33, 43], "#4e4940", 0.8);
      line(ctx, [56, 36, 64, 38, 60, 53, 52, 51, 56, 36], "#484b41", 1.3);
      break;
    default:
      if (variant === 1) line(ctx, [58, 39, 61, 46, 55, 54], "#754426", 1);
  }
}

function makePerimeter(theme: Theme, variant: number): Texture {
  return texture(88, 104, (ctx) => {
    path(ctx, [1, 13, 86, 13, 86, 91, 2, 91], tint(theme.wall, -14), INK, 3);
    path(ctx, [3, 14, 84, 14, 84, 68, 3, 68], tint(theme.wall, 62), INK, 2);
    path(ctx, [3, 69, 84, 69, 82, 88, 6, 88], tint(theme.wall, 4), INK, 2);
    line(ctx, [6, 65, 6, 18, 80, 18], "#c3c7b5", 1.3);
    if (variant === 0) {
      path(ctx, [8, 23, 79, 23, 79, 36, 8, 36], tint(theme.brick, 14), INK, 2);
      for (let x = 13; x < 74; x += 18)
        line(ctx, [x, 35, x + 5, 25], "#493722", 3);
      line(ctx, [14, 48, 71, 48], INK, 5);
      line(ctx, [14, 46, 71, 46], tint(theme.wall, 24), 2);
    } else if (variant === 1) {
      path(
        ctx,
        [10, 23, 29, 23, 29, 58, 10, 58],
        tint(theme.brick, 14),
        INK,
        2,
      );
      for (let y = 29; y < 57; y += 8)
        line(ctx, [12, y, 26, y - 3], "#493722", 3);
      for (let y = 28; y < 59; y += 6) line(ctx, [44, y, 71, y], "#122b38", 2);
    } else {
      path(
        ctx,
        [14, 23, 70, 23, 73, 49, 59, 61, 14, 60],
        tint(theme.wall, 77),
        INK,
        3,
      );
      ellipse(ctx, 42, 42, 11, 10, "#d4d6b9", INK, 2);
      ellipse(ctx, 42, 42, 6, 5, tint(theme.brick, 21), INK, 2);
      line(ctx, [40, 44, 45, 40], INK, 2);
    }
    for (const x of [9, 78]) {
      ellipse(ctx, x, 20, 2.2, 2.2, "#dfdfbc", INK, 1);
      ellipse(ctx, x, 62, 2.2, 2.2, "#dfdfbc", INK, 1);
    }
    grain(ctx, variant + 176, 8, 19, 72, 46, 100);
    for (let i = 0; i < 8; i++)
      line(ctx, [35 + i * 5, 84, 41 + i * 5, 73], "rgba(5,15,23,.32)", 1);
  });
}

const WALK_FRAMES = 8;

function makePlayer(id: number, direction: Direction, frame: number): Texture {
  const color = id ? "#1688f2" : "#f23f35";
  const dark = id ? "#095497" : "#a51f25";
  const light = id ? "#89d6ff" : "#ff9d76";
  return texture(96, 120, (ctx) => {
    const stride = Math.sin((frame / WALK_FRAMES) * Math.PI * 2) * 5;
    ctx.save();
    ctx.translate(0, -Math.abs(stride) * 0.36);
    line(ctx, [36, 82, 31 - stride, 101], INK, 11);
    line(ctx, [59, 82, 65 + stride, 101], INK, 11);
    ellipse(ctx, 31 - stride, 103, 8, 5, dark);
    ellipse(ctx, 65 + stride, 103, 8, 5, dark);
    line(ctx, [32, 103, 36, 103], light, 2);
    line(ctx, [62, 103, 66, 103], light, 2);
    ellipse(ctx, 47, 76, 17, 16, dark, INK, 3.5);
    path(ctx, [34, 73, 61, 73, 59, 85, 36, 85], color, INK, 2.5);
    ellipse(ctx, 27, 78 + stride * 0.45, 7, 8, color);
    ellipse(ctx, 69, 78 - stride * 0.45, 7, 8, color);
    line(ctx, [27, 73 + stride * 0.45, 26, 77 + stride * 0.45], light, 2);
    line(ctx, [43, 22, 42, 14, 45, 9], INK, 5);
    ellipse(ctx, 45, 11, 7, 6, color, INK, 2.5);
    ellipse(ctx, 43, 9, 2, 1.5, light, INK, 0);
    const head = ctx.createRadialGradient(34, 35, 3, 51, 49, 38);
    head.addColorStop(0, light);
    head.addColorStop(0.38, color);
    head.addColorStop(1, dark);
    ctx.beginPath();
    ctx.ellipse(48, 50, 29, 28, -0.06, 0, Math.PI * 2);
    ctx.fillStyle = head;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke();
    line(ctx, [25, 40, 28, 34, 34, 30], light, 3);
    ellipse(ctx, 57, 29, 4, 2.3, "#fff4ce", INK, 0);
    if (direction === "up") {
      line(ctx, [39, 34, 39, 58, 45, 65, 58, 65], dark, 2);
      path(ctx, [34, 56, 62, 56, 61, 66, 36, 66], color, INK, 2);
      for (let i = 0; i < 3; i++)
        line(ctx, [41 + i * 6, 60, 42 + i * 6, 63], INK, 1.5);
    } else {
      const shift = direction === "left" ? -5 : direction === "right" ? 5 : 0;
      ctx.beginPath();
      ctx.roundRect(27 + shift, 42, 43, 27, 10);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(30 + shift, 44, 37, 22, 7);
      ctx.fillStyle = CREAM;
      ctx.fill();
      const eyeShift =
        direction === "left" ? -2 : direction === "right" ? 2 : 0;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(38 + shift + eyeShift, 48, 4.2, 14, 2);
      ctx.roundRect(53 + shift + eyeShift, 47, 4.2, 14, 2);
      ctx.fill();
      line(ctx, [31 + shift, 47, 34 + shift, 46], "#fffce5", 1.7);
    }
    ellipse(ctx, 48, 82, 3.4, 3, "#fff0b0", INK, 1.3);
    ctx.restore();
    ellipse(ctx, 71, 18, 10, 11, id ? "#148ffb" : "#f64435", INK, 3);
    ctx.font = "900 15px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = CREAM;
    ctx.fillText(String(id + 1), 71, 18.6);
  });
}
function drawBomb(ctx: CanvasRenderingContext2D, kind: number): void {
  const fill = kind === 2 ? "#7456c4" : "#102c40";
  ellipse(ctx, 44, 67, 29, 28, INK, INK, 3);
  const grad = ctx.createRadialGradient(33, 48, 0, 50, 65, 33);
  grad.addColorStop(0, kind === 2 ? "#ac89e4" : "#365568");
  grad.addColorStop(0.5, fill);
  grad.addColorStop(1, "#04111e");
  ctx.beginPath();
  ctx.ellipse(44, 64, 27, 27, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  line(ctx, [24, 71, 29, 81, 43, 86, 57, 83], "#243f50", 1.5);
  ellipse(ctx, 31, 48, 5.5, 8, CREAM, INK, 0);
  path(ctx, [43, 38, 45, 29, 53, 31, 51, 40], "#344d5a", INK, 2);
  line(ctx, [48, 30, 49, 21, 54, 16, 55, 11], "#fff0b6", 3);
  if (kind === 1) {
    ellipse(ctx, 45, 66, 8, 8, "#f54135", INK, 2);
    line(ctx, [45, 61, 45, 69], CREAM, 2);
  }
  if (kind === 2) {
    line(ctx, [43, 60, 40, 68, 49, 68, 46, 75], CREAM, 3);
  }
}
function makeFlame(mask: number): Texture {
  return texture(80, 80, (ctx) => {
    for (const [color, width] of [
      ["#ff7225", 35],
      ["#ffc52e", 27],
      ["#fff59b", 14],
    ] as const) {
      const arm = (rotation: number): void => {
        ctx.save();
        ctx.translate(40, 40);
        ctx.rotate(rotation);
        const w = width;
        path(
          ctx,
          [
            -w * 0.6,
            8,
            -w * 0.75,
            -7,
            -w * 0.55,
            -12,
            -w * 0.84,
            -20,
            -w * 0.58,
            -22,
            -w * 0.7,
            -31,
            -w * 0.58,
            -40,
            w * 0.58,
            -40,
            w * 0.78,
            -32,
            w * 0.5,
            -27,
            w * 0.79,
            -23,
            w * 0.52,
            -16,
            w * 0.71,
            -8,
            w * 0.56,
            6,
          ],
          color,
          color,
          0,
        );
        ctx.restore();
      };
      if (mask & 1) arm(0);
      if (mask & 2) arm(Math.PI / 2);
      if (mask & 4) arm(Math.PI);
      if (mask & 8) arm(-Math.PI / 2);
      star(ctx, 40, 40, width * 0.94, width * 0.64, color, 9, 0.2, 0);
    }
  });
}
function itemGlyph(ctx: CanvasRenderingContext2D, type: ItemType): void {
  ctx.save();
  ctx.translate(40, 40);
  if (type === "flame" || type === "goldflame") {
    path(
      ctx,
      [
        -16, 10, -14, -4, -7, 1, -3, -19, 5, -8, 10, -13, 18, 5, 13, 18, -1, 22,
        -13, 17,
      ],
      type === "goldflame" ? "#ffc42f" : "#ff7630",
      INK,
      3,
    );
    path(
      ctx,
      [-7, 12, -3, 0, 3, 7, 7, 0, 10, 13, 3, 19, -4, 18],
      "#fff090",
      "#fff090",
      0,
    );
  } else if (type === "bomb" || type === "trigger" || type === "jelly") {
    ctx.scale(0.64, 0.64);
    ctx.translate(-44, -65);
    drawBomb(ctx, type === "jelly" ? 2 : type === "trigger" ? 1 : 0);
  } else if (type === "skate" || type === "kick") {
    path(
      ctx,
      [-16, 7, -4, 2, 0, -15, 13, -14, 17, -2, 10, 17, -16, 16, -21, 12],
      "#278ad5",
      INK,
      3,
    );
    line(ctx, [-15, 13, 9, 13, 15, 5], CREAM, 3);
    for (let i = 0; i < 3; i++)
      line(ctx, [2, -8 + i * 5, 10, -5 + i * 5], CREAM, 2);
    if (type === "skate") {
      ellipse(ctx, -10, 21, 4, 4, "#f4bd38", INK, 2);
      ellipse(ctx, 9, 21, 4, 4, "#f4bd38", INK, 2);
    }
  } else if (type === "punch" || type === "grab") {
    path(
      ctx,
      [
        -15, 8, -20, -2, -17, -10, -10, -11, -5, -19, 6, -20, 17, -14, 20, -2,
        11, 11, -1, 16,
      ],
      type === "punch" ? "#f74537" : "#3899e8",
      INK,
      3,
    );
    line(ctx, [-10, -10, -8, -1, -4, 1], "#ffe8a5", 2);
    path(ctx, [-8, 12, 11, 11, 12, 20, -8, 20], CREAM, INK, 2);
  } else if (type === "disease" || type === "superDisease") {
    ellipse(
      ctx,
      0,
      -2,
      17,
      17,
      type === "superDisease" ? "#be75db" : "#b4cb57",
      INK,
      3,
    );
    path(ctx, [-9, 8, 10, 8, 9, 20, -10, 20], "#dce69c", INK, 2);
    ellipse(ctx, -7, -2, 4, 5, INK, INK, 0);
    ellipse(ctx, 7, -2, 4, 5, INK, INK, 0);
    for (let i = 0; i < 3; i++)
      line(ctx, [-6 + i * 6, 14, -6 + i * 6, 20], INK, 2);
  } else if (type === "spooge") {
    for (let i = 0; i < 3; i++) {
      ellipse(ctx, -13 + i * 13, 2 + i * 4, 9, 10, "#274254", INK, 2);
      line(
        ctx,
        [-12 + i * 13, -6 + i * 4, -8 + i * 13, -14 + i * 4],
        "#f3a72d",
        2,
      );
    }
  } else {
    ctx.fillStyle = "#e84835";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 47px sans-serif";
    ctx.strokeText("?", 0, 3);
    ctx.fillText("?", 0, 3);
  }
  ctx.restore();
}
function makePickup(type: ItemType): Texture {
  return texture(80, 80, (ctx) => {
    path(ctx, [9, 12, 68, 10, 70, 69, 11, 71], "#071722", INK, 2);
    path(ctx, [11, 10, 68, 9, 68, 66, 10, 67], CREAM, INK, 3);
    ctx.strokeStyle = "#d38e31";
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 14, 48, 47);
    line(ctx, [17, 17, 60, 16], "#fff9e7", 2);
    itemGlyph(ctx, type);
  });
}
function makeHazard(theme: Theme): Texture {
  return texture(80, 80, (ctx) => {
    ctx.globalAlpha = 0.48;
    if (theme.hazard === "warp") {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(40, 40, 25 - i * 7, 17 - i * 5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = hex(theme.accent);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      for (const [x, y] of [
        [14, 20],
        [66, 20],
        [14, 60],
        [66, 60],
      ])
        ellipse(ctx, x, y, 2, 2, hex(theme.accent), INK, 0);
    } else if (theme.hazard === "trampoline") {
      ellipse(ctx, 40, 43, 26, 21, "#223b46", INK, 3);
      ellipse(ctx, 40, 37, 23, 17, hex(theme.accent), INK, 2);
      line(ctx, [23, 37, 57, 37], INK, 1);
      line(ctx, [40, 22, 40, 53], INK, 1);
    } else if (theme.hazard === "delay") {
      path(
        ctx,
        [24, 25, 41, 39, 24, 53, 35, 53, 53, 39, 35, 25],
        hex(theme.accent),
        hex(theme.accent),
        0,
      );
      for (let i = 0; i < 3; i++)
        line(ctx, [12, 30 + i * 9, 21, 30 + i * 9], "#def7ef", 1.5);
    } else if (theme.hazard === "regenerate") {
      line(ctx, [22, 23, 58, 23, 58, 58, 22, 58, 22, 23], hex(theme.accent), 2);
      line(ctx, [29, 40, 51, 40], hex(theme.accent), 3);
      line(ctx, [40, 29, 40, 51], hex(theme.accent), 3);
    } else if (theme.hazard !== "none") {
      path(
        ctx,
        [22, 25, 39, 39, 22, 53, 34, 53, 52, 39, 34, 25],
        hex(theme.accent),
        hex(theme.accent),
        0,
      );
      if (theme.hazard === "conveyor") {
        line(ctx, [12, 16, 68, 16], INK, 3);
        line(ctx, [12, 64, 68, 64], INK, 3);
      }
    }
  });
}

export function createArenaArt(theme: Theme): ArenaArt {
  const directions: Direction[] = ["down", "up", "left", "right"];
  const items: ItemType[] = [
    "bomb",
    "flame",
    "goldflame",
    "skate",
    "kick",
    "punch",
    "grab",
    "spooge",
    "trigger",
    "jelly",
    "disease",
    "superDisease",
    "random",
  ];
  const all: Texture[] = [];
  const keep = (t: Texture): Texture => {
    all.push(t);
    return t;
  };
  const art: ArenaArt = {
    floors: Array.from({ length: 4 }, (_, i) => keep(makeFloor(theme, i))),
    walls: Array.from({ length: 3 }, (_, i) => keep(makeWall(theme, i))),
    perimeter: Array.from({ length: 3 }, (_, i) =>
      keep(makePerimeter(theme, i)),
    ),
    bricks: Array.from({ length: 3 }, (_, i) => keep(makeBrick(theme, i))),
    players: [0, 1].map((id) =>
      directions.map((direction) =>
        Array.from({ length: WALK_FRAMES }, (_, i) =>
          keep(makePlayer(id, direction, i)),
        ),
      ),
    ),
    bombs: [0, 1, 2].map((kind) =>
      keep(texture(88, 104, (ctx) => drawBomb(ctx, kind))),
    ),
    flames: Array.from({ length: 16 }, (_, i) => keep(makeFlame(i))),
    pickups: new Map(items.map((type) => [type, keep(makePickup(type))])),
    spark: keep(
      texture(40, 40, (ctx) => {
        star(ctx, 20, 20, 18, 7, "#ff8c28", 8, 0.15);
        star(ctx, 20, 20, 12, 4, "#fff2a2", 7, 0.2);
      }),
    ),
    debris: keep(
      texture(24, 24, (ctx) => {
        path(
          ctx,
          [3, 7, 13, 2, 22, 8, 19, 19, 10, 22, 2, 15],
          hex(theme.brick),
          INK,
          2,
        );
        path(
          ctx,
          [3, 7, 13, 2, 22, 8, 12, 12],
          tint(theme.brick, 36),
          INK,
          1.2,
        );
      }),
    ),
    shadow: keep(
      texture(80, 30, (ctx) => {
        const grad = ctx.createRadialGradient(40, 15, 0, 40, 15, 36);
        grad.addColorStop(0, "rgba(0,8,16,.42)");
        grad.addColorStop(1, "rgba(0,8,16,0)");
        ctx.scale(1, 0.36);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 80, 84);
      }),
    ),
    hazard: keep(makeHazard(theme)),
    destroy: () => {
      for (const t of all) t.destroy(true);
    },
  };
  return art;
}
