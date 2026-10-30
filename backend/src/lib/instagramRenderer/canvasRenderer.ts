import { paintTree } from "./canvasPaint";
import { buildTree, layoutNode, snapToPixels, type LayoutNode, type TreeElement } from "./flexLayout";
import { FontBook, type RendererFont } from "./fontBook";

export type { RendererFont } from "./fontBook";

export type RenderNode = {
  type: string;
  props: Record<string, unknown>;
  width: number;
  height: number;
  left: number;
  top: number;
};

export type LayoutOptions = {
  width: number;
  height: number;
  fonts: readonly RendererFont[];
  onNodeDetected?: (node: RenderNode) => void;
};

export type LaidOutTree = {
  toPng(): Promise<Buffer>;
};

function detectNodes(node: LayoutNode, onNodeDetected: (node: RenderNode) => void): void {
  if (node.element) {
    onNodeDetected({
      type: node.element.type,
      props: node.element.props,
      width: node.bw,
      height: node.bh,
      left: node.bx,
      top: node.by,
    });
  }
  node.children.forEach((child) => detectNodes(child, onNodeDetected));
}

// Lays out the element tree and reports every element's pixel-snapped box; painting happens only in toPng().
export async function layoutElementTree(root: TreeElement, options: LayoutOptions): Promise<LaidOutTree> {
  const fonts = new FontBook(options.fonts);
  const tree = buildTree(root);
  layoutNode(tree, options.width, options.height, options.width, fonts);
  snapToPixels(tree, 0, 0);
  if (options.onNodeDetected) detectNodes(tree, options.onNodeDetected);
  return {
    toPng: () => paintTree(tree, options.width, options.height, fonts),
  };
}
