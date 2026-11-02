import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { FramedImageEditor, type FramedImageEditorProps } from './FramedImageEditor';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const all = (root: ReactTestInstance, type: string): ReactTestInstance[] => root.findAll((node) => node.type === type);
const one = (root: ReactTestInstance, type: string): ReactTestInstance => {
  const matches = all(root, type);
  if (matches.length !== 1) throw new Error(`Expected one ${type}, found ${matches.length}`);
  return matches[0]!;
};

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Modal: 'Modal',
  StyleSheet: {
    absoluteFill: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
// Gestures are not exercised; the chain only needs to accept the configuration calls.
vi.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  for (const name of ['enabled', 'onStart', 'onUpdate']) chain[name] = () => chain;
  return {
    Gesture: { Pan: () => chain, Pinch: () => chain, Simultaneous: () => chain },
    GestureDetector: 'GestureDetector',
    GestureHandlerRootView: 'GestureHandlerRootView',
  };
});
vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  return {
    default: { Image: 'AnimatedImage' },
    useSharedValue: <T,>(initial: T) => React.useRef({ value: initial }).current,
    useAnimatedStyle: () => ({}),
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../components/Icon', () => ({ Icon: 'Icon' }));

function editorProps(overrides: Partial<FramedImageEditorProps> = {}): FramedImageEditorProps {
  return {
    visible: true,
    imageUri: 'file:///photo.jpg',
    aspectRatio: 1,
    title: 'Foto zuschneiden',
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
}

async function render(props: FramedImageEditorProps): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<FramedImageEditor {...props} />);
  });
  return renderer;
}

function texts(renderer: ReactTestRenderer): string[] {
  return all(renderer.root, 'Text').map((node) => [node.props.children].flat().join(''));
}

function button(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = renderer.root.findAll(
    (node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === label,
  );
  if (matches.length !== 1) throw new Error(`Expected one button "${label}", found ${matches.length}`);
  return matches[0]!;
}

const confirmButton = (r: ReactTestRenderer) => button(r, 'Foto zuschneiden übernehmen');

async function loadImage(renderer: ReactTestRenderer, width: number, height: number) {
  await act(async () => {
    (one(renderer.root, 'Image').props.onLoad as (e: unknown) => void)({
      nativeEvent: { source: { width, height } },
    });
  });
}

describe('FramedImageEditor', () => {
  it('disables confirm and shows a spinner until the image has loaded', async () => {
    const props = editorProps();
    const renderer = await render(props);

    expect(confirmButton(renderer).props.disabled).toBe(true);
    expect(all(renderer.root, 'ActivityIndicator')).toHaveLength(1);
    expect(all(renderer.root, 'AnimatedImage')).toHaveLength(0);

    await act(async () => {
      (confirmButton(renderer).props.onPress as () => void)();
    });
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('enables confirm after load and returns the initial crop with the image size', async () => {
    const crop = { focusX: 0.2, focusY: 0.8, zoom: 1.5 };
    const props = editorProps({ initialCrop: crop });
    const renderer = await render(props);
    await loadImage(renderer, 4000, 3000);

    expect(confirmButton(renderer).props.disabled).toBe(false);
    expect(all(renderer.root, 'AnimatedImage')).toHaveLength(1);
    expect(all(renderer.root, 'ActivityIndicator')).toHaveLength(0);

    await act(async () => {
      (confirmButton(renderer).props.onPress as () => void)();
    });

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    const [result, size] = (props.onConfirm as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(size).toEqual({ width: 4000, height: 3000 });
    expect(result.zoom).toBeCloseTo(crop.zoom, 5);
    expect(result.focusX).toBeCloseTo(crop.focusX, 5);
    expect(result.focusY).toBeCloseTo(crop.focusY, 5);
  });

  it('falls back to a centered, unzoomed crop without initialCrop', async () => {
    const props = editorProps();
    const renderer = await render(props);
    await loadImage(renderer, 4000, 3000);
    await act(async () => {
      (confirmButton(renderer).props.onPress as () => void)();
    });

    const [result] = (props.onConfirm as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(result.zoom).toBe(1);
    expect(result.focusX).toBeCloseTo(0.5, 5);
    expect(result.focusY).toBeCloseTo(0.5, 5);
  });

  it('shows an error and keeps confirm disabled when the image fails to load', async () => {
    const props = editorProps();
    const renderer = await render(props);
    await act(async () => {
      (one(renderer.root, 'Image').props.onError as () => void)();
    });

    expect(texts(renderer)).toContain('Das Bild konnte nicht geladen werden.');
    expect(confirmButton(renderer).props.disabled).toBe(true);
    expect(all(renderer.root, 'AnimatedImage')).toHaveLength(0);
  });

  it('treats invalid image dimensions as a load error', async () => {
    const renderer = await render(editorProps());
    await loadImage(renderer, 0, 3000);

    expect(texts(renderer)).toContain('Das Bild konnte nicht geladen werden.');
    expect(confirmButton(renderer).props.disabled).toBe(true);
  });

  it('calls onCancel from the cancel button, the close icon and the back request', async () => {
    const props = editorProps();
    const renderer = await render(props);

    await act(async () => {
      (button(renderer, 'Foto zuschneiden abbrechen').props.onPress as () => void)();
      (button(renderer, 'Foto zuschneiden schließen').props.onPress as () => void)();
      (one(renderer.root, 'Modal').props.onRequestClose as () => void)();
    });

    expect(texts(renderer)).toContain('Abbrechen');
    expect(props.onCancel).toHaveBeenCalledTimes(3);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('renders the overlay inside the frame with the frame dimensions', async () => {
    const overlay = vi.fn((_frame: { width: number; height: number }) => React.createElement('OverlayMarker'));
    const renderer = await render(editorProps({ overlay }));

    expect(all(renderer.root, 'OverlayMarker')).toHaveLength(1);
    const frame = overlay.mock.calls[0]![0] as { width: number; height: number };
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.width / frame.height).toBeCloseTo(1, 5);
  });

  it('shows the title and passes the visibility to the modal', async () => {
    const renderer = await render(editorProps({ visible: false, imageUri: null }));

    expect(one(renderer.root, 'Modal').props.visible).toBe(false);
    expect(texts(renderer)).toContain('Foto zuschneiden');
    expect(all(renderer.root, 'Image')).toHaveLength(0);
    expect(confirmButton(renderer).props.disabled).toBe(true);
  });
});
