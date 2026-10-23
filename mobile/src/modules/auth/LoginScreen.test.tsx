import React, { useState } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import LoginScreen from './LoginScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  showSnackbar: vi.fn(),
  useAuthRequest: vi.fn((..._args: unknown[]) => [{}, null, vi.fn()]),
}));

vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: 'Snackbar',
  useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  BackHandler: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Linking: { addEventListener: vi.fn(() => ({ remove: vi.fn() })), getInitialURL: vi.fn(() => Promise.resolve(null)) },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('./landing/LandingPager', () => ({ LandingPager: 'LandingPager' }));
vi.mock('./landing/GoogleGlyph', () => ({ GoogleGlyph: 'GoogleGlyph' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'fittrack://auth',
  useAuthRequest: mocks.useAuthRequest,
  exchangeCodeAsync: vi.fn(),
}));
vi.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: vi.fn() }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
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

function CleanupNoticeHarness({ onNoticeShown }: { onNoticeShown: () => void }) {
  const [noticeVisible, setNoticeVisible] = useState(true);
  return (
    <LoginScreen
      onLoginSuccess={vi.fn()}
      accountDeletionCleanupNotice={noticeVisible}
      onAccountDeletionCleanupNoticeShown={() => {
        onNoticeShown();
        setNoticeVisible(false);
      }}
    />
  );
}

describe('LoginScreen', () => {
  it('uses the https redirect and no domain_hint by default', () => {
    mocks.useAuthRequest.mockClear();
    act(() => {
      create(<LoginScreen onLoginSuccess={vi.fn()} />);
    });
    expect(mocks.useAuthRequest.mock.calls[0]![0]).toMatchObject({
      redirectUri: 'https://blue-hill-03fb3c103.1.azurestaticapps.net/auth/callback/alpha',
      extraParams: undefined,
    });
  });

  it('shows the transient cleanup warning once without blocking login or offering retry', () => {
    mocks.showSnackbar.mockClear();
    const onAccountDeletionCleanupNoticeShown = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<CleanupNoticeHarness onNoticeShown={onAccountDeletionCleanupNoticeShown} />);
    });

    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      message: 'Einige private App-Daten von FitTrack konnten auf diesem Gerät nicht gelöscht werden. Du kannst die App-Daten in den Android-Einstellungen entfernen.',
      durationMs: 6000,
      numberOfLines: null,
    });
    expect(onAccountDeletionCleanupNoticeShown).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll((node: ReactTestInstance) => node.type === 'Pressable')[0]!.props.disabled).toBe(false);
    expect(texts(renderer)).not.toContain('Erneut versuchen');

    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
  });

  it('opens the Datenschutz text in-app without authentication and returns to login', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<LoginScreen onLoginSuccess={vi.fn()} />);
    });
    expect(texts(renderer)).toContain('Mit Google anmelden');

    pressByLabel(renderer, 'Datenschutzerklärung lesen');
    const privacy = texts(renderer);
    expect(privacy[0]).toBe('Datenschutzerklärung');
    expect(privacy).not.toContain('Mit Google anmelden');

    pressByLabel(renderer, 'Zurück');
    expect(texts(renderer)).toContain('Mit Google anmelden');
  });

  it('shows a German inline error with a retry action when the login cannot start', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<LoginScreen onLoginSuccess={vi.fn()} />);
    });
    // The mocked request has no code verifier, so starting fails with the pending-login error.
    pressByLabel(renderer, 'Mit Google anmelden');
    expect(texts(renderer)).toContain('Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
    expect(texts(renderer)).toContain('Erneut anmelden');
  });

  it('opens the Impressum in-app without authentication and returns to login', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<LoginScreen onLoginSuccess={vi.fn()} />);
    });

    pressByLabel(renderer, 'Impressum lesen');
    expect(texts(renderer)[0]).toBe('Impressum');

    pressByLabel(renderer, 'Zurück');
    expect(texts(renderer)).toContain('Mit Google anmelden');
  });
});
