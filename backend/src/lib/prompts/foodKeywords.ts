/**
 * Builds the prompt for AI-powered search keyword generation for a food product.
 * The model returns a JSON array of lowercase German search terms.
 */
export function buildKeywordPrompt(name: string, brand?: string): string {
  return `Du bist ein Suchterm-Generator für eine Lebensmittel-Datenbank in einer deutschen Fitness-App.

Deine Aufgabe: Generiere Suchbegriffe, mit denen ein Nutzer dieses Produkt finden würde,
auch wenn er nicht den exakten Produktnamen kennt.

Produkt: "${name}"
${brand ? `Marke: "${brand}"` : ''}
Regeln:
- 5-12 Begriffe, jeweils 1-3 Wörter
- Denke aus Nutzerperspektive: Kategorie, Synonyme, Ernährungsform, Verwendungszweck
- Nur Kleinbuchstaben, keine Sonderzeichen außer Bindestrich
- Antwort AUSSCHLIESSLICH als roher JSON-Array ohne Markdown, Code-Fences oder sonstigen Text

Beispiel:
Produkt: "Griechischer Joghurt Natur"
→ ["joghurt", "griechisch", "naturjoghurt", "milchprodukt", "protein", "frühstück", "skyr", "quark-alternative"]

Jetzt für das obige Produkt:`;
}
