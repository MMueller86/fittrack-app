import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmSheet } from './ConfirmSheet';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  Modal: 'Modal',
  StyleSheet: {
    absoluteFillObject: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('./Icon', () => ({ Icon: 'Icon' }));

function findCheckbox(renderer: ReactTestRenderer): ReactTestInstance {
  const matches = renderer.root.findAll(
    (node) => node.type === 'TouchableOpacity' && node.props.accessibilityRole === 'checkbox',
  );
  if (matches.length !== 1) throw new Error(`Expected one checkbox, found ${matches.length}`);
  return matches[0]!;
}

function ControlledConfirmSheet() {
  const [checked, setChecked] = React.useState(false);
  return (
    <ConfirmSheet
      visible
      title="Rezept veröffentlichen?"
      actions={[]}
      checkbox={{
        label: 'Meinen FitTrack-Anzeigenamen für dieses Rezept anzeigen',
        checked,
        onChange: setChecked,
      }}
      onClose={() => undefined}
    />
  );
}

describe('ConfirmSheet checkbox', () => {
  it('exposes and toggles its accessible checked state', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ControlledConfirmSheet />);
    });

    const unchecked = findCheckbox(renderer);
    expect(unchecked.props.accessibilityLabel).toBe('Meinen FitTrack-Anzeigenamen für dieses Rezept anzeigen');
    expect(unchecked.props.accessibilityState).toEqual({ checked: false });

    await act(async () => {
      (unchecked.props.onPress as (() => void) | undefined)?.();
    });

    expect(findCheckbox(renderer).props.accessibilityState).toEqual({ checked: true });
    expect(renderer.root.findAll((node) => node.type === 'Icon')).toHaveLength(1);
  });
});