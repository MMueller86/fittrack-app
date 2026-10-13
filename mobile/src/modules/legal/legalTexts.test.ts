import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseInline, parseLegalMarkdown } from './legalMarkdown';
import { LEGAL_DOCUMENTS, type LegalDocumentId } from './legalTexts';

function readLegalFile(name: string): string {
  const path = fileURLToPath(new URL(`../../../../docs/legal/${name}`, import.meta.url));
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trimEnd();
}

const SOURCES: Record<LegalDocumentId, string> = {
  privacy: 'datenschutzerklaerung-alpha.md',
  imprint: 'impressum-alpha.md',
};

describe('embedded legal texts', () => {
  for (const id of ['privacy', 'imprint'] as const) {
    describe(id, () => {
      it('matches docs/legal markdown exactly', () => {
        expect(LEGAL_DOCUMENTS[id].markdown).toBe(readLegalFile(SOURCES[id]));
      });

      it('uses the document H1 as title and has no bracket placeholders', () => {
        const { title, markdown } = LEGAL_DOCUMENTS[id];
        expect(markdown.split('\n')[0]).toBe(`# ${title}`);
        expect(markdown).not.toMatch(/\[[^\]]*\]/);
      });
    });
  }

  it('contains the Alpha notice and states that account deletion is not available', () => {
    const { markdown } = LEGAL_DOCUMENTS.privacy;
    expect(markdown).toContain('Das ist eine Alpha-Version. Dieser Text kann sich ändern.');
    expect(markdown).toContain('**Konto löschen ist in der Alpha noch nicht verfügbar.**');
    expect(markdown).toContain('Deine Daten bleiben gespeichert, bis dein Konto gelöscht wird.');
    expect(markdown).not.toContain('DELETE /api/profile');
  });
});

describe('parseLegalMarkdown', () => {
  it('parses headings, bullets, nested bullets and bold text', () => {
    const blocks = parseLegalMarkdown('# T\n\n## S\n\n- **A:** b\n  - c\n\nText');

    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'T' },
      { type: 'heading', level: 2, text: 'S' },
      {
        type: 'bullet',
        level: 0,
        content: [
          { text: 'A:', bold: true },
          { text: ' b', bold: false },
        ],
      },
      { type: 'bullet', level: 1, content: [{ text: 'c', bold: false }] },
      { type: 'paragraph', content: [{ text: 'Text', bold: false }] },
    ]);
  });

  it('keeps line breaks inside a paragraph (Impressum address)', () => {
    const blocks = parseLegalMarkdown(LEGAL_DOCUMENTS.imprint.markdown);
    const address = blocks.find((b) => b.type === 'paragraph' && b.content[0].text.startsWith('Michael'));

    expect(address).toBeDefined();
    expect(address?.type === 'paragraph' && address.content[0].text).toBe(
      'Michael Müller\nRichardstraße 120\n40231 Düsseldorf',
    );
  });

  it('leaves no markdown markers in rendered text', () => {
    for (const { markdown } of Object.values(LEGAL_DOCUMENTS)) {
      for (const block of parseLegalMarkdown(markdown)) {
        const rendered = block.type === 'heading' ? block.text : block.content.map((s) => s.text).join('');
        expect(rendered).not.toContain('**');
      }
    }
  });
});

describe('parseInline', () => {
  it('splits bold segments', () => {
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false },
    ]);
  });
});
