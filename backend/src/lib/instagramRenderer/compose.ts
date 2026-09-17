import {
  AMBIENT_CENTER_X,
  BARBELL_HEIGHT,
  BARBELL_WIDTH,
  BARBELL_X,
  BARBELL_Y,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_DIVIDER,
  COLOR_LIME,
  COLOR_PANEL,
  COLOR_PRIMARY_TEXT,
  COLOR_SECONDARY_TEXT,
  CONTENT_LEFT,
  CONTENT_WIDTH,
  HIGHLIGHT_BADGE_RIGHT,
  HIGHLIGHT_BADGE_SIZE,
  HIGHLIGHT_BADGE_TOP,
  NUTRITION_CARD_BORDER_WIDTH,
  NUTRITION_CARD_HEIGHT,
  NUTRITION_CARD_RADIUS,
  NUTRITION_CARD_WIDTH,
  NUTRITION_DIVIDER_X,
  NUTRITION_DIVIDER_HEIGHT,
  NUTRITION_DIVIDER_WIDTH,
  NUTRITION_CARD_X,
  NUTRITION_CARD_Y,
  NUTRITION_LABEL_FONT_SIZE,
  NUTRITION_VALUE_FONT_SIZE,
  NUTRITION_VALUE_ROW_HEIGHT,
  NUTRITION_VALUE_ROW_TOP_Y,
  NUTRITION_VALUE_ROW_WIDTH,
  NUTRITION_VALUE_ROW_X,
  PRO_PORTION_CENTER_X,
  PRO_PORTION_CARD_BORDER_GAP_LEFT,
  PRO_PORTION_CARD_BORDER_GAP_RIGHT,
  PRO_PORTION_FONT_SIZE,
  PRO_PORTION_HEIGHT,
  PRO_PORTION_TOP,
  PRO_PORTION_WIDTH,
  RECIPE_META_FONT_SIZE,
  RECIPE_META_ICON_GAP,
  RECIPE_META_ICON_SIZE,
  RECIPE_META_ITEM_GAP,
  RECIPE_META_LINE_HEIGHT,
  RECIPE_META_ROW_HEIGHT,
  RECIPE_META_ROW_TOP_Y,
  RECIPE_META_ROW_WIDTH,
  RECIPE_META_ROW_X,
  TAG_CHIP_GAP,
  TAG_CHIP_HEIGHT,
  TAG_CHIP_PADDING_X,
  TAG_ICON_GAP,
  TAG_ICON_SIZE,
  TAG_ROW_MAX_WIDTH,
  TAG_ROW_X,
  TAG_ROW_Y,
  TITLE_FONT_SIZE,
  TITLE_LINE_HEIGHT,
  TITLE_MAX_WIDTH,
  TITLE_X,
  TITLE_Y,
  WORDMARK_CENTER_X,
  WORDMARK_HEIGHT,
  WORDMARK_WIDTH,
  WORDMARK_Y,
} from "./layout";
import { createAmbientLayer } from "./ambient";
import { createPhotoLayer, type PhotoAsset } from "./photo";
import type { RecipeMetaIconAssets } from "./recipeMeta";
import { createTransitionLayer } from "./transition";
import { resolveTagIcon } from "./tagIcons";
import type { RenderInput } from "./types";

export type SatoriStyleValue = string | number | boolean;
export type SatoriStyle = Record<string, SatoriStyleValue>;
export type SatoriChild = SatoriElement | string | number | null | undefined | SatoriChild[];
export type SatoriElement = {
  type: string;
  props: Record<string, unknown> & {
    children?: SatoriChild;
    style?: SatoriStyle;
  };
};

type NutritionHighlight = Exclude<RenderInput["nutritionHighlight"], null>;

export type ComposeAssets = {
  photo: PhotoAsset;
  nutritionHighlights: Record<NutritionHighlight, string>;
  recipeMetaIcons: RecipeMetaIconAssets;
  barbell: string;
  wordmark: string;
  wordmarkMimeType?: "image/png" | "image/svg+xml";
};

function element(
  type: string,
  style: SatoriStyle,
  children?: SatoriChild,
  props: Record<string, unknown> = {},
): SatoriElement {
  return {
    type,
    props: {
      ...props,
      style,
      ...(children === undefined ? {} : { children }),
    },
  };
}

