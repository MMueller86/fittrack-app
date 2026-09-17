import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = resolve(backendRoot, "src/lib/instagramRenderer/assets");
const targetRoot = resolve(backendRoot, "dist/backend/src/lib/instagramRenderer/assets");

const expectedAssets = [
  "branding/fittrack-wordmark.png",
  "branding/micha-logo-writing.svg",
  "fonts/Inter-Medium.ttf",
  "fonts/Inter-SemiBold.ttf",
  "fonts/InterDisplay-Bold.ttf",
  "fonts/LICENSE.txt",
  "nutrition/barbell-header-frame.svg",
  "nutrition-highlights/high-protein.png",
  "nutrition-highlights/low-fat.png",
].sort();

async function collectFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, files);
    } else if (entry.isFile()) {
      files.push(relative(sourceRoot, absolutePath).split(sep).join("/"));
    }
  }
  return files;
}

function assertAssetManifest(actualAssets) {
  const actual = [...actualAssets].sort();
  const missing = expectedAssets.filter((asset) => !actual.includes(asset));
  const unexpected = actual.filter((asset) => !expectedAssets.includes(asset));
  if (missing.length === 0 && unexpected.length === 0) return;

  const details = [
    missing.length > 0 ? `missing: ${missing.join(", ")}` : "",
    unexpected.length > 0 ? `unexpected: ${unexpected.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  throw new Error(`Instagram renderer asset manifest is out of date (${details}).`);
}

async function main() {
  const actualAssets = await collectFiles(sourceRoot);
  assertAssetManifest(actualAssets);

  await rm(targetRoot, { recursive: true, force: true });
  for (const asset of expectedAssets) {
    const targetPath = resolve(targetRoot, asset);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(resolve(sourceRoot, asset), targetPath);
  }

  console.log(`Copied ${expectedAssets.length} Instagram renderer assets to ${targetRoot}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}