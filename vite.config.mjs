import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateManifest() {
  const manifest = readJsonFile("src/manifest.json");
  const browser = process.env.VITE_BROWSER || "chrome";

  if (browser === "firefox") {
    manifest.manifest_version = 3;
    if (manifest.side_panel) {
      manifest.sidebar_action = {
        default_panel: manifest.side_panel.default_path,
        default_icon: manifest.icons["48"]
      };
      delete manifest.side_panel;
    }
    if (manifest.background && manifest.background.service_worker) {
      manifest.background.scripts = [manifest.background.service_worker];
      delete manifest.background.service_worker;
    }
    manifest.permissions = manifest.permissions.filter(p => p !== "sidePanel");
    manifest.browser_specific_settings = {
      gecko: {
        id: "strawslite@kaber420.com",
        strict_min_version: "113.0"
      }
    };
  }

  return manifest;
}

export default defineConfig({
  root: "src",
  build: {
    outDir: path.resolve(__dirname, "dist", process.env.VITE_BROWSER || "chrome"),
    emptyOutDir: true,
  },
  plugins: [
    webExtension({
      manifest: generateManifest,
      browser: process.env.VITE_BROWSER || "chrome",
      watchMode: true,
    }),
  ],
});