function imageSource(source: string, mimeType: "image/png" | "image/svg+xml"): string {
  if (source.startsWith("data:")) {
    return source;
  }

  if (mimeType === "image/svg+xml" && source.includes("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  }

  return source;
}

function createHighlightLayer(
  highlight: NutritionHighlight,
  assets: ComposeAssets,
): SatoriElement {
  const left = CANVAS_WIDTH - HIGHLIGHT_BADGE_RIGHT - HIGHLIGHT_BADGE_SIZE;

  return element(
    "img",
    {
      position: "absolute",
      left,
      top: HIGHLIGHT_BADGE_TOP,
      width: HIGHLIGHT_BADGE_SIZE,
      height: HIGHLIGHT_BADGE_SIZE,
    },
    undefined,
    { src: imageSource(assets.nutritionHighlights[highlight], "image/png") },
  );
}

function createTagChip(tag: RenderInput["tags"][number]): SatoriElement {
  const icon = resolveTagIcon(tag.id || tag.label);
  const iconElement = icon
    ? element(
        "img",
        {
          width: TAG_ICON_SIZE,
          height: TAG_ICON_SIZE,
          flexShrink: 0,
        },
        undefined,
        {
          src: imageSource(icon.svg, "image/svg+xml"),
        },
      )
    : undefined;

  const children: SatoriChild[] = [];
  if (iconElement) {
    children.push(iconElement);
  }
  children.push(
    element(
      "span",
      {
        color: COLOR_PRIMARY_TEXT,
        fontFamily: "Inter",
        fontSize: 16,
        lineHeight: 1,
        whiteSpace: "nowrap",
        flexShrink: 0,
      },
      tag.label,
    ),
  );

  return element(
    "div",
    {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: iconElement ? TAG_ICON_GAP : 0,
      height: TAG_CHIP_HEIGHT,
      paddingLeft: TAG_CHIP_PADDING_X,
      paddingRight: TAG_CHIP_PADDING_X,
      flexShrink: 0,
      border: `1px solid ${COLOR_LIME}`,
      borderRadius: TAG_CHIP_HEIGHT / 2,
      backgroundColor: "transparent",
      boxSizing: "border-box",
    },
    children,
    { "data-render-node": "tag-chip" },
  );
}

function createTagRow(tags: RenderInput["tags"]): SatoriElement | undefined {
  if (tags.length === 0) {
    return undefined;
  }

  return element(
    "div",
    {
      position: "absolute",
      left: TAG_ROW_X,
      top: TAG_ROW_Y,
      width: TAG_ROW_MAX_WIDTH,
      height: TAG_CHIP_HEIGHT,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: TAG_CHIP_GAP,
      overflow: "hidden",
    },
    tags.map(createTagChip),
  );
}

function createTitle(title: string): SatoriElement {
  return element(
    "div",
    {
      position: "absolute",
      left: TITLE_X,
      top: TITLE_Y,
      width: TITLE_MAX_WIDTH,
      height: TITLE_FONT_SIZE * TITLE_LINE_HEIGHT,
      display: "flex",
      color: COLOR_PRIMARY_TEXT,
      fontFamily: "InterDisplay",
      fontSize: TITLE_FONT_SIZE,
      fontWeight: 700,
      lineHeight: TITLE_LINE_HEIGHT,
      whiteSpace: "nowrap",
      overflow: "hidden",
    },
    element(
      "span",
      {
        whiteSpace: "nowrap",
        flexShrink: 0,
      },
      title,
      { "data-render-node": "title" },
    ),
  );
}

function roundCalories(value: number): number {
  return Math.round(value / 10) * 10;
}

function roundMacro(value: number): number {
  return Math.round(value);
}

function createNutritionColumn(label: string, value: string): SatoriElement {
  return element(
    "div",
    {
      flex: 1,
      height: NUTRITION_VALUE_ROW_HEIGHT,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    [
      element(
        "div",
        {
          color: COLOR_PRIMARY_TEXT,
          fontFamily: "Inter",
          fontSize: NUTRITION_VALUE_FONT_SIZE,
          fontWeight: 600,
          lineHeight: 1,
          whiteSpace: "nowrap",
        },
        value,
      ),
      element(
        "div",
        {
          color: COLOR_SECONDARY_TEXT,
          fontFamily: "Inter",
          fontSize: NUTRITION_LABEL_FONT_SIZE,
          fontWeight: 500,
          lineHeight: 1,
          whiteSpace: "nowrap",
        },
        label,
      ),
    ],
  );
}

function createNutritionCard(input: RenderInput): SatoriElement {
  const clearLeft =
    ((PRO_PORTION_CARD_BORDER_GAP_LEFT - NUTRITION_CARD_X) / NUTRITION_CARD_WIDTH) * 100;
  const clearRight =
    ((PRO_PORTION_CARD_BORDER_GAP_RIGHT - NUTRITION_CARD_X) / NUTRITION_CARD_WIDTH) * 100;

  const columns = [
    ["Kalorien", `${roundCalories(input.nutrition.calories)} kcal`],
    ["Protein", `${roundMacro(input.nutrition.protein)} g`],
    ["Kohlenhydrate", `${roundMacro(input.nutrition.carbs)} g`],
    ["Fett", `${roundMacro(input.nutrition.fat)} g`],
  ] as const;

  return element(
    "div",
    {
      position: "absolute",
      left: NUTRITION_CARD_X,
      top: NUTRITION_CARD_Y,
      width: NUTRITION_CARD_WIDTH,
      height: NUTRITION_CARD_HEIGHT,
      display: "flex",
      flexDirection: "column",
      borderRadius: NUTRITION_CARD_RADIUS,
      border: `${NUTRITION_CARD_BORDER_WIDTH}px solid ${COLOR_DIVIDER}`,
      borderTopColor: "transparent",
      backgroundColor: COLOR_PANEL,
      backgroundImage: `linear-gradient(to right, ${COLOR_DIVIDER} 0%, ${COLOR_DIVIDER} ${clearLeft}%, transparent ${clearLeft}%, transparent ${clearRight}%, ${COLOR_DIVIDER} ${clearRight}%, ${COLOR_DIVIDER} 100%)`,
      backgroundSize: `100% ${NUTRITION_CARD_BORDER_WIDTH}px`,
      backgroundPosition: "top left",
      backgroundRepeat: "no-repeat",
      overflow: "hidden",
      boxSizing: "border-box",
    },
    [
      element(
        "div",
        {
          position: "absolute",
          left: NUTRITION_VALUE_ROW_X - NUTRITION_CARD_X - NUTRITION_CARD_BORDER_WIDTH,
          top: NUTRITION_VALUE_ROW_TOP_Y - NUTRITION_CARD_Y - NUTRITION_CARD_BORDER_WIDTH,
          width: NUTRITION_VALUE_ROW_WIDTH,
          height: NUTRITION_VALUE_ROW_HEIGHT,
          display: "flex",
          flexDirection: "row",
          gap: 0,
        },
        columns.map(([label, value]) => createNutritionColumn(label, value)),
        { "data-render-node": "nutrition-value-row" },
      ),
      ...NUTRITION_DIVIDER_X.map((x) =>
        element(
          "div",
          {
            position: "absolute",
            left: x - NUTRITION_CARD_X - NUTRITION_CARD_BORDER_WIDTH,
            top: NUTRITION_VALUE_ROW_TOP_Y - NUTRITION_CARD_Y - NUTRITION_CARD_BORDER_WIDTH,
            width: NUTRITION_DIVIDER_WIDTH,
            height: NUTRITION_DIVIDER_HEIGHT,
            backgroundColor: COLOR_DIVIDER,
          },
          undefined,
          { "data-render-node": "nutrition-divider" },
        ),
      ),
    ],
    { "data-render-node": "nutrition-card" },
  );
}

function createRecipeMetaItem(icon: string, label: string): SatoriElement {
  return element(
    "div",
    {
      display: "flex",
      alignItems: "center",
      gap: RECIPE_META_ICON_GAP,
      height: RECIPE_META_ROW_HEIGHT,
      flexShrink: 0,
    },
    [
      element(
        "img",
        {
          width: RECIPE_META_ICON_SIZE,
          height: RECIPE_META_ICON_SIZE,
          flexShrink: 0,
        },
        undefined,
        {
          src: imageSource(icon, "image/svg+xml"),
          "data-render-node": "recipe-meta-icon",
        },
      ),
      element(
        "span",
        {
          color: COLOR_SECONDARY_TEXT,
          fontFamily: "Inter",
          fontSize: RECIPE_META_FONT_SIZE,
          fontWeight: 500,
          lineHeight: RECIPE_META_LINE_HEIGHT,
          whiteSpace: "nowrap",
          flexShrink: 0,
        },
        label,
      ),
    ],
    { "data-render-node": "recipe-meta-item" },
  );
}

function createRecipeMetaSeparator(): SatoriElement {
  return element(
    "span",
    {
      color: COLOR_SECONDARY_TEXT,
      fontFamily: "Inter",
      fontSize: RECIPE_META_FONT_SIZE,
      fontWeight: 500,
      lineHeight: RECIPE_META_LINE_HEIGHT,
      whiteSpace: "nowrap",
      flexShrink: 0,
    },
    "·",
    { "data-render-node": "recipe-meta-separator" },
  );
}

function createRecipeMetaRow(
  recipeMeta: NonNullable<RenderInput["recipeMeta"]>,
  icons: ComposeAssets["recipeMetaIcons"],
): SatoriElement {
  const content = element(
    "div",
    {
      display: "flex",
      alignItems: "center",
      gap: RECIPE_META_ITEM_GAP,
      flexShrink: 0,
      whiteSpace: "nowrap",
    },
    [
      createRecipeMetaItem(icons.totalTime, `${recipeMeta.totalTimeMinutes} Min.`),
      createRecipeMetaSeparator(),
      createRecipeMetaItem(
        icons.portions,
        `${recipeMeta.portions} ${recipeMeta.portions === 1 ? "Portion" : "Portionen"}`,
      ),
      createRecipeMetaSeparator(),
      createRecipeMetaItem(icons.difficulty, recipeMeta.difficulty.trim()),
    ],
    { "data-render-node": "recipe-meta-content" },
  );

  return element(
    "div",
    {
      position: "absolute",
      left: RECIPE_META_ROW_X,
      top: RECIPE_META_ROW_TOP_Y,
      width: RECIPE_META_ROW_WIDTH,
      height: RECIPE_META_ROW_HEIGHT,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    content,
    { "data-render-node": "recipe-meta-row" },
  );
}

function createBarbellHeader(assets: ComposeAssets): SatoriElement {
  return element(
    "img",
    {
      position: "absolute",
      left: BARBELL_X,
      top: BARBELL_Y,
      width: BARBELL_WIDTH,
      height: BARBELL_HEIGHT,
    },
    undefined,
    { src: imageSource(assets.barbell, "image/svg+xml"), "data-render-node": "barbell" },
  );
}

function createProPortion(): SatoriElement {
  return element(
    "div",
    {
      position: "absolute",
      left: PRO_PORTION_CENTER_X - PRO_PORTION_WIDTH / 2,
      top: PRO_PORTION_TOP,
      width: PRO_PORTION_WIDTH,
      height: PRO_PORTION_HEIGHT,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: COLOR_LIME,
      fontFamily: "Inter",
      fontSize: PRO_PORTION_FONT_SIZE,
      fontWeight: 600,
      lineHeight: 1,
      textAlign: "center",
      whiteSpace: "nowrap",
    },
    "PRO PORTION",
    { "data-render-node": "pro-portion" },
  );
}

function createWordmark(assets: ComposeAssets): SatoriElement {
  return element(
    "img",
    {
      position: "absolute",
      left: WORDMARK_CENTER_X - WORDMARK_WIDTH / 2,
      top: WORDMARK_Y,
      width: WORDMARK_WIDTH,
      height: WORDMARK_HEIGHT,
    },
    undefined,
    {
      src: imageSource(assets.wordmark, assets.wordmarkMimeType ?? "image/png"),
      "data-render-node": "wordmark",
    },
  );
}

export function compose(input: RenderInput, assets: ComposeAssets): SatoriElement {
  const tagRow = createTagRow(input.tags);
  const children: SatoriChild[] = [
    createAmbientLayer(),
    createPhotoLayer(assets.photo, {
      sourceWidth: assets.photo.width,
      sourceHeight: assets.photo.height,
      focusX: input.presentation.focusX,
      focusY: input.presentation.focusY,
      zoom: input.presentation.zoom,
    }),
    createTransitionLayer(),
  ];

  if (input.nutritionHighlight !== null) {
    children.push(createHighlightLayer(input.nutritionHighlight, assets));
  }

  children.push(createTitle(input.title));
  if (tagRow) {
    children.push(tagRow);
  }
  children.push(createNutritionCard(input));
  if (input.recipeMeta) {
    children.push(createRecipeMetaRow(input.recipeMeta, assets.recipeMetaIcons));
  }
  children.push(createBarbellHeader(assets), createProPortion(), createWordmark(assets));

  return element(
    "div",
    {
      position: "relative",
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      backgroundColor: COLOR_PANEL,
    },
    children,
  );
}

export const composeInstagramRecipe = compose;
export default compose;