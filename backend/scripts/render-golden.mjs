import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendRoot = fileURLToPath(new URL('..', import.meta.url));
const rendererPath = resolve(backendRoot, 'dist/backend/src/lib/instagramRenderer/index.js');
const fixturePath = resolve(backendRoot, 'dist/backend/src/lib/instagramRenderer/fixtures/quarkbroetchen-meta.js');
const sourceImagePath = resolve(backendRoot, 'src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png');
const outputPath = resolve(backendRoot, 'output/quarkbroetchen.png');

function failureFrom(error) {
  if (error && error.ok === false && error.error) return error.error;
  return {
    code: 'INTERNAL',
    message: 'Unable to create the Instagram reference render.',
    cause: error instanceof Error ? error.message : String(error),
  };
}

async function main() {
  const rendererModule = await import(pathToFileURL(rendererPath).href);
  const fixtureModule = await import(pathToFileURL(fixturePath).href);
  const fixture =
    fixtureModule.quarkbroetchenMetaFixture ??
    fixtureModule.quarkbroetchenFixture ??
    fixtureModule.default;
  const input = existsSync(fixture.image.path)
    ? fixture
    : { ...fixture, image: { path: sourceImagePath } };
  const result = await rendererModule.renderInstagramRecipe(input);

  if (!result.ok) {
    console.error(JSON.stringify(result.error));
    process.exitCode = 1;
    return;
  }

  await mkdir(resolve(backendRoot, 'output'), { recursive: true });
  await writeFile(outputPath, result.buffer);
  console.log(outputPath);
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify(failureFrom(error)));
  process.exitCode = 1;
}
