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
  recipeApi: { list: vi.fn() },
  completeAccountDeletionLocally: vi.fn(),
  showSnackbar: vi.fn(),
  listWeights: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: { OS: 'android' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Switch: 'Switch',
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
vi.mock('../../shared/api/recipeApi', () => ({ recipeApi: mocks.recipeApi }));
vi.mock('../../services/accountDeletionService', () => ({
  completeAccountDeletionLocally: mocks.completeAccountDeletionLocally,
}));
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

function findButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  return renderer.root.findAll(
    (node: ReactTestInstance) =>
      node.type === 'TouchableOpacity' && node.props.accessibilityLabel === label,
  )[0]!;
}

function findType(renderer: ReactTestRenderer, type: string): ReactTestInstance {
  return renderer.root.findAll((node: ReactTestInstance) => node.type === type)[0]!;
}

function pressButton(renderer: ReactTestRenderer, label: string) {
  (findButton(renderer, label).props.onPress as () => void)();
}

function changeText(instance: ReactTestInstance, value: string) {
  (instance.props.onChangeText as (text: string) => void)(value);
}

async function openDeletion(renderer: ReactTestRenderer) {
  await act(async () => {
    pressButton(renderer, 'Konto löschen');
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listWeights.mockResolvedValue([]);
  mocks.recipeApi.list.mockResolvedValue({ recipes: [] });
  mocks.profileApi.deleteProfile.mockResolvedValue(undefined);
  mocks.completeAccountDeletionLocally.mockResolvedValue(undefined);
});

describe('ProfileEditScreen', () => {
  it('opens the exact confirmation and requires case-sensitive DELETE without sending on open or dismissal', async () => {
    const { renderer } = renderScreen(profile);
    expect(mocks.profileApi.deleteProfile).not.toHaveBeenCalled();

    await openDeletion(renderer);

    expect(mocks.recipeApi.list).toHaveBeenCalledTimes(1);
    expect(mocks.profileApi.deleteProfile).not.toHaveBeenCalled();
    expect(allText(renderer)).toContain('Profil endgültig löschen?');
    expect(allText(renderer)).toContain(
      'Dein FitTrack-Profil und deine persönlichen FitTrack-Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.\n\nGib zur Bestätigung DELETE ein.',
    );
    expect(allText(renderer)).toContain(
      'Nach erfolgreicher Kontolöschung versucht die App, FitTrack-Anmeldetokens, lokale Sync-Warteschlangen und das lokale Diagnoseprotokoll von deinem Gerät zu entfernen. Wenn das auf deinem Gerät nicht klappt, zeigt FitTrack dir einen Hinweis. Bereits in Health Connect gespeicherte Einträge und Berechtigungen bleiben davon unberührt.',
    );
    expect(allText(renderer)).not.toContain('entfernen wir auch deine FitTrack-Anmeldetokens');
    expect(allText(renderer)).not.toContain('Microsoft-Entra');
    expect(allText(renderer)).not.toContain('manuell');
    expect(allText(renderer)).not.toContain('Auch meine Community Rezepte löschen');
    expect(allText(renderer)).not.toContain('Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten');

    const confirmation = renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Löschbestätigung',
    )[0]!;
    const confirm = findButton(renderer, 'Endgültig löschen');
    expect(confirm.props.accessibilityState).toEqual({ disabled: true });
    act(() => changeText(confirmation, 'delete'));
    expect(findButton(renderer, 'Endgültig löschen').props.accessibilityState).toEqual({ disabled: true });
    act(() => changeText(confirmation, 'DELETE'));
    expect(findButton(renderer, 'Endgültig löschen').props.accessibilityState).toEqual({ disabled: false });

    const backdrop = renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Bestätigung schließen',
    )[0]!;
    act(() => (backdrop.props.onPress as () => void)());
    expect(renderer.root.findAll((node: ReactTestInstance) => node.type === 'Modal')).toHaveLength(0);
    expect(mocks.profileApi.deleteProfile).not.toHaveBeenCalled();

    await openDeletion(renderer);
    const deletionModal = findType(renderer, 'Modal');
    const cancel = deletionModal.findAll(
      (node: ReactTestInstance) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'Abbrechen',
    )[0]!;
    act(() => (cancel.props.onPress as () => void)());
    expect(renderer.root.findAll((node: ReactTestInstance) => node.type === 'Modal')).toHaveLength(0);
    expect(mocks.profileApi.deleteProfile).not.toHaveBeenCalled();

    await openDeletion(renderer);
    const modal = findType(renderer, 'Modal');
    act(() => (modal.props.onRequestClose as () => void)());
    expect(renderer.root.findAll((node: ReactTestInstance) => node.type === 'Modal')).toHaveLength(0);
    expect(mocks.profileApi.deleteProfile).not.toHaveBeenCalled();
  });

  it('does not render the delete action when creating a new profile', () => {
    const { renderer } = renderScreen(null);

    expect(allText(renderer)).not.toContain('Konto löschen');
  });

  it('shows the community choice only for published recipes and resets it to Nein on each open', async () => {
    mocks.recipeApi.list.mockResolvedValue({
      recipes: [{ visibility: 'community', communityPublication: { displayNameConsent: false } }],
    });
    const { renderer } = renderScreen(profile);

    await openDeletion(renderer);

    expect(allText(renderer)).toContain('Auch meine Community Rezepte löschen');
    expect(allText(renderer)).toContain(
      'Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten, sofern du sie nicht ebenfalls löschst.',
    );
    let toggle = findType(renderer, 'Switch');
    expect(toggle.props.value).toBe(false);
    act(() => (toggle.props.onValueChange as (value: boolean) => void)(true));
    expect(findType(renderer, 'Switch').props.value).toBe(true);
    expect(allText(renderer)).toContain('Ja');

    act(() => pressButton(renderer, 'Abbrechen'));
    await openDeletion(renderer);
    toggle = findType(renderer, 'Switch');
    expect(toggle.props.value).toBe(false);
    expect(allText(renderer)).toContain('Nein');
  });

  it('retries the unchanged full payload and resets local state only after the retry succeeds', async () => {
    mocks.recipeApi.list.mockResolvedValue({
      recipes: [{ visibility: 'community', communityPublication: { displayNameConsent: false } }],
    });
    mocks.profileApi.deleteProfile
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { error: 'profile_deletion_in_progress' } },
      })
      .mockResolvedValueOnce(undefined);
    const { renderer } = renderScreen(profile);
    await openDeletion(renderer);

    const confirmation = renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Löschbestätigung',
    )[0]!;
    act(() => changeText(confirmation, 'DELETE'));
    act(() => (findType(renderer, 'Switch').props.onValueChange as (value: boolean) => void)(true));
    await act(async () => {
      pressButton(renderer, 'Endgültig löschen');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(allText(renderer)).toContain('Die Löschung konnte nicht durchgeführt werden. Bitte versuche es erneut.');
    expect(allText(renderer)).not.toContain('läuft bereits');
    expect(mocks.completeAccountDeletionLocally).not.toHaveBeenCalled();
    expect(confirmation.props.editable).toBe(false);
    const firstPayload = mocks.profileApi.deleteProfile.mock.calls[0]![0];
    expect(firstPayload).toEqual({ confirmation: 'DELETE', deleteCommunityRecipes: true });

    await act(async () => {
      pressButton(renderer, 'Erneut versuchen');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.profileApi.deleteProfile).toHaveBeenCalledTimes(2);
    expect(mocks.profileApi.deleteProfile.mock.calls[1]![0]).toBe(firstPayload);
    expect(mocks.completeAccountDeletionLocally).toHaveBeenCalledTimes(1);
  });

  it('does not offer a backend retry after server deletion when local cleanup fails', async () => {
    mocks.completeAccountDeletionLocally.mockResolvedValue(true);
    const { renderer } = renderScreen(profile);
    await openDeletion(renderer);
    const confirmation = renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Löschbestätigung',
    )[0]!;
    act(() => changeText(confirmation, 'DELETE'));

    await act(async () => {
      pressButton(renderer, 'Endgültig löschen');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.profileApi.deleteProfile).toHaveBeenCalledTimes(1);
    expect(mocks.completeAccountDeletionLocally).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll((node: ReactTestInstance) => node.type === 'Modal')).toHaveLength(0);
    expect(mocks.profileApi.deleteProfile).toHaveBeenCalledTimes(1);
    expect(allText(renderer)).not.toContain('Erneut versuchen');
    expect(allText(renderer)).not.toContain('Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.');
  });

  it('locks inputs and duplicate submits while deletion is running', async () => {
    let resolveDeletion!: () => void;
    mocks.profileApi.deleteProfile.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDeletion = resolve; }),
    );
    const { renderer } = renderScreen(profile);
    await openDeletion(renderer);
    const confirmation = renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Löschbestätigung',
    )[0]!;
    act(() => changeText(confirmation, 'DELETE'));

    await act(async () => {
      pressButton(renderer, 'Endgültig löschen');
      await Promise.resolve();
    });

    expect(allText(renderer)).toContain('Dein Profil wird gelöscht …');
    expect(confirmation.props.editable).toBe(false);
    const cancelButtons = renderer.root.findAll(
      (node: ReactTestInstance) =>
        node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'Abbrechen',
    );
    expect(cancelButtons.at(-1)?.props.disabled).toBe(true);
    await act(async () => {
      pressButton(renderer, 'Endgültig löschen');
      resolveDeletion();
      await Promise.resolve();
    });
    expect(mocks.profileApi.deleteProfile).toHaveBeenCalledTimes(1);
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
