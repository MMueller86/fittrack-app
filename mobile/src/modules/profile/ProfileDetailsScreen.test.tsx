import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileDetailsScreen from './ProfileDetailsScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  profileApi: { getMe: vi.fn() },
  recipeApi: { list: vi.fn() },
  showSnackbar: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: {
    absoluteFillObject: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('@react-navigation/native', async () => {
  const ReactModule = await import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(() => effect(), [effect]),
  };
});

vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../shared/api/profileApi', () => ({ profileApi: mocks.profileApi }));
vi.mock('../../shared/api/recipeApi', () => ({ recipeApi: mocks.recipeApi }));
vi.mock('../../services/accountDeletionService', () => ({
  completeAccountDeletionLocally: vi.fn(),
}));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: 'Snackbar',
  useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
}));

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
  sports: ['Laufen', 'Klettern'],
  goal: 'lose_weight',
  goalIntensity: 'moderate',
};

const targets = {
  restDay: {
    calories: 2000,
    proteinG: 150,
    fatG: 60,
    carbsG: 200,
    fiberG: 28,
    macroRanges: {
      proteinG: { minG: 123, maxG: 164 },
      carbsG: { minG: 201, maxG: 242 },
    },
  },
  trainingDay: {
    calories: 2300,
    proteinG: 160,
    fatG: 65,
    carbsG: 250,
    fiberG: 32,
    macroRanges: {
      proteinG: { minG: 123, maxG: 164 },
      carbsG: { minG: 265, maxG: 306 },
    },
  },
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
  const navigation = { navigate: vi.fn(), goBack: vi.fn() };
  const props = { navigation } as unknown as React.ComponentProps<typeof ProfileDetailsScreen>;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ProfileDetailsScreen {...props} />);
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

// RefreshControl wird als Prop an die ScrollView übergeben (nicht als Kind gerendert).
function refreshControls(renderer: ReactTestRenderer) {
  return renderer.root
    .findAll((n: ReactTestInstance) => n.type === 'ScrollView' && n.props.refreshControl != null)
    .map((n: ReactTestInstance) => (n.props.refreshControl as React.ReactElement<{ onRefresh: () => void }>));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.recipeApi.list.mockResolvedValue({ recipes: [] });
});

