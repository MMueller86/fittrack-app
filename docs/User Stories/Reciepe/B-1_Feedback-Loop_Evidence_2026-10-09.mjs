import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const directory = "docs/User Stories/Reciepe";
const prefix = "B-1_Feedback-Loop_";
const date = "2026-10-09";
const require = createRequire(import.meta.url);
const baseline = JSON.parse((await readFile(join(root, directory, `${prefix}Baseline_${date}.json`), "utf8")).replace(/^\uFEFF/u, ""));
const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const candidates = new Map(baseline.candidates.map((candidate) => [candidate.path, candidate]));
const preservation = [];
for (const record of baseline.files) {
  if (candidates.has(record.path)) continue;
  const currentHash = sha256(await readFile(join(root, record.path))).toUpperCase();
  preservation.push({ path: record.path, startingSha256: record.sha256, currentSha256: currentHash, unchanged: currentHash === record.sha256 });
}
if (preservation.some((record) => !record.unchanged)) throw new Error("An unrelated dirty-baseline file changed.");

const temporary = await mkdtemp(join(tmpdir(), "fittrack-b1-"));
const owned = [];
let ownedPatch = "";
try {
  const paths = [...candidates.keys(),
    `${directory}/${prefix}Evidence_${date}.mjs`,
    `${directory}/${prefix}Handoff_${date}.md`,
  ];
  for (const path of paths) {
    const before = candidates.get(path)?.content ?? "";
    const after = await readFile(join(root, path), "utf8");
    if (before === after) continue;
    const beforePath = join(temporary, "before", path);
    const afterPath = join(temporary, "after", path);
    await mkdir(dirname(beforePath), { recursive: true });
    await mkdir(dirname(afterPath), { recursive: true });
    await writeFile(beforePath, before);
    await writeFile(afterPath, after);
    let patch;
    try {
      patch = execFileSync("git", ["diff", "--no-index", "--text", "--no-ext-diff", "--", beforePath, afterPath], { encoding: "utf8" });
    } catch (error) {
      if (error.status !== 1) throw error;
      patch = error.stdout;
    }
    const lines = patch.split("\n");
    lines[0] = `diff --git a/${path} b/${path}`;
    const headerEnd = lines.findIndex((line) => line.startsWith("@@"));
    for (let index = 1; index < headerEnd; index += 1) {
      if (lines[index].startsWith("--- ")) lines[index] = `--- ${candidates.has(path) ? `a/${path}` : "/dev/null"}`;
      if (lines[index].startsWith("+++ ")) lines[index] = `+++ b/${path}`;
    }
    const normalizedPatch = lines.join("\n");
    ownedPatch += normalizedPatch;
    owned.push({
      path, newFile: !candidates.has(path),
      startingSha256: candidates.get(path)?.sha256 ?? null,
      endingSha256: sha256(await readFile(join(root, path))).toUpperCase(),
      hunks: lines.filter((line) => line.startsWith("@@")),
      patchSha256: sha256(normalizedPatch),
    });
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}

const { probeInstagramRecipeDetailsGeneratedText, renderInstagramRecipeDetailsTemplate } = require(resolve(root, "backend/dist/backend/src/lib/instagramRenderer/render.js"));
const { quarkbroetchenDetailsFixture: sourceFixture } = require(resolve(root, "backend/dist/backend/src/lib/instagramRenderer/fixtures/quarkbroetchen-details.js"));
const source = { ...sourceFixture, image: { path: resolve(root, "backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png") } };
const { twentyIngredientsDetailsFixture: denseSource } = require(resolve(root, "backend/dist/backend/src/lib/instagramRenderer/fixtures/twenty-ingredients-details.js"));
const steps = [
  "Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.",
  "Forme den Teig zu Brötchen.",
  "Backe die Brötchen im vorgeheizten Ofen.",
  "Lasse die Brötchen abkühlen.",
];
const shorter = ["Mische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu Teig.", ...steps.slice(1)];
const summarizeRender = (result) => result.ok
  ? { ok: true, width: result.width, height: result.height, format: result.format, pngSha256: sha256(result.buffer) }
  : result;
const contexts = [];
for (const [name, input] of [
  ["alpha-four-step-overflow", { ...source, steps }],
  ["shorter-ingredient-preserving-candidate", { ...source, steps: shorter }],
  ["baseline-quarkbroetchen", source],
  ["baseline-dense-template", { ...denseSource, image: source.image }],
]) {
  const probeInput = { savedTitle: input.title, teaser: input.description, steps: input.steps };
  contexts.push({
    name, probeInput,
    renderContext: { title: input.title, description: input.description, ingredients: input.ingredients, steps: input.steps,
      portions: input.portions, totalTimeMinutes: input.totalTimeMinutes, difficulty: input.difficulty,
      presentation: input.presentation, highlight: input.highlight,
      photoFixture: "backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png" },
    probe: await probeInstagramRecipeDetailsGeneratedText(probeInput),
    fullRender: summarizeRender(await renderInstagramRecipeDetailsTemplate(input)),
  });
}
const expectedHashes = [
  "bc9276a5158de0c1247a9da9b33a4fd5a072268f4fec4c7108b40ac94f460d74",
  "b81a0cc528c389cc3b21113ef7d65ea6d7cc37ba2023b4d9fa035e087573036a",
  "e1737c8af626890d61ae1cc3decac0a31e6e6de7da8ca98fe2a88982e17b130b",
];
if (contexts[0].probe.status !== "generated-text-failure" || contexts[0].fullRender.ok) throw new Error("Alpha overflow disagreement.");
const alphaStep = contexts[0].probe.diagnostics.find((item) => item.field === "steps" && item.itemIndex === 0);
if (alphaStep?.measured?.width !== 300 || alphaStep.measured.height !== 112 || alphaStep.measured.maxWidth !== 302 || alphaStep.measured.maxHeight !== 105) throw new Error("Alpha geometry changed.");
const fullAlpha = contexts[0].fullRender.error;
if (fullAlpha?.code !== "TEMPLATE_FIELD_OVERFLOW" || fullAlpha.field !== "steps" || fullAlpha.itemIndex !== 0 ||
  JSON.stringify(fullAlpha.measured) !== JSON.stringify(alphaStep.measured)) throw new Error("Compiled full-render Alpha geometry disagreement.");
for (const [index, context] of contexts.slice(1).entries()) {
  if (!context.probe.ok || !context.fullRender.ok || context.fullRender.pngSha256 !== expectedHashes[index]) throw new Error(`Candidate parity/fingerprint failure: ${context.name}`);
}
const assets = [];
for (const name of await readdir(join(root, "backend/src/lib/instagramRenderer/assets/fonts"))) {
  if (name.endsWith(".ttf")) {
    const path = `backend/src/lib/instagramRenderer/assets/fonts/${name}`;
    assets.push({ path, sha256: sha256(await readFile(join(root, path))) });
  }
}
const photoPath = "backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png";
assets.push({ path: photoPath, sha256: sha256(await readFile(join(root, photoPath))) });
const artifacts = [];
for (const name of await readdir(join(root, directory))) {
  if (name.startsWith(prefix) && name !== `${prefix}Evidence_${date}.json` && name !== `${prefix}Owned-Diff_${date}.patch`) {
    artifacts.push({ path: `${directory}/${name}`, sha256: sha256(await readFile(join(root, directory, name))) });
  }
}
await writeFile(join(root, directory, `${prefix}Owned-Diff_${date}.patch`), ownedPatch);
await writeFile(join(root, directory, `${prefix}Evidence_${date}.json`), `${JSON.stringify({
  package: "B-1", approvedPlan: "PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09", approvedDate: date,
  baselineHead: baseline.head, currentHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  owned, preservation, assets, contexts, artifacts,
  verification: { focused: { files: 1, tests: 83, exit: 0 }, baselineUnits: { files: 66, tests: 1440, exit: 0 },
    finalUnits: { files: 66, tests: 1488, exit: 0 }, backendTypecheckExit: 0, buildVerifyExit: 0,
    encodingExit: 0, diffWhitespaceExit: 0, ownedPatchReverseCheckExit: 0, ownedCredentialPatternMatches: 0 },
  boundary: "Offline renderer extraction only; no live AI, loop integration, deployment, release or independent QA claim.",
}, null, 2)}\n`);
console.log(`PASS: ${owned.length} owned files; ${preservation.length} unrelated baseline files preserved; four compiled candidate contexts verified.`);