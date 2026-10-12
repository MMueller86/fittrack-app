import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const opentype = require('@shuding/opentype.js');
const satori = require('satori').default;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df0123456789 .,;:!?%\u00b0';
const fontData = fs.readFileSync('backend/src/lib/instagramRenderer/assets/fonts/Inter-Medium.ttf');
const font = opentype.parse(fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength));
const reachable = new Set([...alphabet].map(character => font.charToGlyphIndex(character)));
if (reachable.has(0)) throw new Error('Alphabet contains a missing glyph');
const defaultSubstitutionTags = new Set(['ccmp', 'locl', 'rlig', 'rclt', 'calt', 'liga', 'clig']);
const substitutionIndexes = new Set(font.tables.gsub.features.filter(feature => defaultSubstitutionTags.has(feature.tag)).flatMap(feature => feature.feature.lookupListIndexes));
function referencedLookups(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => key === 'lookupListIndex' ? [child] : referencedLookups(child));
}
for (const index of substitutionIndexes) for (const reference of referencedLookups(font.tables.gsub.lookups[index])) substitutionIndexes.add(reference);
const sourceLengths = new Map([...reachable].map(index => [index, 1]));
const coverageGlyphs = coverage => coverage.format === 1 ? coverage.glyphs : coverage.ranges.flatMap(range => Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset));
let changed = true;
while (changed) {
  changed = false;
  const add = (glyph, length) => { if (!reachable.has(glyph) || length < sourceLengths.get(glyph)) { reachable.add(glyph); sourceLengths.set(glyph, length); changed = true; } };
  for (const index of substitutionIndexes) {
    const lookup = font.tables.gsub.lookups[index];
    if (![1, 3, 4, 5, 6].includes(lookup.lookupType)) throw new Error(`Unproved GSUB lookup type ${lookup.lookupType}`);
    for (const table of lookup.subtables) {
      if (lookup.lookupType === 5 || lookup.lookupType === 6) continue;
      const inputs = coverageGlyphs(table.coverage);
      inputs.forEach((input, index) => {
        if (!reachable.has(input)) return;
        if (lookup.lookupType === 1) add(table.substFormat === 1 ? (input + table.deltaGlyphId) & 0xffff : table.substitute[index], sourceLengths.get(input));
        if (lookup.lookupType === 3) table.alternateSets[index].forEach(glyph => add(glyph, sourceLengths.get(input)));
        if (lookup.lookupType === 4) for (const ligature of table.ligatureSets[index]) if (ligature.components.every(glyph => reachable.has(glyph))) add(ligature.ligGlyph, sourceLengths.get(input) + ligature.components.reduce((sum, glyph) => sum + sourceLengths.get(glyph), 0));
      });
    }
  }
}
const view = new DataView(fontData.buffer, fontData.byteOffset, fontData.byteLength);
const uint16 = offset => view.getUint16(offset);
const int16 = offset => view.getInt16(offset);
const uint32 = offset => view.getUint32(offset);
const valueSize = format => Array.from({ length: 8 }, (_, bit) => (format >> bit) & 1).reduce((sum, bit) => sum + bit, 0) * 2;
function advance(offset, format) {
  if (format & 0xf0) throw new Error('Device adjustments require an additional proof');
  const prefix = ((format & 1) ? 2 : 0) + ((format & 2) ? 2 : 0);
  return format & 4 ? int16(offset + prefix) : 0;
}
function positioningMaximum(type, offset) {
  if (type === 9) return positioningMaximum(uint16(offset + 2), offset + uint32(offset + 4));
  if ([4, 6].includes(type)) return 0;
  const format = uint16(offset);
  if (type === 1) {
    const valueFormat = uint16(offset + 4);
    if (format === 1) return Math.max(0, advance(offset + 6, valueFormat));
    if (format !== 2) throw new Error('Unknown single positioning format');
    const count = uint16(offset + 6);
    return Math.max(0, ...Array.from({ length: count }, (_, index) => advance(offset + 8 + index * valueSize(valueFormat), valueFormat)));
  }
  if (type !== 2) throw new Error(`Unproved GPOS lookup type ${type}`);
  const firstFormat = uint16(offset + 4);
  const secondFormat = uint16(offset + 6);
  const recordSize = valueSize(firstFormat) + valueSize(secondFormat);
  let maximum = 0;
  const examine = record => { maximum = Math.max(maximum, Math.max(0, advance(record, firstFormat)) + Math.max(0, advance(record + valueSize(firstFormat), secondFormat))); };
  if (format === 1) {
    for (let index = 0; index < uint16(offset + 8); index += 1) {
      const pairSet = offset + uint16(offset + 10 + index * 2);
      for (let pair = 0; pair < uint16(pairSet); pair += 1) examine(pairSet + 2 + pair * (2 + recordSize) + 2);
    }
  } else if (format === 2) {
    const count = uint16(offset + 12) * uint16(offset + 14);
    for (let index = 0; index < count; index += 1) examine(offset + 16 + index * recordSize);
  } else throw new Error('Unknown pair positioning format');
  return maximum;
}
let gpos;
for (let index = 0; index < uint16(4); index += 1) {
  const offset = 12 + index * 16;
  if (fontData.toString('ascii', offset, offset + 4) === 'GPOS') gpos = uint32(offset + 8);
}
if (gpos === undefined) throw new Error('Missing GPOS');
const lookupList = gpos + uint16(gpos + 8);
const adjustments = [];
const defaultPositioningTags = new Set(['kern', 'mark', 'mkmk', 'curs', 'dist', 'abvm', 'blwm']);
const positioningIndexes = new Set(font.tables.gpos.features.filter(feature => defaultPositioningTags.has(feature.tag)).flatMap(feature => feature.feature.lookupListIndexes));
for (let index = 0; index < uint16(lookupList); index += 1) {
  if (!positioningIndexes.has(index)) continue;
  const lookup = lookupList + uint16(lookupList + 2 + index * 2);
  const maximum = Math.max(0, ...Array.from({ length: uint16(lookup + 4) }, (_, subtable) => positioningMaximum(uint16(lookup), lookup + uint16(lookup + 6 + subtable * 2))));
  adjustments.push(maximum);
}
const glyphAdvance = Math.max(...[...reachable].map(index => font.glyphs.get(index).advanceWidth / sourceLengths.get(index)));
const advanceBound = glyphAdvance + adjustments.reduce((sum, maximum) => sum + maximum, 0);
const pixelBound = Math.ceil(advanceBound * 22 / font.unitsPerEm);
const wordLimit = Math.floor(290 / pixelBound);
const characterLimit = Math.floor(580 / pixelBound);
const tokenPattern = /^[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df0-9]+(?:\u00b0C|%)?[.,;:!?]?$/u;
const fonts = [{ name: 'Inter', data: fontData, weight: 500, style: 'normal' }];
async function measure(text, fontSize, lineHeight, width) {
  let result;
  await satori({ type: 'div', props: { style: { width, display: 'flex' }, children: { type: 'span', props: { style: { width, fontFamily: 'Inter', fontSize, fontWeight: 500, lineHeight, whiteSpace: 'pre-line', wordBreak: 'normal' }, children: text, 'data-render-node': 'probe' } } } }, { width, height: 400, fonts, onNodeDetected: node => { if (node.props['data-render-node'] === 'probe') result = { width: node.width, height: node.height }; } });
  if (!result) throw new Error('Missing production measurement');
  return result;
}
const candidates = [
  'W'.repeat(wordLimit),
  Array.from({ length: Math.floor((characterLimit + 1) / (wordLimit + 1)) }, () => 'W'.repeat(wordLimit)).join(' '),
  Array.from({ length: Math.floor((characterLimit + 1) / 2) }, () => 'W').join(' '),
  'Knete den Teig.',
  'Gare bei 180\u00b0C.',
];
const probes = [];
for (const [fontSize, lineHeight, width, maxHeight] of [[22, 1.25, 302, 105], [18, 1.17, 318, 84]]) {
  for (const text of candidates) {
    if (text.length > characterLimit || text.split(' ').some(word => word.length > wordLimit || !tokenPattern.test(word))) throw new Error('Probe violates the declared text contract');
    const measurement = await measure(text, fontSize, lineHeight, width);
    probes.push({ text, fontSize, measurement });
    if (measurement.height > maxHeight) throw new Error('Bounded probe overflow');
  }
  for (const lineCount of [1, 2, 3]) probes.push({ lineCount, fontSize, measurement: await measure(Array.from({ length: lineCount }, () => 'W').join('\n'), fontSize, lineHeight, width) });
}
console.log(JSON.stringify({ fontSha256: crypto.createHash('sha256').update(fontData).digest('hex'), satoriVersion: require('satori/package.json').version, alphabet, substitutionIndexes: [...substitutionIndexes], positioningIndexes: [...positioningIndexes], reachableGlyphCount: reachable.size, glyphAdvance, adjustments, advanceBound, unitsPerEm: font.unitsPerEm, pixelBound, characterLimit, wordLimit, probes }, null, 2));