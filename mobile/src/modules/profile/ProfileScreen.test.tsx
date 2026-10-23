import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileScreen from './ProfileScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  profileApi: { getMe: vi.fn(), deleteProfile: vi.fn() },
  recipeApi: { list: vi.fn() },
  completeAccountDeletionLocally: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: { OS: 'android' },
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: {
    absoluteFillObject: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  Switch: 'Switch',
  View: 'View',
}));

vi.mock('@react-navigation/native', async () => {
  const ReactModule = await import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(() => effect(), [effect]),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));
vi.mock('../../shared/api/profileApi', () => ({ profileApi: mocks.profileApi }));
vi.mock('../../shared/api/recipeApi', () => ({ recipeApi: mocks.recipeApi }));
vi.mock('../../services/accountDeletionService', () => ({
  completeAccountDeletionLocally: mocks.completeAccountDeletionLocally,
}));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: 'Snackbar',
  useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
}));
vi.mock('./ProfileWizardScreen', () => ({ default: 'ProfileWizardScreen' }));

const profile = {
  gender: 'male',
  age: 34,
  heightCm: 180,
  weightKg: 82,
  targetWeightKg: 78,
  stepsPerDay: 8000,
  activityLevel: null,
  trainingFrequencyPerWeek: 3,
  trainingDurationMinutes: 60,
  sports: [],
  goal: 'lose_weight',
  goalIntensity: 'moderate',
};

const targets = {
  restDay: { calories: 2000, proteinG: 150, fatG: 60, carbsG: 200 },
  trainingDay: { calories: 2300, proteinG: 160, fatG: 65, carbsG: 250 },
};

function textNodes(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((n: ReactTestInstance) => n.type === 'Text')
    .map((n: ReactTestInstance) => {
      const children: unknown = n.props.children;
      if (Array.isArray(children)) return children.filter((c) => typeof c === 'string' || typeof c === 'number').join('');
      return typeof children === 'string' || typeof children === 'number' ? String(children) : '';
    });
}

function text(renderer: ReactTestRenderer): string {
  return textNodes(renderer).join(' | ');
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
}

async function renderScreen() {
  const navigation = { navigate: vi.fn() };
  const props = { navigation } as unknown as React.ComponentProps<typeof ProfileScreen>;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ProfileScreen {...props} />);
    await Promise.resolve();
  });
  await flush();
  return { renderer, navigation };
}

function findByLabel(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAll(
    (n: ReactTestInstance) => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === label,
  );
}

function pressByLabel(renderer: ReactTestRenderer, label: string) {
  const node = findByLabel(renderer, label)[0]!;
  act(() => (node.props.onPress as () => void)());
}

function expectPermanentGroups(renderer: ReactTestRenderer) {
  const all = text(renderer);
  expect(textNodes(renderer)).not.toContain('Profil');
  expect(all).toContain('Bibliothek');
  expect(all).toContain('Favoriten & Eigene Lebensmittel');
  expect(all).toContain('Integrationen');
  expect(all).toContain('Health Connect');
  expect(all).toContain('Rechtliches');
  expect(all).toContain('Impressum');
  expect(all).toContain('Datenschutzerklärung');
  expect(all).not.toContain('Gemeinsam');
  expect(textNodes(renderer)).not.toContain('Persönliche Daten');
  expect(findByLabel(renderer, 'Profil & Tagesziele')).toHaveLength(0);
  expect(findByLabel(renderer, 'Konto löschen')).toHaveLength(0);
}

function expectLegalNavigation(renderer: ReactTestRenderer, navigation: { navigate: ReturnType<typeof vi.fn> }) {
  pressByLabel(renderer, 'Impressum');
  expect(navigation.navigate).toHaveBeenLastCalledWith('Imprint');
  pressByLabel(renderer, 'Datenschutzerklärung');
  expect(navigation.navigate).toHaveBeenLastCalledWith('PrivacyPolicy');
}

