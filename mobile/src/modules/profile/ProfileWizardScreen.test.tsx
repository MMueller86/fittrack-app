import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import ProfileWizardScreen from './ProfileWizardScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  profileApi: { calculatePreview: vi.fn(), createProfile: vi.fn() },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: vi.fn() },
  BackHandler: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  PanResponder: { create: () => ({ panHandlers: {} }) },
  Platform: { OS: 'android' },
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { setItem: vi.fn() } }));
vi.mock('../../shared/api/profileApi', () => ({ profileApi: mocks.profileApi }));
vi.mock('../../services/weightsService', () => ({ listWeights: () => Promise.resolve([]) }));
vi.mock('../../shared/components/BrandAsset', () => ({ BrandAsset: 'BrandAsset' }));
vi.mock('../../shared/components/InfoOverlay', () => ({ InfoOverlay: 'InfoOverlay' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));

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
    (n: ReactTestInstance) => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === label,
  )[0]!;
  act(() => (node.props.onPress as () => void)());
}

function pressByText(renderer: ReactTestRenderer, label: string) {
  const node = renderer.root.findAll(
    (n: ReactTestInstance) =>
      n.type === 'TouchableOpacity' &&
      n.findAll((c: ReactTestInstance) => c.type === 'Text').some((t: ReactTestInstance) => (t.props.children as unknown) === label),
  )[0]!;
  act(() => (node.props.onPress as () => void)());
}

describe('ProfileWizardScreen privacy access', () => {
  it('opens the Datenschutz text from the preview step without saving and keeps the inputs', async () => {
    mocks.profileApi.calculatePreview.mockResolvedValue({
      targets: {
        restDay: {
          calories: 2000,
          proteinG: 144,
          fatG: 70,
          carbsG: 220,
          fiberG: 30,
          macroRanges: {
            proteinG: { minG: 120, maxG: 160 },
            carbsG: { minG: 183, maxG: 223 },
          },
        },
        trainingDay: {
          calories: 2200,
          proteinG: 144,
          fatG: 75,
          carbsG: 250,
          fiberG: 30,
          macroRanges: {
            proteinG: { minG: 120, maxG: 160 },
            carbsG: { minG: 221, maxG: 261 },
          },
        },
      },
      calculationMeta: { bmr: 1700, pal: 1.4, goalAdjustment: 0 },
    });
    mocks.profileApi.createProfile.mockResolvedValue({});
    const onComplete = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ProfileWizardScreen isNewProfile onComplete={onComplete} onDismiss={vi.fn()} />);
      await Promise.resolve();
    });

    pressByText(renderer, 'Profil einrichten →');
    pressByText(renderer, 'Männlich');
    const inputs = renderer.root.findAll((n: ReactTestInstance) => n.type === 'TextInput');
    const [, age, height, weight, target] = inputs;
    act(() => (age!.props.onChangeText as (v: string) => void)('30'));
    act(() => (height!.props.onChangeText as (v: string) => void)('180'));
    act(() => (weight!.props.onChangeText as (v: string) => void)('80'));
    act(() => (target!.props.onChangeText as (v: string) => void)('75'));
    pressByText(renderer, 'Weiter');
    pressByText(renderer, 'Kenne ich nicht');
    pressByText(renderer, 'Überwiegend sitzend');
    pressByText(renderer, 'Weiter');
    pressByText(renderer, 'Weiter');
    pressByText(renderer, 'Gewicht halten');
    await act(async () => {
      pressByText(renderer, 'Vorschau');
      await Promise.resolve();
    });
    expect(texts(renderer)).toContain('Deine Ziele');
    const previewTexts = texts(renderer);
    expect(previewTexts.filter((value) => value === '120–160 g')).toHaveLength(2);
    expect(previewTexts).toContain('183–223 g');
    expect(previewTexts).toContain('221–261 g');
    expect(previewTexts).toContain('2000 kcal');
    expect(previewTexts).toContain('2200 kcal');
    expect(previewTexts).toContain('70 g');
    expect(previewTexts).toContain('75 g');
    expect(previewTexts.filter((value) => value === '30 g')).toHaveLength(2);

    pressByLabel(renderer, 'Datenschutzerklärung lesen');
    const privacy = texts(renderer);
    expect(privacy[0]).toBe('Datenschutzerklärung');
    expect(privacy).not.toContain('Deine Ziele');

    pressByLabel(renderer, 'Zurück');
    expect(texts(renderer)).toContain('Deine Ziele');
    expect(mocks.profileApi.createProfile).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      pressByText(renderer, 'Profil übernehmen');
      await Promise.resolve();
    });
    expect(mocks.profileApi.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        targetWeightKg: 75,
        activityLevel: 'sedentary',
        goal: 'maintain',
      }),
    );
  });

  it('opens the Datenschutz text from the welcome step and returns to the wizard', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ProfileWizardScreen isNewProfile onComplete={vi.fn()} onDismiss={vi.fn()} />);
      await Promise.resolve();
    });
    expect(texts(renderer)).toContain('Profil einrichten →');

    pressByLabel(renderer, 'Datenschutzerklärung lesen');
    const privacy = texts(renderer);
    expect(privacy[0]).toBe('Datenschutzerklärung');
    expect(privacy).not.toContain('Profil einrichten →');

    pressByLabel(renderer, 'Zurück');
    expect(texts(renderer)).toContain('Profil einrichten →');
  });
});
