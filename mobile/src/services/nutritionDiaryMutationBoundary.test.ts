import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const callerFiles = [
  '../modules/nutrition/AddItemModal.tsx',
  '../modules/nutrition/DiaryScreen.tsx',
  '../modules/nutrition/EditItemSheet.tsx',
  '../modules/nutrition/FoodEstimateReviewScreen.tsx',
  '../modules/nutrition/LabelScanReviewScreen.tsx',
  '../modules/nutrition/MealEstimateReviewScreen.tsx',
  '../modules/nutrition/MealParserReviewScreen.tsx',
  '../modules/nutrition/hub/AISubFlow.tsx',
  '../modules/nutrition/hub/FoodEntryHub.tsx',
  '../modules/nutrition/hub/LabelSubFlow.tsx',
  '../modules/nutrition/hub/ManuellerSubFlow.tsx',
  '../modules/nutrition/hub/QuantityView.tsx',
  '../modules/recipes/LogRecipeModal.tsx',
];

const mutationMethods = new Set([
  'createMeal',
  'deleteMeal',
  'addItem',
  'deleteItem',
  'updateItem',
  'bulkDeleteItems',
  'bulkMoveItems',
  'bulkCopyItems',
]);

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

function getImportedBindings(sourceFile: ts.SourceFile, moduleSuffix: string, importedName: string): Set<string> {
  const bindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!statement.moduleSpecifier.text.endsWith(moduleSuffix)) continue;
    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
    for (const element of namedBindings.elements) {
      const sourceName = element.propertyName?.text ?? element.name.text;
      if (sourceName === importedName) bindings.add(element.name.text);
    }
  }
  return bindings;
}

describe('nutrition diary mutation boundary', () => {
  it('routes every covered caller through the facade, not mutating diaryApi transport methods', () => {
    const violations: string[] = [];

    for (const relativePath of callerFiles) {
      const filePath = resolve(sourceDirectory, relativePath);
      const sourceText = readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const facadeBindings = getImportedBindings(sourceFile, 'nutritionDiaryService', 'nutritionDiaryService');
      const diaryApiBindings = getImportedBindings(sourceFile, 'shared/api/diaryApi', 'diaryApi');
      if (facadeBindings.size === 0) violations.push(`${relativePath}: missing nutritionDiaryService import`);

      const visit = (node: ts.Node): void => {
        if (ts.isPropertyAccessExpression(node)
          && mutationMethods.has(node.name.text)
          && ts.isIdentifier(node.expression)
          && diaryApiBindings.has(node.expression.text)) {
          violations.push(`${relativePath}: direct diaryApi.${node.name.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });
});