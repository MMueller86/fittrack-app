import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

const mocks = vi.hoisted(() => ({
  getAvailability: vi.fn(),
  loadWeightState: vi.fn(),
  getWeightStatus: vi.fn(),
  enableWeightSync: vi.fn(),
  disableWeightSync: vi.fn(),
  runWeightExport: vi.fn(),
  loadNutritionState: vi.fn(),
  getNutritionStatus: vi.fn(),
  enableNutritionSync: vi.fn(),
  disableNutritionSync: vi.fn(),
  runNutritionExport: vi.fn(),
  getProfile: vi.fn(),
  listWeights: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Linking: { openURL: vi.fn() },
  Modal: 'Modal',
  Platform: { OS: 'android' },
  ScrollView: 'ScrollView',
  StyleSheet: { absoluteFill: {}, create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (factory: () => object) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
vi.mock('../../shared/api/profileApi', () => ({ profileApi: { getMe: mocks.getProfile } }));
vi.mock('../../services/weightsService', () => ({ listWeights: mocks.listWeights }));
vi.mock('../../services/health/healthPlatformService', () => ({
  healthPlatformService: { getAvailability: mocks.getAvailability },
}));
vi.mock('../../services/health/healthSyncService', () => ({
  healthSyncService: {
    loadState: mocks.loadWeightState,
    getSyncStatus: mocks.getWeightStatus,
    enableSync: mocks.enableWeightSync,
    disableSync: mocks.disableWeightSync,
    runFullExport: mocks.runWeightExport,
  },
}));
vi.mock('../../services/health/nutritionSyncService', () => ({
  nutritionSyncService: {
    loadState: mocks.loadNutritionState,
    getSyncStatus: mocks.getNutritionStatus,
    enableSync: mocks.enableNutritionSync,
    disableSync: mocks.disableNutritionSync,
    runFullExport: mocks.runNutritionExport,
  },
}));
vi.mock('../../services/health/MockHealthPlatformService', () => ({
  MockHealthPlatformService: class {},
}));
vi.mock('../../shared/components/ConfirmSheet', () => ({ ConfirmSheet: () => null }));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: () => null,
  useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
}));
vi.mock('../../shared/components/Icon', () => ({ Icon: () => null }));

import HealthConnectScreen from './HealthConnectScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type SyncStatus = ReturnType<typeof import('../../services/health/healthSyncService').healthSyncService.getSyncStatus>;
type ScreenProps = NativeStackScreenProps<ProfileStackParamList, 'HealthConnect'>;

const weightStatus: SyncStatus = {
  enabled: true,
  permissionRevoked: false,
  pendingDeleteCount: 0,
};
const nutritionStatus: SyncStatus = {
  enabled: false,
  permissionRevoked: true,
  pendingDeleteCount: 2,
  lastSuccessfulSyncAt: '2026-10-22T12:34:00.000Z',
};

const activeRenderers: ReactTestRenderer[] = [];

function textContent(node: ReactTestInstance): string {
  return node.findAll((child) => child.type === 'Text')
    .map((child) => {
      const value = child.props.children as string | number | undefined;
      return value === undefined ? '' : String(value);
    })
    .join('');
}

function findButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
    && textContent(node) === label)[0];
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

async function renderScreen(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    const navigation = { goBack: vi.fn() } as unknown as ScreenProps['navigation'];
    const route = {
      key: 'health-connect',
      name: 'HealthConnect',
      params: undefined,
    } as ScreenProps['route'];
    renderer = create(
      <HealthConnectScreen
        navigation={navigation}
        route={route}
      />,
    );
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  });
  activeRenderers.push(renderer);
  return renderer;
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getAvailability.mockResolvedValue({ status: 'available' });
  mocks.loadWeightState.mockResolvedValue(undefined);
  mocks.getWeightStatus.mockReturnValue(weightStatus);
  mocks.loadNutritionState.mockResolvedValue(undefined);
  mocks.getNutritionStatus.mockReturnValue(nutritionStatus);
  mocks.getProfile.mockResolvedValue({ profile: null });
  mocks.listWeights.mockResolvedValue([]);
  mocks.runWeightExport.mockResolvedValue(true);
  mocks.runNutritionExport.mockResolvedValue(true);
});

afterEach(() => {
  while (activeRenderers.length > 0) {
    const renderer = activeRenderers.pop()!;
    act(() => renderer.unmount());
  }
});

describe('HealthConnectScreen status presentation', () => {
  it('opens aggregate status without relying on a successful-sync timestamp and omits diagnostics', async () => {
    const renderer = await renderScreen();

    expect(renderer.root.findAll((node) => node.type === 'Text').map(textContent).join(' '))
      .not.toMatch(/SYNC LOG|Log leeren|Stack trace|temporäre Fehler|permanente Fehler/i);

    await act(async () => {
      (findButton(renderer, 'Synchronisationsstatus anzeigen').props.onPress as () => void)();
    });

    const statusModal = renderer.root.findAll((node) => node.type === 'Modal')[0]!;
    expect(statusModal.props.visible).toBe(true);
    const statusText = statusModal.findAll((node: ReactTestInstance) => node.type === 'Text')
      .map(textContent).join(' ');
    expect(statusText).toContain('Gewicht');
    expect(statusText).toContain('Ernährung');
    expect(statusText).toContain('Nicht als entzogen gemeldet');
    expect(statusText).toContain('Noch kein erfolgreicher Abgleich');
  });

  it('keeps a failed manual export scoped to its action instead of showing attempt status', async () => {
    let resolveExport!: (result: boolean) => void;
    mocks.runWeightExport.mockReturnValueOnce(new Promise<boolean>((resolve) => {
      resolveExport = resolve;
    }));
    const renderer = await renderScreen();

    await act(async () => {
      (findButton(renderer, 'Alle Gewichtsdaten erneut exportieren').props.onPress as () => void)();
      for (let turn = 0; turn < 4; turn += 1) await Promise.resolve();
    });

    expect(renderer.root.findAll((node) => node.type === 'ActivityIndicator')).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === 'Modal')[0]!.props.visible).toBe(false);

    await act(async () => {
      (findButton(renderer, 'Synchronisationsstatus anzeigen').props.onPress as () => void)();
    });

    const statusModal = renderer.root.findAll((node) => node.type === 'Modal')[0]!;
    expect(statusModal.props.visible).toBe(true);
    const statusText = statusModal.findAll((node: ReactTestInstance) => node.type === 'Text')
      .map(textContent).join(' ');
    expect(statusText).not.toMatch(/Synchronisation läuft|Abgleich läuft|Abgleich fehlgeschlagen|Letzter Versuch/i);

    await act(async () => {
      resolveExport(false);
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    });

    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      message: 'Der Voll-Export war nicht vollständig. FitTrack versucht es beim nächsten Abgleich erneut.',
    });
    expect(statusModal.props.visible).toBe(true);
    expect(statusText).not.toMatch(/Synchronisation läuft|Abgleich läuft|Abgleich fehlgeschlagen|Letzter Versuch/i);
    expect(renderer.root.findAll((node) => node.type === 'Text').map(textContent).join(' '))
      .not.toMatch(/Synchronisation läuft|Abgleich fehlgeschlagen|Letzter Versuch/i);
  });
});