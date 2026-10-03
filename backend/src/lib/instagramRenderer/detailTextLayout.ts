import type { Font } from "satori";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./layout";
import type { SatoriElement, SatoriStyle } from "./compose";
import type {
  RecipeDetailsTemplateField,
  RecipeDetailsTemplateItemField,
} from "./types";

type HyphenationModule = {
  hyphenateSync: (text: string, options?: { hyphenChar?: string }) => string;
};

const germanHyphenate = (require("hyphen/de") as HyphenationModule).hyphenateSync;
const HYPHENATION_MARKER = "\uE000";
const MEASUREMENT_NODE_PREFIX = "detail-text-measure-";

export type DetailTextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: string;
  lineHeight: number;
};

export type DetailTextLayoutField = {
  id: string;
  text: string;
  maxWidth: number;
  maxHeight: number;
  field: RecipeDetailsTemplateField;
  itemIndex?: number;
  itemField?: RecipeDetailsTemplateItemField;
  style: DetailTextStyle;
};

export type DetailTextMeasureRequest = {
  id: string;
  text: string;
  style: DetailTextStyle;
};

export type DetailTextWidthMeasurer = (
  requests: readonly DetailTextMeasureRequest[],
) => Promise<ReadonlyMap<string, number>>;

export type DetailTextLayoutFailure = {
  id: string;
  field: RecipeDetailsTemplateField;
  itemIndex?: number;
  itemField?: RecipeDetailsTemplateItemField;
  word: string;
  measuredWidth: number;
  maxWidth: number;
};

export type DetailTextLayoutResult =
  | { ok: true; textById: ReadonlyMap<string, string> }
  | { ok: false; error: DetailTextLayoutFailure };

type WordWork = {
  field: DetailTextLayoutField;
  word: string;
  wordIndex: number;
  widthRequestId: string;
  width: number;
  boundaries?: number[];
  edgeRequestIds?: Map<string, string>;
};

type WordLayout = {
  segments: string[];
  firstEnd: number;
};

function getHyphenationBoundaries(word: string): number[] {
  const markedWord = germanHyphenate(word, { hyphenChar: HYPHENATION_MARKER });
  const parts = markedWord.split(HYPHENATION_MARKER);
  if (parts.length < 2) {
    return [0, word.length];
  }

  const boundaries = [0];
  let offset = 0;
  for (let index = 0; index < parts.length; index += 1) {
    offset += parts[index]!.length;
    if (index < parts.length - 1 && offset > 0 && offset < word.length) {
      boundaries.push(offset);
    }
  }
  boundaries.push(word.length);
  return [...new Set(boundaries)];
}

function edgeKey(startIndex: number, endIndex: number): string {
  return `${startIndex}:${endIndex}`;
}

export async function measureDetailTextWidths(
  satori: typeof import("satori").default,
  fonts: Font[],
  requests: readonly DetailTextMeasureRequest[],
): Promise<ReadonlyMap<string, number>> {
  if (requests.length === 0) {
    return new Map();
  }

  const markerIds = new Map<string, string>();
  const textNodes: SatoriElement[] = requests.map((request, index) => {
    const marker = `${MEASUREMENT_NODE_PREFIX}${index}`;
    markerIds.set(marker, request.id);
    const style: SatoriStyle = {
      fontFamily: request.style.fontFamily,
      fontSize: request.style.fontSize,
      fontWeight: request.style.fontWeight,
      lineHeight: request.style.lineHeight,
      whiteSpace: "nowrap",
      wordBreak: "normal",
      flexShrink: 0,
      alignSelf: "flex-start",
    };
    if (request.style.fontStyle !== undefined) {
      style.fontStyle = request.style.fontStyle;
    }
    return {
      type: "span",
      props: {
        style,
        children: request.text,
        "data-render-node": marker,
      },
    };
  });
  const measurementHeight = requests.reduce(
    (total, request) => total + request.style.fontSize * request.style.lineHeight,
    0,
  );
  const root: SatoriElement = {
    type: "div",
    props: {
      style: {
        width: CANVAS_WIDTH,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        overflow: "visible",
      },
      children: textNodes,
    },
  };
  const measurements = new Map<string, number>();

  await satori(root as unknown as Parameters<typeof satori>[0], {
    width: CANVAS_WIDTH,
    height: Math.max(CANVAS_HEIGHT, Math.ceil(measurementHeight + 1)),
    fonts,
    embedFont: true,
    onNodeDetected: (node) => {
      const marker = node.props["data-render-node"];
      if (typeof marker !== "string") {
        return;
      }
      const requestId = markerIds.get(marker);
      if (requestId !== undefined && Number.isFinite(node.width)) {
        measurements.set(requestId, node.width);
      }
    },
  });

  for (const request of requests) {
    if (!measurements.has(request.id)) {
      throw new Error(`Satori did not measure detail text request ${request.id}.`);
    }
  }
  return measurements;
}

