import React, { type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { RecipeInstagramPreview } from './RecipeInstagramPreview';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native-reanimated', () => ({
  default: {
    View: 'Animated.View',
    Image: 'Animated.Image',
  },
  FadeIn: { duration: () => ({}) },
  FadeOut: { duration: () => ({}) },
}));

vi.mock('../../shared/components/Icon', () => ({
  Icon: 'Icon',
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  const Modal = ({ visible, children, ...props }: { visible: boolean; children?: ReactNode }) => (
    visible ? ReactModule.createElement('Modal', { ...props, visible }, children) : null
  );

  return {
    ActivityIndicator: 'ActivityIndicator',
    Modal,
    Pressable: 'Pressable',
    StyleSheet: {
      absoluteFillObject: {},
      create: <T,>(styles: T) => styles,
    },
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
  };
});

function getByLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = renderer.root.findAll(
    (node) => (node.type === 'TouchableOpacity' || node.type === 'Pressable')
      && node.props.accessibilityLabel === label,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one element with accessibilityLabel ${label}, found ${matches.length}`);
  }
  return matches[0]!;
}

async function renderPreview(overrides: Partial<React.ComponentProps<typeof RecipeInstagramPreview>> = {}) {
  const props: React.ComponentProps<typeof RecipeInstagramPreview> = {
    visible: true,
    previewUri: 'file:///cache/rendered.png',
    renderStatus: 'ready',
    renderStage: 'initial',
    assetStatus: 'idle',
    shareStatus: 'idle',
    canAdjustCrop: true,
    canChangeOptions: true,
    busy: false,
    onClose: vi.fn(),
    onAdjustCrop: vi.fn(),
    onChangeOptions: vi.fn(),
    onRetryRender: vi.fn(),
    onSaveAndShare: vi.fn(),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<RecipeInstagramPreview {...props} />);
  });
  return { renderer, props };
}

describe('RecipeInstagramPreview', () => {
  it('shows the rendered PNG URI with stable save and crop actions', async () => {
    const { renderer, props } = await renderPreview();

    const image = renderer.root.findAll((node) => node.type === 'Animated.Image')[0];
    if (!image) throw new Error('Expected the rendered preview image');
    expect(image.props.source).toEqual({ uri: 'file:///cache/rendered.png' });
    expect(image.props.style).toMatchObject({ width: '100%', height: '100%' });
    expect(renderer.root.findAll((node) => {
      if (node.type !== 'View') return false;
      const style = (node.props as Record<string, unknown>).style;
      return typeof style === 'object'
        && style !== null
        && 'aspectRatio' in style
        && style.aspectRatio === 1080 / 1350;
    })).toHaveLength(1);
    expect(getByLabel(renderer, 'Ausschnitt anpassen').props.disabled).toBe(false);
    expect(getByLabel(renderer, 'Bild speichern und teilen').props.disabled).toBe(false);

    await act(async () => {
      (getByLabel(renderer, 'Bild speichern und teilen').props.onPress as () => void)();
    });
    expect(props.onSaveAndShare).toHaveBeenCalledTimes(1);
  });

  it('keeps actions locked while a save/share promise is active', async () => {
    const { renderer } = await renderPreview({ busy: true });

    const closeButton = renderer.root.findAll(
      (node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'Vorschau schließen',
    )[0];
    if (!closeButton) throw new Error('Expected the preview close button');
    expect(closeButton.props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Ausschnitt anpassen').props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Bild speichern und teilen').props.disabled).toBe(true);
  });

  it('locks crop and options while replacing an existing preview', async () => {
    const { renderer } = await renderPreview({ renderStatus: 'loading', renderStage: 'final' });

    const image = renderer.root.findAll((node) => node.type === 'Animated.Image')[0];
    if (!image) throw new Error('Expected the existing rendered preview image');
    expect(image.props.source).toEqual({ uri: 'file:///cache/rendered.png' });
    expect(getByLabel(renderer, 'Ausschnitt anpassen').props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Instagram-Optionen ändern').props.disabled).toBe(true);
  });

  it('renders a loading state before a PNG URI exists', async () => {
    const { renderer } = await renderPreview({ previewUri: null, renderStatus: 'loading' });

    expect(renderer.root.findAll((node) => node.type === 'Animated.Image')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Vorschau wird erstellt…'))
      .toHaveLength(1);
  });
});