// RefreshControl wird als Prop an die ScrollView übergeben (nicht als Kind gerendert).
function refreshControls(renderer: ReactTestRenderer) {
  return renderer.root
    .findAll((n: ReactTestInstance) => n.type === 'ScrollView' && n.props.refreshControl != null)
    .map((n: ReactTestInstance) => (n.props.refreshControl as React.ReactElement<{ onRefresh: () => void }>));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ProfileScreen', () => {
  it('shows one Profil & Tagesziele card and the groups in fixed order without a repeated tab title', async () => {
    mocks.profileApi.getMe.mockResolvedValue({ profile, targets });
    const { renderer } = await renderScreen();

    const nodes = textNodes(renderer);
    const all = text(renderer);
    expect(textNodes(renderer)).not.toContain('Profil');
    expect(all).toContain('Profil & Tagesziele');
    expect(nodes.filter((t) => t === 'Profil & Tagesziele')).toHaveLength(1);
    expect(findByLabel(renderer, 'Konto löschen')).toHaveLength(1);
    const profileScroll = renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'ScrollView' && node.props.refreshControl != null,
    )[0]!;
    expect(profileScroll.findAll((node: ReactTestInstance) => node.props.accessibilityLabel === 'Konto löschen')).toHaveLength(0);
    const deleteFooter = renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'View' && node.props.testID === 'profile-delete-footer',
    )[0]!;
    expect(deleteFooter.findAll((node: ReactTestInstance) => node.props.accessibilityLabel === 'Konto löschen')).toHaveLength(1);
    expect(all).toContain('Männlich');
    expect(all).toContain('34 Jahre');
    expect(all).toContain('180 cm');
    expect(all).toContain('82 kg');
    expect(all).toContain('78 kg');

    const order = [
      'Profil & Tagesziele',
      'Bibliothek',
      'Integrationen',
      'Rechtliches',
    ].map((s) => all.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    expect(all).not.toContain('Gemeinsam');
    expect(all).not.toContain('Alltag & Training');
    expect(nodes).not.toContain('Ziel');
    expect(nodes).not.toContain('Tagesziele');
    expect(all).not.toContain('Ruhetag');
    expect(all).not.toContain('Trainingstag');
    expect(nodes).not.toContain('Bearbeiten');
    expect(findByLabel(renderer, 'Profil bearbeiten')).toHaveLength(0);
    expect(all).not.toContain('Mein Profil');
    expect(all).not.toContain('Meine Lebensmittel');
    expect(all).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u);
  });

  it('navigates from all hub entries', async () => {
    mocks.profileApi.getMe.mockResolvedValue({ profile, targets });
    const { renderer, navigation } = await renderScreen();

    pressByLabel(renderer, 'Profil & Tagesziele');
    expect(navigation.navigate).toHaveBeenLastCalledWith('ProfileDetails');
    pressByLabel(renderer, 'Favoriten & Eigene Lebensmittel');
    expect(navigation.navigate).toHaveBeenLastCalledWith('Library');
    pressByLabel(renderer, 'Health Connect');
    expect(navigation.navigate).toHaveBeenLastCalledWith('HealthConnect');
    expectLegalNavigation(renderer, navigation);
    expect(refreshControls(renderer)).toHaveLength(1);
  });

  it('keeps permanent groups while loading and shows the labelled spinner', async () => {
    mocks.profileApi.getMe.mockReturnValue(new Promise(() => {}));
    const { renderer, navigation } = await renderScreen();

    const spinner = renderer.root.findAll((n: ReactTestInstance) => n.type === 'ActivityIndicator');
    expect(spinner).toHaveLength(1);
    expect(spinner[0]!.props.accessibilityLabel).toBe('Profil wird geladen');
    expectPermanentGroups(renderer);
    expect(text(renderer)).not.toContain('Basisdaten');
    expect(refreshControls(renderer)).toHaveLength(1);
    expectLegalNavigation(renderer, navigation);
  });

  it('shows a retryable error card with permanent groups instead of "Noch kein Profil"', async () => {
    mocks.profileApi.getMe.mockRejectedValueOnce(new Error('network'));
    const { renderer, navigation } = await renderScreen();

    const all = text(renderer);
    expect(all).toContain('Profil konnte nicht geladen werden');
    expect(all).not.toContain('Noch kein Profil');
    expectPermanentGroups(renderer);
    expect(refreshControls(renderer)).toHaveLength(1);
    expectLegalNavigation(renderer, navigation);

    mocks.profileApi.getMe.mockResolvedValueOnce({ profile, targets });
    pressByLabel(renderer, 'Erneut versuchen');
    await flush();

    expect(mocks.profileApi.getMe).toHaveBeenCalledTimes(2);
    expect(text(renderer)).toContain('Profil & Tagesziele');
    expect(textNodes(renderer)).not.toContain('Persönliche Daten');
  });

  it('shows "Noch kein Profil" with setup action only after a successful request without profile', async () => {
    mocks.profileApi.getMe.mockResolvedValue({ profile: null, targets: null });
    const { renderer, navigation } = await renderScreen();

    const all = text(renderer);
    expect(all).toContain('Noch kein Profil');
    expect(all).not.toContain('konnte nicht geladen werden');
    expect(findByLabel(renderer, 'Profil einrichten')).toHaveLength(1);
    expectPermanentGroups(renderer);
    expect(refreshControls(renderer)).toHaveLength(1);
    expectLegalNavigation(renderer, navigation);
  });

  it('opens the existing wizard from "Profil einrichten" and reloads after completion', async () => {
    mocks.profileApi.getMe.mockResolvedValue({ profile: null, targets: null });
    const { renderer } = await renderScreen();

    pressByLabel(renderer, 'Profil einrichten');
    const wizard = renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'ProfileWizardScreen');
    expect(wizard).toHaveLength(1);
    expect(wizard[0]!.props.isNewProfile).toBe(true);

    mocks.profileApi.getMe.mockResolvedValue({ profile, targets });
    await act(async () => {
      (wizard[0]!.props.onComplete as () => void)();
      await Promise.resolve();
    });
    await flush();

    expect(mocks.profileApi.getMe).toHaveBeenCalledTimes(2);
    expect(text(renderer)).toContain('Profil & Tagesziele');
  });

  it('keeps data and shows a snackbar when a refresh fails after a successful load', async () => {
    mocks.profileApi.getMe.mockResolvedValueOnce({ profile, targets });
    const { renderer } = await renderScreen();

    mocks.profileApi.getMe.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      refreshControls(renderer)[0]!.props.onRefresh();
      await Promise.resolve();
    });
    await flush();

    expect(mocks.showSnackbar).toHaveBeenCalledWith({ message: 'Profil konnte nicht aktualisiert werden.' });
    expect(text(renderer)).toContain('Profil & Tagesziele');
  });
});
