// Minimaler Parser für die Teilmenge von Markdown, die docs/legal/*.md verwendet:
// # / ## Überschriften, "- " und eingerückte "  - " Listen, **fett**, Absätze (Zeilenumbrüche bleiben erhalten).

export interface LegalInline {
  text: string;
  bold: boolean;
}

export type LegalBlock =
  | { type: 'heading'; level: 1 | 2; text: string }
  | { type: 'paragraph'; content: LegalInline[] }
  | { type: 'bullet'; level: 0 | 1; content: LegalInline[] };

export function parseInline(text: string): LegalInline[] {
  return text
    .split('**')
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}

export function parseLegalMarkdown(markdown: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', content: parseInline(paragraph.join('\n')) });
    paragraph = [];
  }

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^(#{1,2}) (.+)$/.exec(line);
    const bullet = /^( *)- (.+)$/.exec(line);

    if (line.trim() === '') {
      flushParagraph();
    } else if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: heading[1].length === 1 ? 1 : 2, text: heading[2] });
    } else if (bullet) {
      flushParagraph();
      blocks.push({ type: 'bullet', level: bullet[1].length > 0 ? 1 : 0, content: parseInline(bullet[2]) });
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();

  return blocks;
}
