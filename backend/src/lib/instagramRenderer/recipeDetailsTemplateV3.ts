import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_DIVIDER,
  COLOR_LIME,
  COLOR_PANEL,
  COLOR_PRIMARY_TEXT,
  COLOR_SECONDARY_TEXT,
  WORDMARK_CENTER_X,
  WORDMARK_HEIGHT,
  WORDMARK_WIDTH,
  WORDMARK_Y,
} from "./layout";
import type { SatoriChild, SatoriElement, SatoriStyle } from "./compose";
import { ambientBackgroundImage } from "./ambient";
import type { DetailTextLayoutField } from "./detailTextLayout";
import { calculateCoverPlacement, type PhotoAsset } from "./photo";
import type { RecipeDetailsTemplateInput } from "./types";

type TemplateAssets = {
  photo: PhotoAsset;
  wordmark: string;
  wordmarkMimeType: "image/png" | "image/svg+xml";
  nutritionHighlights: Record<"high-protein" | "low-fat", string>;
};

export type RecipeDetailsTemplateTextOverrides = {
  title: string;
  description?: string;
  descriptionFontSize?: number;
  ingredients: string[];
  steps: string[];
};

const MARGIN = 60;
const PHOTO_LEFT = 600;
const PHOTO_TOP = 78;
const PHOTO_WIDTH = 420;
const PHOTO_HEIGHT = 398;
const CARD_TOP = 520;
const CARD_GAP = 20;
const CARD_WIDTH = (CANVAS_WIDTH - MARGIN * 2 - CARD_GAP) / 2;
const CARD_HEIGHT = 604;
const TITLE_LINE_HEIGHT = 1.05;
const DESCRIPTION_LINE_HEIGHT = 1.25;
const INGREDIENT_LARGE_LINE_HEIGHT = 1.2;
const INGREDIENT_COMPACT_LINE_HEIGHT = 1.15;
const STEP_LARGE_LINE_HEIGHT = 1.25;
const STEP_COMPACT_LINE_HEIGHT = 1.17;
export const RECIPE_DETAILS_TEMPLATE_MAX_INGREDIENTS = 20;
export const RECIPE_DETAILS_TEMPLATE_MAX_STEPS = 5;
export const RECIPE_DETAILS_TEMPLATE_TITLE_TOP = 174;
export const RECIPE_DETAILS_TEMPLATE_TITLE_WIDTH = 500;
export const RECIPE_DETAILS_TEMPLATE_DESCRIPTION_WIDTH = 480;
export const RECIPE_DETAILS_TEMPLATE_DESCRIPTION_GAP = 12;
export const RECIPE_DETAILS_TEMPLATE_DESCRIPTION_TEXT_WIDTH =
  RECIPE_DETAILS_TEMPLATE_DESCRIPTION_WIDTH - 3 - 16;
export const RECIPE_DETAILS_TEMPLATE_CHIP_TOP = PHOTO_TOP + PHOTO_HEIGHT - 52;
export const RECIPE_DETAILS_TEMPLATE_CARD_CONTENT_WIDTH = CARD_WIDTH - 92;
export const RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_ROW_HEIGHT = 52;
export const RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_ROW_HEIGHT = 42;
export const RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_TEXT_WIDTH =
  RECIPE_DETAILS_TEMPLATE_CARD_CONTENT_WIDTH - 10 - 12;
export const RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_TEXT_WIDTH =
  RECIPE_DETAILS_TEMPLATE_CARD_CONTENT_WIDTH - 7 - 7;
export const RECIPE_DETAILS_TEMPLATE_STEP_LARGE_ROW_HEIGHT = 105;
export const RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_ROW_HEIGHT = 84;
export const RECIPE_DETAILS_TEMPLATE_STEP_LARGE_TEXT_WIDTH =
  RECIPE_DETAILS_TEMPLATE_CARD_CONTENT_WIDTH - 56 - 20;
export const RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_TEXT_WIDTH =
  RECIPE_DETAILS_TEMPLATE_CARD_CONTENT_WIDTH - 46 - 14;
export const RECIPE_DETAILS_TEMPLATE_TITLE_NODE = "recipe-details-title";
export const RECIPE_DETAILS_TEMPLATE_DESCRIPTION_NODE = "recipe-details-description";
export const RECIPE_DETAILS_TEMPLATE_INGREDIENT_NODE_PREFIX = "recipe-details-ingredient-";
export const RECIPE_DETAILS_TEMPLATE_STEP_NODE_PREFIX = "recipe-details-step-";

