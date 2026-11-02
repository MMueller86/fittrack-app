import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FramedCameraCapture } from './FramedCameraCapture';
import { getCaptureFrame, getPreviewSourceRect } from './frameCropMath';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const all = (root: ReactTestInstance, type: string): ReactTestInstance[] => root.findAll((node) => node.type === type);

const mocks = vi.hoisted(() => ({
  takePicture: vi.fn(),
  requestPermission: vi.fn(),
  permission: { current: null as { granted: boolean; canAskAgain: boolean } | null },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: {
    absoluteFill: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
vi.mock('expo-camera', async () => {
  const React = await import('react');
  return {
    CameraView: React.forwardRef((props: object, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mocks.takePicture }));
      return React.createElement('CameraView', props);
    }),
    useCameraPermissions: () => [mocks.permission.current, mocks.requestPermission],
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 10 }) }));
vi.mock('../components/Icon', () => ({ Icon: 'Icon' }));

const ASPECT = 4 / 3;

function props(overrides: Partial<React.ComponentProps<typeof FramedCameraCapture>> = {}) {
  return {
    aspectRatio: ASPECT,
    permissionPurpose: 'ein Rezeptfoto aufzunehmen',
    onClose: vi.fn(),
    onCaptured: vi.fn(),
    ...overrides,
  };
}

async function render(p: ReturnType<typeof props>): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<FramedCameraCapture {...p} />);
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

async function press(renderer: ReactTestRenderer, label: string) {
  await act(async () => {
    (button(renderer, label).props.onPress as () => void)();
  });
}

const hasCamera = (r: ReactTestRenderer) => all(r.root, 'CameraView').length > 0;

beforeEach(() => {
  mocks.takePicture.mockReset();
  mocks.requestPermission.mockReset();
  mocks.permission.current = { granted: true, canAskAgain: true };
});

describe('FramedCameraCapture permission', () => {
  it('shows the preparing state while the permission is still unknown', async () => {
    mocks.permission.current = null;
    const renderer = await render(props());

    expect(texts(renderer)).toContain('Kamera wird vorbereitet…');
    expect(hasCamera(renderer)).toBe(false);
    expect(mocks.requestPermission).not.toHaveBeenCalled();
  });

  it('renders the camera and capture controls when permission is granted', async () => {
    const renderer = await render(props());

    expect(hasCamera(renderer)).toBe(true);
    expect(texts(renderer)).toEqual(expect.arrayContaining(['Foto aufnehmen', 'Motiv im Rahmen platzieren']));
    expect(texts(renderer)).not.toContain('Kein Kamerazugriff');
    expect(button(renderer, 'Foto aufnehmen')).toBeDefined();
  });

  it('requests the permission once when it can be asked and shows the denial with the purpose', async () => {
    mocks.permission.current = { granted: false, canAskAgain: true };
    mocks.requestPermission.mockResolvedValue({ granted: false });
    const p = props();
    const renderer = await render(p);

    expect(mocks.requestPermission).toHaveBeenCalledTimes(1);
    expect(hasCamera(renderer)).toBe(false);
    expect(texts(renderer)).toEqual(
      expect.arrayContaining([
        'Kein Kamerazugriff',
        'FitTrack benötigt Kamerazugriff, um ein Rezeptfoto aufzunehmen.',
        'Erneut versuchen',
        'Abbrechen',
      ]),
    );

    await press(renderer, 'Kamera abbrechen');
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the camera when the request is granted', async () => {
    mocks.permission.current = { granted: false, canAskAgain: true };
    // The real hook updates its value after the grant; mirror that.
    mocks.requestPermission.mockImplementation(async () => {
      mocks.permission.current = { granted: true, canAskAgain: true };
      return { granted: true };
    });
    const renderer = await render(props());

    expect(hasCamera(renderer)).toBe(true);
  });

  it('treats a failing request as denied', async () => {
    mocks.permission.current = { granted: false, canAskAgain: true };
    mocks.requestPermission.mockRejectedValue(new Error('nope'));
    const renderer = await render(props());

    expect(texts(renderer)).toContain('Kein Kamerazugriff');
  });

  it('points to the device settings without requesting when it cannot be asked again', async () => {
    mocks.permission.current = { granted: false, canAskAgain: false };
    const renderer = await render(props());

    expect(mocks.requestPermission).not.toHaveBeenCalled();
    expect(texts(renderer)).toEqual(
      expect.arrayContaining([
        'Kein Kamerazugriff',
        'Bitte erlaube FitTrack den Kamerazugriff in den Geräteeinstellungen.',
      ]),
    );
  });

  it('requests the permission again after "Erneut versuchen"', async () => {
    mocks.permission.current = { granted: false, canAskAgain: true };
    mocks.requestPermission.mockResolvedValue({ granted: false });
    const renderer = await render(props());
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1);

    await press(renderer, 'Kameraberechtigung erneut versuchen');

    expect(mocks.requestPermission).toHaveBeenCalledTimes(2);
  });
});