describe('ProfileDetailsScreen', () => {
  it('shows header, Alltag & Training, Ziel and Tagesziele without Basisdaten', async () => {
    mocks.profileApi.getMe.mockResolvedValue({ profile, targets });
    const { renderer } = await renderScreen();

    const nodes = textNodes(renderer);
    const all = text(renderer);
    expect(nodes).toContain('Profil & Tagesziele');
    expect(nodes).not.toContain('Profil bearbeiten');
    expect(findByLabel(renderer, 'Profil bearbeiten')).toHaveLength(1);
    expect(findByLabel(renderer, 'Konto löschen')).toHaveLength(0);
    const detailsScroll = renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'ScrollView' && node.props.refreshControl != null,
    )[0]!;
    expect(detailsScroll.findAll((node: ReactTestInstance) => node.props.accessibilityLabel === 'Konto löschen')).toHaveLength(0);
    expect(renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'View' && node.props.testID === 'profile-details-delete-footer',
    )).toHaveLength(0);
    expect(findByLabel(renderer, 'Zurück')).toHaveLength(1);

    expect(nodes).toContain('Alltag & Training');
    expect(all).toContain(`${(8000).toLocaleString()} Schritte/Tag`);
    expect(all).toContain('3× / Woche, 60 min');
    expect(all).toContain('Laufen, Klettern');
    expect(nodes).toContain('Ziel');
    expect(all).toContain('Abnehmen');
    expect(all).toContain('Moderat');
    expect(nodes).toContain('Tagesziele');
    expect(all).toContain('Ruhetag');
    expect(all).toContain('Trainingstag');
    expect(nodes.filter((value) => value === '123–164 g')).toHaveLength(2);
    expect(nodes).toContain('201–242 g');
    expect(nodes).toContain('265–306 g');
    expect(all).toContain('2000');
    expect(all).toContain('60 g');
    expect(all).toContain('2300');
    expect(all).toContain('65 g');
    expect(all).not.toContain('Basisdaten');
    expect(refreshControls(renderer)).toHaveLength(1);
  });

  it('keeps legacy scalar targets when a profile response has no macro ranges', async () => {
    const legacyTargets = {
      restDay: { calories: 2000, proteinG: 150, fatG: 60, carbsG: 200, fiberG: 28 },
      trainingDay: { calories: 2300, proteinG: 160, fatG: 65, carbsG: 250, fiberG: 32 },
    };
    mocks.profileApi.getMe.mockResolvedValue({ profile, targets: legacyTargets });
    const { renderer } = await renderScreen();

    const all = text(renderer);
    expect(all).toContain('150 g');
    expect(all).toContain('200 g');
    expect(all).toContain('160 g');
    expect(all).toContain('250 g');
  });

  it('navigates back and to ProfileEdit with the loaded profile', async () => {
    mocks.profileApi.getMe.mockResolvedValue({ profile, targets });
    const { renderer, navigation } = await renderScreen();

    pressByLabel(renderer, 'Profil bearbeiten');
    expect(navigation.navigate).toHaveBeenCalledWith('ProfileEdit', { profile });
    pressByLabel(renderer, 'Zurück');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('shows a labelled spinner without profile actions while loading', async () => {
    mocks.profileApi.getMe.mockReturnValue(new Promise(() => {}));
    const { renderer } = await renderScreen();

    const spinner = renderer.root.findAll((n: ReactTestInstance) => n.type === 'ActivityIndicator');
    expect(spinner).toHaveLength(1);
    expect(spinner[0]!.props.accessibilityLabel).toBe('Profil wird geladen');
    expect(findByLabel(renderer, 'Profil bearbeiten')).toHaveLength(0);
    expect(findByLabel(renderer, 'Konto löschen')).toHaveLength(0);
  });

  it('shows a retryable error without Bearbeiten and recovers on retry', async () => {
    mocks.profileApi.getMe.mockRejectedValueOnce(new Error('network'));
    const { renderer } = await renderScreen();

    expect(text(renderer)).toContain('Profil konnte nicht geladen werden');
    expect(text(renderer)).not.toContain('Noch kein Profil');
    expect(findByLabel(renderer, 'Profil bearbeiten')).toHaveLength(0);
    expect(findByLabel(renderer, 'Konto löschen')).toHaveLength(0);

    mocks.profileApi.getMe.mockResolvedValueOnce({ profile, targets });
    pressByLabel(renderer, 'Erneut versuchen');
    await flush();

    expect(mocks.profileApi.getMe).toHaveBeenCalledTimes(2);
    expect(textNodes(renderer)).toContain('Alltag & Training');
    expect(findByLabel(renderer, 'Profil bearbeiten')).toHaveLength(1);
  });

  it('hides Bearbeiten when the request succeeds without a profile', async () => {
    mocks.profileApi.getMe.mockResolvedValue({ profile: null, targets: null });
    const { renderer } = await renderScreen();

    expect(text(renderer)).toContain('Noch kein Profil');
    expect(findByLabel(renderer, 'Profil bearbeiten')).toHaveLength(0);
    expect(findByLabel(renderer, 'Konto löschen')).toHaveLength(0);
    expect(findByLabel(renderer, 'Profil einrichten')).toHaveLength(0);
  });

  it('shows updated values after a refresh and keeps data with a snackbar when a refresh fails', async () => {
    mocks.profileApi.getMe.mockResolvedValueOnce({ profile, targets });
    const { renderer } = await renderScreen();

    mocks.profileApi.getMe.mockResolvedValueOnce({
      profile: { ...profile, goal: 'maintain' },
      targets,
    });
    await act(async () => {
      (refreshControls(renderer)[0]!.props.onRefresh as () => void)();
      await Promise.resolve();
    });
    await flush();
    expect(text(renderer)).toContain('Gewicht halten');

    mocks.profileApi.getMe.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      (refreshControls(renderer)[0]!.props.onRefresh as () => void)();
      await Promise.resolve();
    });
    await flush();

    expect(mocks.showSnackbar).toHaveBeenCalledWith({ message: 'Profil konnte nicht aktualisiert werden.' });
    expect(text(renderer)).toContain('Gewicht halten');
    expect(findByLabel(renderer, 'Profil bearbeiten')).toHaveLength(1);
  });
});
