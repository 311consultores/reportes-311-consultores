// Utilidades compartidas por los scripts del manual
import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const ASSETS = path.join(ROOT, "assets");
export const SHOTS = path.join(ROOT, "capturas");

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

export async function launch() {
  const exe = CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!exe) throw new Error("No se encontro Chrome ni Edge");
  return chromium.launch({ executablePath: exe, headless: true });
}
