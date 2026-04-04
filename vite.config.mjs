import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const browser = process.env.VITE_BROWSER || "chrome";
const baseDir = `src/${browser}`;

function generateManifest() {
  return readJsonFile(`${baseDir}/manifest.json`);
}

export default defineConfig({
  root: baseDir,
  build: {
    outDir: path.resolve(__dirname, "dist", browser),
    emptyOutDir: true,
  },
  plugins: [
    webExtension({
      manifest: generateManifest,
      browser: browser,
      watchMode: true,
      additionalInputs: ["dashboard.html"],
    }),
  ],
});
