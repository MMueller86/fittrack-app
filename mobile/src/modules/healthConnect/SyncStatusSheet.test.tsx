import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  StyleSheet: { absoluteFillObject: {}, create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: () => null }));

import { SyncStatusSheet } from './SyncStatusSheet';
import { SYNC_STATUS_COPY } from './healthConnectCopy';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const weightSyncStatus = {
  enabled: true,
  permissionRevoked: false,
  pendingDeleteCount: 0,
};

const nutritionSyncStatus = {
  enabled: false,
  permissionRevoked: true,
  pendingDeleteCount: 2,
  lastSuccessfulSyncAt: '2026-10-22T12:34:00.000Z',
};

type WeightSyncStatus = ReturnType<typeof import('../../services/health/healthSyncService').healthSyncService.getSyncStatus>;
type NutritionSyncStatus = ReturnType<typeof import('../../services/health/nutritionSyncService').nutritionSyncService.getSyncStatus>;

function visibleText(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAll((node) => node.type === 'Text')
    .map((node) => {
      const value = node.props.children as string | number | undefined;
      return value === undefined ? '' : String(value);
    });
}

function renderSheet(
  weightStatus: WeightSyncStatus = weightSyncStatus,
  nutritionStatus: NutritionSyncStatus = nutritionSyncStatus,
): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <SyncStatusSheet
        visible
        weightSyncStatus={weightStatus}
        nutritionSyncStatus={nutritionStatus}
        onClose={vi.fn()}
      />,
    );
  });
  return renderer;
}

describe('SyncStatusSheet', () => {
  it('shows the weight status fields independently, including zero and no success timestamp', () => {
    const renderer = renderSheet();
    const text = visibleText(renderer);

    expect(text).toContain('Gewicht');
    expect(text).toContain('Aktiviert');
    expect(text).toContain('Nicht als entzogen gemeldet');
    expect(text).toContain('0');
    expect(text).toContain('Noch kein erfolgreicher Abgleich');
    expect(text).not.toContain('Erteilt');
    expect(text).not.toContain('Bestätigt');
    actUnmount(renderer);
  });

  it('shows nutrition status fields independently, including revoked permission and its timestamp', () => {
    const renderer = renderSheet();
    const text = visibleText(renderer);

    expect(text).toContain('Ernährung');
    expect(text).toContain('Deaktiviert');
    expect(text).toContain('Entzogen');
    expect(text).toContain('2');
    expect(text.join(' ')).toContain('22.10.2026');
    expect(text.join(' ')).not.toMatch(/temporäre Fehler|permanente Fehler|stack|Error:/i);
    actUnmount(renderer);
  });

  it('renders German aggregate status copy without emoji', () => {
    const renderer = renderSheet();
    const text = visibleText(renderer).join(' ');

    for (const copy of Object.values(SYNC_STATUS_COPY)) expect(text).toContain(copy);
    expect(text).not.toMatch(/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u);
    actUnmount(renderer);
  });

  it('does not render arbitrary queue entries, raw error details, or stack text', () => {
    const noisyWeightStatus = {
      ...weightSyncStatus,
      pendingOperations: [{
        operation: 'upsert',
        entry: { id: 'raw-queue-id-marker', name: 'raw-queue-entry-marker', value: 81.2 },
      }],
      errorDetail: 'raw-error-detail-marker: provider rejected private-entry-marker',
      stack: 'raw-stack-marker at syncProvider (sync-service.js:91:7)',
    };
    const renderer = renderSheet(noisyWeightStatus);
    const text = visibleText(renderer).join(' ');

    expect(text).not.toMatch(/raw-queue-id-marker|raw-queue-entry-marker|raw-error-detail-marker|private-entry-marker|raw-stack-marker/);
    actUnmount(renderer);
  });
});

function actUnmount(renderer: ReturnType<typeof create>): void {
  act(() => renderer.unmount());
}