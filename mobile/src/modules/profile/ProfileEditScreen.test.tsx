import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileEditScreen from './ProfileEditScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  profileApi: {
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
  },
  showSnackbar: vi.fn(),
  listWeights: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'android' },
  ScrollView: 'ScrollView',
  StyleSheet: {
    absoluteFillObject: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../shared/api/profileApi', () => ({ profileApi: mocks.profileApi }));
vi.mock('../../services/weightsService', () => ({ listWeights: mocks.listWeights }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/InfoOverlay', () => ({ InfoOverlay: 'InfoOverlay' }));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: 'Snackbar',
  useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
}));

const profile = {
  displayName: 'Mika',
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

function renderScreen(existing: unknown) {
  const navigation = { goBack: vi.fn() };
  const props = { route: { params: { profile: existing } }, navigation } as unknown as React.ComponentProps<
    typeof ProfileEditScreen
  >;
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<ProfileEditScreen {...props} />);
  });
  return { renderer, navigation };
}

function allText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((n) => n.type === 'Text')
    .map((n) => {
      const children: unknown = n.props.children;
      if (Array.isArray(children)) return children.filter((c) => typeof c === 'string').join('');
      return typeof children === 'string' ? children : '';
    })
    .join(' | ');
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listWeights.mockResolvedValue([]);
});

describe('ProfileEditScreen', () => {
  it('replaces the delete action with a disabled, non-interactive Konto-löschen placeholder', () => {
    const { renderer } = renderScreen(profile);

    const text = allText(renderer);
    expect(text).toContain('Konto löschen');
    expect(text).toContain('Wird später verfügbar');
    expect(text).not.toContain('Profil löschen');

    const placeholder = renderer.root.findAll(
      (n: ReactTestInstance) =>
        n.type === 'View' && n.props.accessibilityLabel === 'Konto löschen, Wird später verfügbar',
    )[0]!;
    expect(placeholder.props.accessibilityState).toEqual({ disabled: true });
    expect(placeholder.props.onPress).toBeUndefined();
    expect(
      renderer.root.findAll((n) => n.type === 'TouchableOpacity' && /löschen/i.test(String(n.props.accessibilityLabel))),
    ).toHaveLength(0);
    expect(mocks.profileApi.deleteProfile).not.toHaveBeenCalled();
  });

  it('does not render the placeholder when creating a new profile', () => {
    const { renderer } = renderScreen(null);

    expect(allText(renderer)).not.toContain('Konto löschen');
  });

  it('shows an InfoOverlay instead of a system alert when saving fails', async () => {
    mocks.profileApi.updateProfile.mockRejectedValue(new Error('network'));
    const { renderer, navigation } = renderScreen(profile);

    const overlayVisible = () =>
      renderer.root.findAll((n: ReactTestInstance) => n.type === 'InfoOverlay')[0]!.props.visible;
    expect(overlayVisible()).toBe(false);

    const save = renderer.root.findAll(
      (n: ReactTestInstance) => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === 'Speichern',
    )[0]!;
    await act(async () => {
      (save.props.onPress as () => void)();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.profileApi.updateProfile).toHaveBeenCalledTimes(1);
    expect(overlayVisible()).toBe(true);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
