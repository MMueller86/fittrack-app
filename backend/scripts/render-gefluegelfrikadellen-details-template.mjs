import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const backendRoot = fileURLToPath(new URL("..", import.meta.url));
const rendererPath = resolve(backendRoot, "dist/backend/src/lib/instagramRenderer/index.js");
const fixturePath = resolve(
  backendRoot,
  "dist/backend/src/lib/instagramRenderer/fixtures/gefluegelfrikadellen-details.js",
);
const outputPath = resolve(backendRoot, "output/gefluegelfrikadellen-details-template.png");

async function main() {
  const rendererModule = await import(pathToFileURL(rendererPath).href);
  const fixtureModule = await import(pathToFileURL(fixturePath).href);
  const fixture = fixtureModule.gefluegelfrikadellenDetailsFixture ?? fixtureModule.default;
  const result = await rendererModule.renderInstagramRecipeDetailsTemplate(fixture);

  if (!result.ok) {
    console.error(JSON.stringify(result.error));
    process.exitCode = 1;
    return;
  }

  await mkdir(resolve(backendRoot, "output"), { recursive: true });
  await writeFile(outputPath, result.buffer);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});