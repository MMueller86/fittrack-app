import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentView } from './LegalDocumentView';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('react-native', () => ({
  BackHandler: { addEventListener: mocks.addListener },
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));

type Json = { type: string; props: Record<string, unknown>; children: (Json | string)[] | null };

function flatten(node: Json | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(flatten).join('');
}

function findTexts(node: Json | string | null, role?: string): string[] {
  if (node === null || typeof node === 'string') return [];
  const own = node.type === 'Text' && (role === undefined || node.props.accessibilityRole === role) ? [flatten(node)] : [];
  return [...own, ...(node.children ?? []).flatMap((child) => findTexts(child, role))];
}

function texts(renderer: ReactTestRenderer, role?: string): string[] {
  return findTexts((renderer as unknown as { toJSON(): Json }).toJSON(), role);
}

function render(props: React.ComponentProps<typeof LegalDocumentView>) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<LegalDocumentView {...props} />);
  });
  return renderer;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.addListener.mockReturnValue({ remove: mocks.remove });
});

describe('LegalDocumentView', () => {
  it('renders the Datenschutz text with a header title and section headings', () => {
    const renderer = render({ documentId: 'privacy', onBack: vi.fn() });
    const all = texts(renderer);

    expect(all[0]).toBe('Datenschutzerklärung');
    expect(all).toContain('Speicherdauer und Löschen');
    expect(all.some((t) => t.includes('Konto löschen ist in der Alpha noch nicht verfügbar.'))).toBe(true);
    expect(all).toContain('Das ist eine Alpha-Version. Dieser Text kann sich ändern.');

    const headers = texts(renderer, 'header');
    expect(headers[0]).toBe('Datenschutzerklärung');
    expect(headers).toContain('Wer ist verantwortlich?');
  });

  it('renders the Impressum with the address', () => {
    const all = texts(render({ documentId: 'imprint', onBack: vi.fn() }));

    expect(all[0]).toBe('Impressum');
    expect(all).toContain('Michael Müller\nRichardstraße 120\n40231 Düsseldorf');
  });

  it('calls onBack from the labelled back button', () => {
    const onBack = vi.fn();
    const renderer = render({ documentId: 'privacy', onBack });
    const back = renderer.root.findAll(
      (n: ReactTestInstance) => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === 'Zurück',
    )[0]!;

    act(() => (back.props.onPress as () => void)());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('only intercepts the hardware back action when requested', () => {
    render({ documentId: 'privacy', onBack: vi.fn() });
    expect(mocks.addListener).not.toHaveBeenCalled();

    const onBack = vi.fn();
    const renderer = render({ documentId: 'privacy', onBack, interceptHardwareBack: true });
    const handler = mocks.addListener.mock.calls[0]![1] as () => boolean;

    expect(handler()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);

    act(() => renderer.unmount());
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
});
