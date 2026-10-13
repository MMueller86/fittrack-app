import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import LoginScreen from './LoginScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  BackHandler: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'fittrack://auth',
  useAuthRequest: () => [{}, null, vi.fn()],
  exchangeCodeAsync: vi.fn(),
}));
vi.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: vi.fn() }));
vi.mock('../../services/authConfig', () => ({
  authConfig: { clientId: 'c', scopes: [], authorizationEndpoint: 'a', tokenEndpoint: 't' },
}));
vi.mock('../../services/authService', () => ({ authService: { saveTokens: vi.fn() } }));

type Json = { type: string; props: Record<string, unknown>; children: (Json | string)[] | null };

function flatten(node: Json | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(flatten).join('');
}

function findTexts(node: Json | string | null): string[] {
  if (node === null || typeof node === 'string') return [];
  const own = node.type === 'Text' ? [flatten(node)] : [];
  return [...own, ...(node.children ?? []).flatMap(findTexts)];
}

function texts(renderer: ReactTestRenderer): string[] {
  return findTexts((renderer as unknown as { toJSON(): Json }).toJSON());
}

function pressByLabel(renderer: ReactTestRenderer, label: string) {
  const node = renderer.root.findAll(
    (n: ReactTestInstance) =>
      (n.type === 'Pressable' || n.type === 'TouchableOpacity') && n.props.accessibilityLabel === label,
  )[0]!;
  act(() => (node.props.onPress as () => void)());
}

describe('LoginScreen', () => {
  it('opens the Datenschutz text in-app without authentication and returns to login', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<LoginScreen onLoginSuccess={vi.fn()} />);
    });
    expect(texts(renderer)).toContain('Sign in with Google');

    pressByLabel(renderer, 'Datenschutzerklärung lesen');
    const privacy = texts(renderer);
    expect(privacy[0]).toBe('Datenschutzerklärung');
    expect(privacy).not.toContain('Sign in with Google');

    pressByLabel(renderer, 'Zurück');
    expect(texts(renderer)).toContain('Sign in with Google');
  });
});
