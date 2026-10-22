import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseInline, parseLegalMarkdown } from './legalMarkdown';
import { LEGAL_DOCUMENTS, type LegalDocumentId } from './legalTexts';

function readLegalFile(name: string): string {
  const path = fileURLToPath(new URL(`../../../../docs/legal/${name}`, import.meta.url));
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trimEnd();
}

function withoutAccountDeletionSection(markdown: string): string {
  const sectionStart = markdown.indexOf('## Speicherdauer und Löschen');
  const nextSection = markdown.indexOf('\n## Fragen?', sectionStart);
  if (sectionStart < 0 || nextSection < 0) throw new Error('Account-deletion section not found');
  return markdown.slice(0, sectionStart) + markdown.slice(nextSection + 1);
}

const APPROVED_ACCOUNT_DELETION_TEXT = 'Wenn du die Kontolöschung bestätigst, löschen wir deine aktiven persönlichen FitTrack-Daten. Veröffentlichte Community-Rezepte, die du behalten möchtest, bleiben ohne aktive Zuordnung zu deinem Konto erhalten; ihr Autor wird als „Anonymous“ angezeigt. Betriebs- und Fehlerprotokolle werden nicht einzeln gelöscht und gemäß der konfigurierten Aufbewahrungszeit gespeichert (derzeit 30 Tage). Bestehende Backups werden nicht verändert. Gelöschte Bilder können gemäß der bestehenden Azure-Blob-Soft-Delete-Konfiguration noch bis zu sieben Tage als Plattform-Wiederherstellungskopie vorhanden sein.';
const LOCAL_DELETION_NOTE = 'Nach erfolgreicher Kontolöschung versucht die App, FitTrack-Anmeldetokens, lokale Sync-Warteschlangen und das lokale Diagnoseprotokoll von deinem Gerät zu entfernen. Wenn das auf deinem Gerät nicht klappt, zeigt FitTrack dir einen Hinweis. Bereits in Health Connect gespeicherte Einträge und Berechtigungen bleiben davon unberührt.';

const SOURCES: Record<LegalDocumentId, string> = {
  privacy: 'datenschutzerklaerung-alpha.md',
  imprint: 'impressum-alpha.md',
};

describe('embedded legal texts', () => {
  for (const id of ['privacy', 'imprint'] as const) {
    describe(id, () => {
      it('matches docs/legal markdown outside approved mobile account-deletion wording', () => {
        const embedded = LEGAL_DOCUMENTS[id].markdown;
        const source = readLegalFile(SOURCES[id]);
        if (id === 'privacy') {
          expect(withoutAccountDeletionSection(embedded)).toBe(withoutAccountDeletionSection(source));
        } else {
          expect(embedded).toBe(source);
        }
      });

      it('uses the document H1 as title and has no bracket placeholders', () => {
        const { title, markdown } = LEGAL_DOCUMENTS[id];
        expect(markdown.split('\n')[0]).toBe(`# ${title}`);
        expect(markdown).not.toMatch(/\[[^\]]*\]/);
      });
    });
  }

  it('contains the approved account-deletion and local-device wording', () => {
    const { markdown } = LEGAL_DOCUMENTS.privacy;
    expect(markdown).toContain('Das ist eine Alpha-Version. Dieser Text kann sich ändern.');
    expect(markdown).toContain(APPROVED_ACCOUNT_DELETION_TEXT);
    expect(markdown).toContain(LOCAL_DELETION_NOTE);
    expect(markdown).not.toContain('Konto löschen ist in der Alpha noch nicht verfügbar.');
    expect(markdown).not.toContain('Die Health-Connect-Wiederholungswarteschlange bleibt bis zur Deinstallation der App.');
    expect(markdown).not.toContain('Das Diagnoseprotokoll (max. 150 Einträge) kannst du in der Health-Connect-Ansicht manuell löschen.');
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