describe('FramedCameraCapture capture', () => {
  it('reports the photo with its size and the frame rectangle', async () => {
    mocks.takePicture.mockResolvedValue({ uri: 'file:///photo.jpg', width: 4000, height: 3000 });
    const p = props();
    const renderer = await render(p);
    await press(renderer, 'Foto aufnehmen');

    const frame = getCaptureFrame(ASPECT, 400, 800, 20, 10);
    const frameRect = getPreviewSourceRect({ width: 4000, height: 3000 }, { width: 400, height: 800 }, frame);
    expect(p.onCaptured).toHaveBeenCalledTimes(1);
    expect(p.onCaptured).toHaveBeenCalledWith({
      uri: 'file:///photo.jpg',
      mime: 'image/jpeg',
      width: 4000,
      height: 3000,
      frameRect,
    });
    expect(frameRect.width).toBeGreaterThan(0);
    expect(frameRect.width / frameRect.height).toBeCloseTo(ASPECT, 5);
    expect(texts(renderer)).not.toContain('Das Foto konnte nicht aufgenommen werden.');
  });

  it.each([
    ['without URI', { width: 10, height: 10 }],
    ['without dimensions', { uri: 'file:///photo.jpg' }],
  ])('shows an error and does not report a picture %s', async (_name, picture) => {
    mocks.takePicture.mockResolvedValue(picture);
    const p = props();
    const renderer = await render(p);
    await press(renderer, 'Foto aufnehmen');

    expect(p.onCaptured).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain('Das Foto konnte nicht aufgenommen werden.');
    expect(texts(renderer)).not.toContain('Motiv im Rahmen platzieren');
  });

  it('shows an error when taking the picture throws and lets the user retry', async () => {
    mocks.takePicture.mockRejectedValue(new Error('camera busy'));
    const p = props();
    const renderer = await render(p);
    await press(renderer, 'Foto aufnehmen');

    expect(p.onCaptured).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain('Das Foto konnte nicht aufgenommen werden.');

    await press(renderer, 'Fotoaufnahme erneut versuchen');
    expect(texts(renderer)).not.toContain('Das Foto konnte nicht aufgenommen werden.');
    expect(texts(renderer)).toContain('Motiv im Rahmen platzieren');
  });

  it('shows an error when the capture callback throws', async () => {
    mocks.takePicture.mockResolvedValue({ uri: 'file:///photo.jpg', width: 4000, height: 3000 });
    const p = props({ onCaptured: vi.fn().mockRejectedValue(new Error('downstream')) });
    const renderer = await render(p);
    await press(renderer, 'Foto aufnehmen');

    expect(texts(renderer)).toContain('Das Foto konnte nicht aufgenommen werden.');
  });

  it('locks the shutter while a capture is in progress and unlocks it afterwards', async () => {
    let resolvePicture!: (value: { uri: string; width: number; height: number }) => void;
    mocks.takePicture.mockReturnValue(new Promise((resolve) => { resolvePicture = resolve; }));
    const p = props();
    const renderer = await render(p);

    await press(renderer, 'Foto aufnehmen');
    expect(button(renderer, 'Foto aufnehmen').props.disabled).toBe(true);
    expect(all(renderer.root, 'ActivityIndicator')).toHaveLength(1);

    // A second trigger while busy must not start another capture.
    await press(renderer, 'Foto aufnehmen');
    expect(mocks.takePicture).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePicture({ uri: 'file:///photo.jpg', width: 4000, height: 3000 });
    });
    expect(p.onCaptured).toHaveBeenCalledTimes(1);
    expect(button(renderer, 'Foto aufnehmen').props.disabled).toBe(false);
    expect(all(renderer.root, 'ActivityIndicator')).toHaveLength(0);
  });

  it('calls onClose from the close button', async () => {
    const p = props();
    const renderer = await render(p);
    await press(renderer, 'Kamera schließen');

    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('uses custom title and hint', async () => {
    const renderer = await render(props({ title: 'Etikett aufnehmen', hint: 'Etikett im Rahmen' }));

    expect(texts(renderer)).toEqual(expect.arrayContaining(['Etikett aufnehmen', 'Etikett im Rahmen']));
  });
});