function element(
  type: string,
  style: SatoriStyle,
  children?: SatoriChild,
  props: Record<string, unknown> = {},
): SatoriElement {
  return { type, props: { ...props, style, ...(children === undefined ? {} : { children }) } };
}

function imageSource(source: string, mimeType: "image/png" | "image/svg+xml"): string {
  if (source.startsWith("data:")) return source;
  if (mimeType === "image/svg+xml" && source.includes("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  }
  return source;
}

function createPhoto(input: RecipeDetailsTemplateInput, photo: PhotoAsset): SatoriElement {
  const placement = calculateCoverPlacement({
    sourceWidth: photo.width,
    sourceHeight: photo.height,
    focusX: input.presentation.focusX,
    focusY: input.presentation.focusY,
    zoom: input.presentation.zoom,
    containerWidth: PHOTO_WIDTH,
    containerHeight: PHOTO_HEIGHT,
  });
  return element("div", {
    position: "absolute",
    left: PHOTO_LEFT,
    top: PHOTO_TOP,
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    display: "flex",
    overflow: "hidden",
    borderRadius: 40,
    border: `1px solid ${COLOR_LIME}`,
  }, element("img", {
    position: "absolute",
    left: placement.left,
    top: placement.top,
    width: placement.width,
    height: placement.height,
  }, undefined, { src: photo.src }));
}

function createChip(label: string): SatoriElement {
  return element("div", {
    height: 52,
    paddingLeft: 18,
    paddingRight: 18,
    display: "flex",
    alignItems: "center",
    border: `1px solid ${COLOR_LIME}`,
    borderRadius: 26,
    color: COLOR_PRIMARY_TEXT,
    fontFamily: "Inter",
    fontSize: 19,
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: "normal",
    wordBreak: "normal",
  }, label);
}

function createPanelTitle(label: string): SatoriElement {
  return element("div", {
    color: COLOR_PRIMARY_TEXT,
    fontFamily: "InterDisplay",
    fontSize: 42,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: "normal",
    wordBreak: "normal",
  }, label);
}

function createIngredientMotif(): SatoriElement {
  return element("div", {
    width: 230,
    height: 116,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
  }, element("div", {
    position: "relative",
    width: 112,
    height: 112,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${COLOR_DIVIDER}`,
    borderRadius: 56,
    backgroundColor: "rgba(13, 21, 17, 0.42)",
  }, [
    element("div", {
      position: "absolute",
      left: 12,
      top: 12,
      width: 84,
      height: 84,
      border: `2px solid ${COLOR_LIME}`,
      borderRadius: 42,
    }),
    element("span", {
      position: "absolute",
      left: 27,
      top: 38,
      width: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: "#D9654D",
    }),
    element("span", {
      position: "absolute",
      left: 53,
      top: 25,
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: "#7FA45A",
    }),
    element("span", {
      position: "absolute",
      left: 69,
      top: 43,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#D9654D",
    }),
    element("span", {
      position: "absolute",
      left: 43,
      top: 62,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#7FA45A",
    }),
    element("span", {
      position: "absolute",
      left: 69,
      top: 70,
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: "#D6B45B",
    }),
    element("span", {
      position: "absolute",
      left: 30,
      top: 68,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: COLOR_LIME,
    }),
  ], { "data-render-node": "recipe-details-ingredient-motif" }));
}

function createIngredientList(
  ingredients: RecipeDetailsTemplateInput["ingredients"],
  ingredientTexts?: readonly string[],
): SatoriElement {
  const isCompact = ingredients.length > 8;
  const hasIngredientMotif = ingredients.length >= 9 && ingredients.length <= 14;
  const ingredientRowHeight = isCompact
    ? RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_ROW_HEIGHT
    : RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_ROW_HEIGHT;
  const ingredientFontSize = isCompact ? 15 : 21;
  const ingredientGap = isCompact ? 7 : 12;
  const markerSize = isCompact ? 7 : 10;

  const createIngredientRow = (
    ingredient: RecipeDetailsTemplateInput["ingredients"][number],
    index: number,
  ) =>
    element("div", {
      height: ingredientRowHeight,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: ingredientGap,
      borderBottom: `1px solid ${COLOR_DIVIDER}`,
    }, [
      element("span", {
        width: markerSize,
        height: markerSize,
        borderRadius: markerSize / 2,
        backgroundColor: COLOR_LIME,
        flexShrink: 0,
      }),
      element("span", {
        color: COLOR_PRIMARY_TEXT,
        fontFamily: "Inter",
        fontSize: ingredientFontSize,
        fontWeight: 500,
        lineHeight: isCompact ? INGREDIENT_COMPACT_LINE_HEIGHT : INGREDIENT_LARGE_LINE_HEIGHT,
        wordBreak: "normal",
        whiteSpace: "pre-line",
        flex: 1,
        minWidth: 0,
      }, ingredientTexts?.[index] ?? `${ingredient.amount} ${ingredient.name}`, {
        "data-render-node": `${RECIPE_DETAILS_TEMPLATE_INGREDIENT_NODE_PREFIX}${index}`,
      }),
    ]);

  if (isCompact) {
    const splitIndex = Math.ceil(ingredients.length / 2);
    const columns = [
      ingredients.filter((_ingredient, index) => index < splitIndex),
      ingredients.filter((_ingredient, index) => index >= splitIndex),
    ];
    const gridHeight = splitIndex * ingredientRowHeight;
    const ingredientGrid = element("div", {
      height: gridHeight,
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      gap: 12,
    }, columns.map((column, columnIndex) => element("div", {
      flex: 1,
      display: "flex",
      flexDirection: "column",
    }, column.map((ingredient, index) => createIngredientRow(
      ingredient,
      columnIndex === 0 ? index : splitIndex + index,
    )))));

    if (hasIngredientMotif) {
      return element("div", {
        marginTop: 12,
        height: 420,
        display: "flex",
        flexDirection: "column",
      }, [
        ingredientGrid,
        element("div", {
          height: 420 - gridHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }, createIngredientMotif()),
      ]);
    }

    return element("div", {
      marginTop: 12,
      height: 420,
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      gap: 12,
    }, ingredientGrid.props.children);
  }

  return element("div", {
    marginTop: 12,
    height: 420,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 0,
  },
    ingredients.map(createIngredientRow),
  );
}

function createStepList(
  steps: RecipeDetailsTemplateInput["steps"],
  stepTexts?: readonly string[],
): SatoriElement {
  const isCompact = steps.length === RECIPE_DETAILS_TEMPLATE_MAX_STEPS;
  const rowHeight = isCompact
    ? RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_ROW_HEIGHT
    : RECIPE_DETAILS_TEMPLATE_STEP_LARGE_ROW_HEIGHT;
  const markerSize = isCompact ? 46 : 56;

  return element("div", {
    marginTop: 12,
    height: 440,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 0,
  },
      steps.map((step, index) =>
      element("div", {
        height: rowHeight,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: isCompact ? 14 : 20,
        borderBottom: `1px solid ${COLOR_DIVIDER}`,
      }, [
        element("span", {
          width: markerSize,
          height: markerSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${COLOR_LIME}`,
          borderRadius: markerSize / 2,
          color: COLOR_LIME,
          fontFamily: "Inter",
          fontSize: isCompact ? 23 : 27,
          fontWeight: 600,
          lineHeight: 1,
          whiteSpace: "normal",
          wordBreak: "normal",
          flexShrink: 0,
        }, String(index + 1)),
        element("span", {
          color: COLOR_PRIMARY_TEXT,
          fontFamily: "Inter",
          fontSize: isCompact ? 18 : 22,
          fontWeight: 500,
          lineHeight: isCompact ? STEP_COMPACT_LINE_HEIGHT : STEP_LARGE_LINE_HEIGHT,
          wordBreak: "normal",
          whiteSpace: "pre-line",
          flex: 1,
          minWidth: 0,
        }, stepTexts?.[index] ?? step, {
          "data-render-node": `${RECIPE_DETAILS_TEMPLATE_STEP_NODE_PREFIX}${index}`,
        }),
      ]),
    ),
  );
}

