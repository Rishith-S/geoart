import fs from "node:fs";
import { createCanvas } from "canvas";
import type { GeoJSONFeature } from "./overpass";

type Theme = {
  "name": string,
  "description": string,
  "bg": string,
  "text": string,
  "gradient_color": string,
  "water": string,
  "parks": string,
  "road_motorway": string,
  "road_primary": string,
  "road_secondary": string,
  "road_tertiary": string,
  "road_residential": string,
  "road_default": string
};

function getTags(f: GeoJSONFeature) {
  return (f.properties?.tags ?? f.properties ?? {}) as Record<string, any>;
}

function isWater(f: GeoJSONFeature) {
  return getTags(f).natural === "water";
}

function isPark(f: GeoJSONFeature) {
  return getTags(f).leisure === "park";
}

function highwayType(f: GeoJSONFeature) {
  return (getTags(f).highway ?? "") as string;
}

function roadWidth(hw: string) {
  if (hw === "motorway") return 5.0;
  if (hw === "trunk") return 4.2;
  if (hw === "primary") return 3.6;
  if (hw === "secondary") return 3.0;
  if (hw === "tertiary") return 2.4;
  if (hw === "residential") return 1.4;
  if (hw === "unclassified") return 1.2;
  return 1.0;
}

function roadColor(theme: Theme, highway: string) {
  switch (highway) {
    case "motorway":
    case "motorway_link":
      return theme.road_motorway;

    case "primary":
    case "primary_link":
      return theme.road_primary;

    case "secondary":
    case "secondary_link":
      return theme.road_secondary;

    case "tertiary":
    case "tertiary_link":
      return theme.road_tertiary;

    case "residential":
    case "living_street":
      return theme.road_residential;

    default:
      return theme.road_default;
  }
}

function beginPolygonPath(
  ctx: any,
  rings: number[][][],
  project: (lon: number, lat: number) => { x: number; y: number }
) {

  for (const ring of rings) {
    if (!ring.length) continue;
    const p0 = project(ring[0][0], ring[0][1]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < ring.length; i++) {
      const p = project(ring[i][0], ring[i][1]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }
}

function fillPolygon(
  ctx: any,
  f: GeoJSONFeature,
  project: (lon: number, lat: number) => { x: number; y: number },
  color: string
) {
  ctx.beginPath();
  ctx.fillStyle = color;

  const g = f.geometry;
  if (g.type === "Polygon") {
    beginPolygonPath(ctx, g.coordinates as any, project);
    ctx.fill("evenodd");
  } else if (g.type === "MultiPolygon") {
    for (const rings of g.coordinates as any) beginPolygonPath(ctx, rings, project);
    ctx.fill("evenodd");
  }
}

function strokeLine(
  ctx: any,
  f: GeoJSONFeature,
  project: (lon: number, lat: number) => { x: number; y: number },
  color: string,
  width: number
) {
  const g = f.geometry;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawOne = (coords: number[][]) => {
    if (!coords.length) return;
    ctx.beginPath();
    const p0 = project(coords[0][0], coords[0][1]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < coords.length; i++) {
      const p = project(coords[i][0], coords[i][1]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };

  if (g.type === "LineString") drawOne(g.coordinates as any);
  if (g.type === "MultiLineString") for (const line of g.coordinates as any) drawOne(line);
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function gradientFades(ctx: any, w: number, h: number, color: string) {
  const fadeH = Math.floor(h * 0.28);

  const bot = ctx.createLinearGradient(0, h - fadeH, 0, h);
  bot.addColorStop(0, hexToRgba(color, 0));
  bot.addColorStop(1, color);
  ctx.fillStyle = bot;
  ctx.fillRect(0, h - fadeH, w, fadeH);
}

function drawText(ctx: any, w: number, h: number, title: string, theme: Theme, sizeNum: number, heightNum: number){
  const color = theme.text; 
  const family = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const size = Math.floor(h * sizeNum);
  const spacing = Math.max(2, size*0.12);

  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.font = `700 ${size}px ${family}`;

  const text = title.toUpperCase();
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const totalW = widths.reduce((a: number, b: number) => a + b, 0) + spacing * (text.length - 1);

  let x = (w - totalW) / 2;
  const y = Math.floor(h * heightNum);

  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x, y);
    x += widths[i] + spacing;
  }
}

function drawLine(ctx: any, w: number, h: number, theme: Theme, heightNum: number) {
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  const p0 = { x: 0.42 * w, y: h * heightNum };
  const p1 = { x: 0.58 * w, y: h * heightNum };
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
}

export function renderPoster(params: {
  features: GeoJSONFeature[];
  width: number;
  height: number;
  project: (lon: number, lat: number) => { x: number; y: number };
  themePath: string;
  title: string;
  lonlan: string;
  country: string;
}) {
  const theme = JSON.parse(fs.readFileSync(params.themePath, "utf-8")) as Theme;

  const canvas = createCanvas(params.width, params.height);
  const ctx = canvas.getContext("2d") as any;

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, params.width, params.height);

  for (const f of params.features) {
    const t = f.geometry?.type;
    if (t !== "Polygon" && t !== "MultiPolygon") continue;
    if (isWater(f)) fillPolygon(ctx, f, params.project, theme.water);
    if (isPark(f)) fillPolygon(ctx, f, params.project, theme.parks);
  }

  const roads = params.features.filter((f) => {
    const t = f.geometry?.type;
    return (
      (t === "LineString" || t === "MultiLineString") &&
      highwayType(f)
    );
  }).map((f) => {
    const hwt = highwayType(f);
    return {
      f,
      highwayType : hwt,
      roadColor : roadColor(theme, hwt),
      roadWidth : roadWidth(hwt)
    }
  });

  roads.sort((a, b) => a?.roadWidth! - b?.roadWidth!);

  for (const r of roads) {
    strokeLine(ctx, r?.f!, params.project, r?.roadColor!, r?.roadWidth!);
  }

  const cropWidth = 3000;
  const cropHeight = 4000;

  const sx = (params.width - cropWidth) / 2;
  const sy = (params.height - cropHeight) / 2;

  const outputCanvas = createCanvas(cropWidth, cropHeight);
  const oCtx = outputCanvas.getContext('2d');

  oCtx!.drawImage(
      canvas, 
      sx, sy, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
  );

  gradientFades(oCtx, cropWidth, cropHeight, theme.gradient_color);
  drawText(oCtx, cropWidth, cropHeight, params.title, theme, 0.06, 0.8)
  drawLine(oCtx, cropWidth, cropHeight, theme, 0.88)
  drawText(oCtx, cropWidth, cropHeight, params.country, theme, 0.03, 0.89);
  drawText(oCtx, cropWidth, cropHeight, params.lonlan, theme, 0.018, 0.93);

  return outputCanvas.toBuffer("image/png");
}