export async function addMeasuredGermanBreaks(
  fields: readonly DetailTextLayoutField[],
  measureWidths: DetailTextWidthMeasurer,
): Promise<DetailTextLayoutResult> {
  const fieldIds = new Set<string>();
  const normalizedTextById = new Map<string, string>();
  const wordWorks: WordWork[] = [];
  const wordRequests: DetailTextMeasureRequest[] = [];
  let requestIndex = 0;

  for (const field of fields) {
    if (fieldIds.has(field.id)) {
      throw new Error(`Duplicate detail text field id: ${field.id}.`);
    }
    fieldIds.add(field.id);
    const normalizedText = field.text.replace(/\s+/gu, " ").trim();
    normalizedTextById.set(field.id, normalizedText);
    const wordPattern = /\S+/gu;
    let wordMatch: RegExpExecArray | null = null;
    let wordIndex = 0;
    while ((wordMatch = wordPattern.exec(normalizedText)) !== null) {
      const word = wordMatch[0];
      const requestId = `word-${requestIndex}`;
      requestIndex += 1;
      wordWorks.push({ field, word, wordIndex, widthRequestId: requestId, width: 0 });
      wordRequests.push({ id: requestId, text: word, style: field.style });
      wordIndex += 1;
    }
  }

  const wordWidths = await measureWidths(wordRequests);
  const longWords: WordWork[] = [];
  for (const work of wordWorks) {
    const width = wordWidths.get(work.widthRequestId);
    if (width === undefined || !Number.isFinite(width)) {
      throw new Error(`Satori did not return a valid width for ${work.widthRequestId}.`);
    }
    work.width = width;
    if (width > work.field.maxWidth) {
      work.boundaries = getHyphenationBoundaries(work.word);
      if (work.boundaries.length < 3) {
        return {
          ok: false,
          error: {
            id: work.field.id,
            field: work.field.field,
            itemIndex: work.field.itemIndex,
            itemField: work.field.itemField,
            word: work.word,
            measuredWidth: width,
            maxWidth: work.field.maxWidth,
          },
        };
      }
      work.edgeRequestIds = new Map();
      longWords.push(work);
    }
  }

  const edgeRequests: DetailTextMeasureRequest[] = [];
  for (const work of longWords) {
    const boundaries = work.boundaries!;
    const lastBoundary = boundaries.length - 1;
    for (let startIndex = 0; startIndex < lastBoundary; startIndex += 1) {
      for (let endIndex = startIndex + 1; endIndex <= lastBoundary; endIndex += 1) {
        const requestId = `edge-${requestIndex}`;
        requestIndex += 1;
        work.edgeRequestIds!.set(edgeKey(startIndex, endIndex), requestId);
        edgeRequests.push({
          id: requestId,
          text: `${work.word.slice(boundaries[startIndex]!, boundaries[endIndex]!)}${
            endIndex < lastBoundary ? "-" : ""
          }`,
          style: work.field.style,
        });
      }
    }
  }

  const edgeWidths = await measureWidths(edgeRequests);
  const replacements = new Map<string, Map<number, string>>();
  for (const work of longWords) {
    const boundaries = work.boundaries!;
    const edgeRequestIds = work.edgeRequestIds!;
    const lastBoundary = boundaries.length - 1;
    const bestLayouts: Array<WordLayout | undefined> = new Array(boundaries.length);
    bestLayouts[lastBoundary] = { segments: [], firstEnd: lastBoundary };

    for (let startIndex = lastBoundary - 1; startIndex >= 0; startIndex -= 1) {
      let bestLayout: WordLayout | undefined;
      for (let endIndex = startIndex + 1; endIndex <= lastBoundary; endIndex += 1) {
        const tail = bestLayouts[endIndex];
        if (!tail) {
          continue;
        }
        const requestId = edgeRequestIds.get(edgeKey(startIndex, endIndex));
        const measuredWidth = requestId === undefined ? undefined : edgeWidths.get(requestId);
        if (measuredWidth === undefined || !Number.isFinite(measuredWidth)) {
          throw new Error(`Satori did not return a valid width for ${requestId ?? "a hyphen candidate"}.`);
        }
        if (measuredWidth > work.field.maxWidth) {
          continue;
        }

        const candidate: WordLayout = {
          segments: [
            `${work.word.slice(boundaries[startIndex]!, boundaries[endIndex]!)}${
              endIndex < lastBoundary ? "-" : ""
            }`,
            ...tail.segments,
          ],
          firstEnd: endIndex,
        };
        if (
          !bestLayout ||
          candidate.segments.length < bestLayout.segments.length ||
          (candidate.segments.length === bestLayout.segments.length &&
            candidate.firstEnd > bestLayout.firstEnd)
        ) {
          bestLayout = candidate;
        }
      }
      bestLayouts[startIndex] = bestLayout;
    }

    const layout = bestLayouts[0];
    if (!layout) {
      const firstLineWidths = [...edgeRequestIds.entries()]
        .filter(([key]) => key.startsWith("0:"))
        .map(([, requestId]) => edgeWidths.get(requestId))
        .filter((width): width is number => width !== undefined && Number.isFinite(width));
      return {
        ok: false,
        error: {
          id: work.field.id,
          field: work.field.field,
          itemIndex: work.field.itemIndex,
          itemField: work.field.itemField,
          word: work.word,
          measuredWidth: firstLineWidths.length > 0 ? Math.min(...firstLineWidths) : work.width,
          maxWidth: work.field.maxWidth,
        },
      };
    }

    let fieldReplacements = replacements.get(work.field.id);
    if (!fieldReplacements) {
      fieldReplacements = new Map();
      replacements.set(work.field.id, fieldReplacements);
    }
    fieldReplacements.set(work.wordIndex, layout.segments.join("\n"));
  }

  const textById = new Map<string, string>();
  for (const field of fields) {
    let wordIndex = 0;
    const fieldReplacements = replacements.get(field.id);
    const text = normalizedTextById.get(field.id)!.replace(/\S+/gu, (word) => {
      const replacement = fieldReplacements?.get(wordIndex);
      wordIndex += 1;
      return replacement ?? word;
    });
    textById.set(field.id, text);
  }
  return { ok: true, textById };
}