function createPanel(left: number, title: string, content: SatoriElement): SatoriElement {
  return element("div", {
    position: "absolute",
    left,
    top: CARD_TOP,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    paddingLeft: 46,
    paddingRight: 46,
    paddingTop: 42,
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${COLOR_DIVIDER}`,
    borderRadius: 30,
    backgroundColor: "rgba(13, 21, 17, 0.94)",
    boxSizing: "border-box",
  }, [
    element("div", { width: 64, height: 5, backgroundColor: COLOR_LIME, marginBottom: 26 }),
    createPanelTitle(title),
    content,
  ]);
}

export function getRecipeDetailsTitleLayout(title: string): {
  fontSize: number;
  teaserTop: number;
} {
  const titleLength = title.trim().length;
  const hasLongWord = title.trim().split(/\s+/u).some((word) => word.length > 18);
  if (titleLength <= 16) {
    return { fontSize: 64, teaserTop: 286 };
  }
  if (titleLength <= 34) {
    return { fontSize: hasLongWord ? 54 : 58, teaserTop: 320 };
  }
  return { fontSize: hasLongWord ? 40 : 46, teaserTop: 350 };
}

function getRecipeDetailsTeaserText(description: string): string {
  return description.trim().replace(/\s*\.$/u, "");
}

export function getRecipeDetailsTextLayoutFields(
  input: RecipeDetailsTemplateInput,
  descriptionFontSize = 22,
): DetailTextLayoutField[] {
  const titleLayout = getRecipeDetailsTitleLayout(input.title);
  const titleMaxHeight =
    (input.description ? titleLayout.teaserTop : RECIPE_DETAILS_TEMPLATE_CHIP_TOP) -
    RECIPE_DETAILS_TEMPLATE_TITLE_TOP;
  const fields: DetailTextLayoutField[] = [
    {
      id: RECIPE_DETAILS_TEMPLATE_TITLE_NODE,
      text: input.title,
      maxWidth: RECIPE_DETAILS_TEMPLATE_TITLE_WIDTH,
      maxHeight: titleMaxHeight,
      field: "title",
      style: {
        fontFamily: "InterDisplay",
        fontSize: titleLayout.fontSize,
        fontWeight: 700,
        lineHeight: TITLE_LINE_HEIGHT,
      },
    },
  ];

  if (input.description !== undefined) {
    fields.push({
      id: RECIPE_DETAILS_TEMPLATE_DESCRIPTION_NODE,
      text: getRecipeDetailsTeaserText(input.description),
      maxWidth: RECIPE_DETAILS_TEMPLATE_DESCRIPTION_TEXT_WIDTH,
      maxHeight:
        RECIPE_DETAILS_TEMPLATE_CHIP_TOP -
        titleLayout.teaserTop -
        RECIPE_DETAILS_TEMPLATE_DESCRIPTION_GAP,
      field: "description",
      style: {
        fontFamily: "Inter",
        fontSize: descriptionFontSize,
        fontWeight: 500,
        fontStyle: "italic",
        lineHeight: DESCRIPTION_LINE_HEIGHT,
      },
    });
  }

  const compactIngredients = input.ingredients.length > 8;
  const ingredientFontSize = compactIngredients ? 15 : 21;
  const ingredientMaxWidth = compactIngredients
    ? RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_TEXT_WIDTH
    : RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_TEXT_WIDTH;
  const ingredientMaxHeight = compactIngredients
    ? RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_ROW_HEIGHT
    : RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_ROW_HEIGHT;
  fields.push(
    ...input.ingredients.map((ingredient, index) => ({
      id: `${RECIPE_DETAILS_TEMPLATE_INGREDIENT_NODE_PREFIX}${index}`,
      text: `${ingredient.amount} ${ingredient.name}`,
      maxWidth: ingredientMaxWidth,
      maxHeight: ingredientMaxHeight,
      field: "ingredients" as const,
      itemIndex: index,
      itemField: "text" as const,
      style: {
        fontFamily: "Inter",
        fontSize: ingredientFontSize,
        fontWeight: 500,
        lineHeight: compactIngredients
          ? INGREDIENT_COMPACT_LINE_HEIGHT
          : INGREDIENT_LARGE_LINE_HEIGHT,
      },
    })),
  );

  const compactSteps = input.steps.length === RECIPE_DETAILS_TEMPLATE_MAX_STEPS;
  fields.push(
    ...input.steps.map((step, index) => ({
      id: `${RECIPE_DETAILS_TEMPLATE_STEP_NODE_PREFIX}${index}`,
      text: step,
      maxWidth: compactSteps
        ? RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_TEXT_WIDTH
        : RECIPE_DETAILS_TEMPLATE_STEP_LARGE_TEXT_WIDTH,
      maxHeight: compactSteps
        ? RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_ROW_HEIGHT
        : RECIPE_DETAILS_TEMPLATE_STEP_LARGE_ROW_HEIGHT,
      field: "steps" as const,
      itemIndex: index,
      itemField: "text" as const,
      style: {
        fontFamily: "Inter",
        fontSize: compactSteps ? 18 : 22,
        fontWeight: 500,
        lineHeight: compactSteps ? STEP_COMPACT_LINE_HEIGHT : STEP_LARGE_LINE_HEIGHT,
      },
    })),
  );

  return fields;
}

export function composeRecipeDetailsTemplate(
  input: RecipeDetailsTemplateInput,
  assets: TemplateAssets,
  textOverrides?: RecipeDetailsTemplateTextOverrides,
): SatoriElement {
  const titleLayout = getRecipeDetailsTitleLayout(input.title);
  const ingredientsCount = input.ingredients.length;
  const chipLabels = [
    `${input.portions} ${input.portions === 1 ? "Portion" : "Portionen"}`,
    ...(input.totalTimeMinutes === null ? [] : [`${input.totalTimeMinutes} Min.`]),
    `${ingredientsCount} Zutaten`,
  ];

  const children: SatoriChild[] = [
    element("div", {
      position: "absolute",
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: COLOR_PANEL,
      backgroundImage: ambientBackgroundImage(),
    }),
    element("div", {
      position: "absolute",
      left: 88,
      top: 118,
      color: COLOR_LIME,
      fontFamily: "Inter",
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: 4,
      lineHeight: 1,
      whiteSpace: "normal",
      wordBreak: "normal",
    }, "FITTRACK REZEPT"),
    element("div", {
      position: "absolute",
      left: 88,
      top: RECIPE_DETAILS_TEMPLATE_TITLE_TOP,
      width: RECIPE_DETAILS_TEMPLATE_TITLE_WIDTH,
      display: "flex",
      color: COLOR_PRIMARY_TEXT,
      fontFamily: "InterDisplay",
      fontSize: titleLayout.fontSize,
      fontWeight: 700,
      lineHeight: TITLE_LINE_HEIGHT,
      wordBreak: "normal",
      whiteSpace: "pre-line",
    }, textOverrides?.title ?? input.title, { "data-render-node": RECIPE_DETAILS_TEMPLATE_TITLE_NODE }),
    input.description
      ? element("div", {
        position: "absolute",
        left: 88,
        top: titleLayout.teaserTop,
        width: RECIPE_DETAILS_TEMPLATE_DESCRIPTION_WIDTH,
        display: "flex",
        alignItems: "stretch",
        gap: 16,
      }, [
        element("div", {
          width: 3,
          borderRadius: 2,
          backgroundColor: COLOR_LIME,
          flexShrink: 0,
        }),
        element("span", {
          color: COLOR_PRIMARY_TEXT,
          fontFamily: "Inter",
          fontSize: textOverrides?.descriptionFontSize ?? 22,
          fontWeight: 500,
          lineHeight: DESCRIPTION_LINE_HEIGHT,
          fontStyle: "italic",
          wordBreak: "normal",
          whiteSpace: "pre-line",
          flex: 1,
          minWidth: 0,
        }, textOverrides?.description ?? getRecipeDetailsTeaserText(input.description), {
          "data-render-node": RECIPE_DETAILS_TEMPLATE_DESCRIPTION_NODE,
        }),
      ])
      : null,
    createPhoto(input, assets.photo),
    element("div", {
      position: "absolute",
      left: 88,
      top: RECIPE_DETAILS_TEMPLATE_CHIP_TOP,
      display: "flex",
      gap: 14,
    }, chipLabels.map(createChip)),
    createPanel(
      MARGIN,
      "Zutaten",
      createIngredientList(input.ingredients, textOverrides?.ingredients),
    ),
    createPanel(
      MARGIN + CARD_WIDTH + CARD_GAP,
      "So geht's",
      createStepList(input.steps, textOverrides?.steps),
    ),
    element("div", {
      position: "absolute",
      left: MARGIN,
      top: 1170,
      width: CANVAS_WIDTH - MARGIN * 2,
      height: 1,
      backgroundColor: COLOR_DIVIDER,
    }),
    element("div", {
      position: "absolute",
      left: MARGIN,
      top: 1198,
      width: CANVAS_WIDTH - MARGIN * 2,
      color: COLOR_SECONDARY_TEXT,
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 600,
      letterSpacing: 2,
      lineHeight: 1,
      whiteSpace: "normal",
      wordBreak: "normal",
      textAlign: "center",
    }, "FITNESS FOOD. EINFACH GEMACHT."),
    element("img", {
      position: "absolute",
      left: WORDMARK_CENTER_X - WORDMARK_WIDTH / 2,
      top: WORDMARK_Y,
      width: WORDMARK_WIDTH,
      height: WORDMARK_HEIGHT,
    }, undefined, { src: imageSource(assets.wordmark, assets.wordmarkMimeType) }),
  ];

  if (input.highlight) {
    children.push(element("img", {
      position: "absolute",
      left: 894,
      top: 44,
      width: 109,
      height: 109,
    }, undefined, { src: imageSource(assets.nutritionHighlights[input.highlight], "image/png") }));
  }

  return element("div", {
    position: "relative",
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: COLOR_PANEL,
  }, children);
}