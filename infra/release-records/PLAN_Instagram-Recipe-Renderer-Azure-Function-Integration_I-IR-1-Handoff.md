# Instagram Recipe Renderer - I-IR-1 Handoff

- RecordedAtLocal: 2026-09-16
- OperatorMode: Infrastructure and Release
- Scope: I-IR-1 only
- Outcome: INCOMPLETE - LINUX GATE UNVERIFIED
- Publication: BLOCKED until the Linux packaging gate passes
- Dev Build Required: NO
- Deployment: NOT EXECUTED

## Scope Guard

This record completes the existing I-IR-1 handoff scope. It does not change the
approved plan, application code, Mobile files, the historical Golden, or any
deployment target.

## Preserved Staging Evidence

The already reported evidence remains valid:

- Clean `build:verify`: PASS; the deterministic build copied 9 renderer assets.
- `robocopy /MIR`: 299 files and 0 hash differences.
- The compiled `instagramRecipe` function and all required fonts, SVGs and PNGs
  are present in `_deploy_staging/dist`.
- Runtime locks and the production-only staging manifest were checked.
- No application, Mobile, plan, historical Golden, or threshold changes were
  made for this handoff.
- No Dev or Alpha deployment was executed.

The staging lockfile declares the Linux x64 optional packages
`@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64`, and
`@resvg/resvg-js-linux-x64-gnu`. This is lockfile evidence only; it is not a
runtime proof that those packages were installed and loaded.

## Declared Environment Check

The available execution environment is Windows, with Node `v24.15.0`
(`win32 x64`). WSL is not installed and Docker is unavailable. No Linux Node 20
x64 runner or equivalent packaging environment is available in this session.

Windows `node_modules` was not used as evidence and no Windows installation is
claimed as deployable for Azure Linux.

## Acceptance Status

| Criterion | Status | Evidence |
|---|---|---|
| AC-12 | PASS | Staging manifest and lockfile contain the required runtime packages and resolved integrity data; `pixelmatch` is not a production dependency. |
| AC-13 | UNVERIFIED | The required Linux Node 20 x64 installation and positive isolated compiled-renderer smoke were not executable in the available environment. No native-binding pass is claimed. |
| AC-14 | PASS | The compiled function, complete asset manifest and mirrored staging tree were already checked. |
| AC-15 | NOT EXECUTED | This handoff did not include a Dev or Alpha deployment. |
| AC-20 | PASS | No Mobile or native Mobile configuration changed; the release decision is `Dev Build Required: NO`. |

## Exact Missing Validation

Run the following in a Linux Node 20 x64 environment from the repository root.
Both command blocks must exit with code `0`; retain their stdout and exit codes
as the Linux handoff evidence.

### 1. Fresh Linux production install and native binding proof

```bash
cd _deploy_staging
rm -rf node_modules
npm ci --omit=dev
test "$(node -p 'process.platform')" = "linux"
test "$(node -p 'process.arch')" = "x64"
test "$(node -p 'process.versions.node.split(".")[0]')" = "20"
node <<'NODE'
const required = [
  "sharp",
  "@resvg/resvg-js",
  "@img/sharp-linux-x64",
  "@img/sharp-libvips-linux-x64",
  "@resvg/resvg-js-linux-x64-gnu",
];

for (const name of required) {
  console.log(`${name}=${require.resolve(name)}`);
}

for (const name of [
  "@img/sharp-win32-x64",
  "@resvg/resvg-js-win32-x64-msvc",
]) {
  let resolved;
  try {
    resolved = require.resolve(name);
  } catch (error) {
    if (error?.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }
  if (resolved) {
    throw new Error(`Windows native package must not be installed: ${name}`);
  }
}

const sharp = require("sharp");
require("@resvg/resvg-js");
console.log(JSON.stringify({
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  sharpVersions: sharp.versions,
}));
NODE
```

### 2. Positive isolated smoke of the compiled renderer

Run this after the fresh install, still from `_deploy_staging`:

```bash
test -f dist/backend/src/lib/instagramRenderer/index.js
node <<'NODE'
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const sharp = require("sharp");
const { renderInstagramRecipe } = require(
  "./dist/backend/src/lib/instagramRenderer/index.js",
);

(async () => {
  const directory = mkdtempSync(join(tmpdir(), "fittrack-iir1-smoke-"));
  try {
    const imagePath = join(directory, "source.png");
    await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 3,
        background: { r: 91, g: 112, b: 98 },
      },
    }).png().toFile(imagePath);

    const result = await renderInstagramRecipe({
      image: { path: imagePath },
      presentation: { focusX: 0.5, focusY: 0.46, zoom: 1.0 },
      title: "Linux staging smoke",
      tags: [{ id: "backen", label: "Backen" }],
      nutritionHighlight: null,
      nutrition: { calories: 210, protein: 8, carbs: 32, fat: 4 },
    });

    if (
      !result.ok ||
      result.format !== "png" ||
      result.width !== 1080 ||
      result.height !== 1350 ||
      !Buffer.isBuffer(result.buffer) ||
      result.buffer.length === 0
    ) {
      throw new Error(JSON.stringify(result));
    }

    console.log(JSON.stringify({
      status: "PASS",
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.buffer.length,
    }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
NODE
```

## Release Decision

AC-13 remains `UNVERIFIED`. Publication must wait for the two Linux validation
blocks above and must not be replaced by a Windows-native installation. The
Infrastructure decision remains `Dev Build Required: NO`; no EAS or Dev Build
is required for this backend-only scope.