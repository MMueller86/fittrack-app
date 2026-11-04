import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FramedPhotoPicker } from './FramedPhotoPicker';
import { getSourceRectForCrop } from './frameCropMath';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const all = (root: ReactTestInstance, type: string): ReactTestInstance[] => root.findAll((node) => node.type === type);
const one = (root: ReactTestInstance, type: string): ReactTestInstance => {
  const matches = all(root, type);
  if (matches.length !== 1) throw new Error(`Expected one ${type}, found ${matches.length}`);
  return matches[0]!;
};

const mocks = vi.hoisted(() => ({
  requestPermission: vi.fn(),
  launchLibrary: vi.fn(),
  cropImageToFrame: vi.fn(),
}));

vi.mock('react-native', () => ({
  Modal: 'Modal',
  StyleSheet: {
    absoluteFill: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: mocks.requestPermission,
  launchImageLibraryAsync: mocks.launchLibrary,
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('./cropImageToFrame', () => ({ cropImageToFrame: mocks.cropImageToFrame }));
// The children have their own tests; here only the picker's orchestration is under test.
vi.mock('./FramedCameraCapture', async () => {
  const React = await import('react');
  return { FramedCameraCapture: (props: object) => React.createElement('CameraCaptureStub', props) };
});
vi.mock('./FramedImageEditor', async () => {
  const React = await import('react');
  return { FramedImageEditor: (props: object) => React.createElement('ImageEditorStub', props) };
});

type PickerProps = React.ComponentProps<typeof FramedPhotoPicker>;

const IMAGE = { width: 3000, height: 4000 };
const CROP = { focusX: 0.25, focusY: 0.75, zoom: 1.5 };
const GENERIC_ERROR = 'Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.';

function baseProps(overrides: Partial<PickerProps> = {}): PickerProps {
  return {
    visible: true,
    preset: 'nutritionLabel',
    output: 'metadata',
    cameraReview: 'editor',
    sourceTitle: 'Foto hinzufügen',
    sourceSubtitle: 'Wähle eine Quelle',
    cameraPurpose: 'ein Foto aufzunehmen',
    editorTitle: 'Foto zuschneiden',
    onClose: vi.fn(),
    onSelected: vi.fn(),
    ...overrides,
  };
}

async function render(props: PickerProps): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<FramedPhotoPicker {...props} />);
  });
  return renderer;
}

function modals(renderer: ReactTestRenderer): ReactTestInstance[] {
  return all(renderer.root, 'Modal');
}
const sheetVisible = (r: ReactTestRenderer) => modals(r)[0]!.props.visible as boolean;
const cameraVisible = (r: ReactTestRenderer) => modals(r)[1]!.props.visible as boolean;
const camera = (r: ReactTestRenderer) => one(r.root, 'CameraCaptureStub');
const editor = (r: ReactTestRenderer) => one(r.root, 'ImageEditorStub');
const editorVisible = (r: ReactTestRenderer) => editor(r).props.visible as boolean;

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

function grantGallery(asset: { uri: string; mimeType?: string } = { uri: 'file:///gallery.png', mimeType: 'image/png' }) {
  mocks.requestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
  mocks.launchLibrary.mockResolvedValue({ canceled: false, assets: [asset] });
}

beforeEach(() => {
  mocks.requestPermission.mockReset();
  mocks.launchLibrary.mockReset();
  mocks.cropImageToFrame.mockReset();
});

describe('FramedPhotoPicker source selection', () => {
  it('shows the source sheet with all options when no initialSource is given', async () => {
    const renderer = await render(baseProps());

    expect(sheetVisible(renderer)).toBe(true);
    expect(cameraVisible(renderer)).toBe(false);
    expect(editorVisible(renderer)).toBe(false);
    expect(texts(renderer)).toEqual(
      expect.arrayContaining(['Foto hinzufügen', 'Kamera', 'Galerie', 'Abbrechen']),
    );
    expect(mocks.launchLibrary).not.toHaveBeenCalled();
  });

  it('opens the camera directly for initialSource="camera" without the source sheet', async () => {
    const renderer = await render(baseProps({ initialSource: 'camera' }));

    expect(cameraVisible(renderer)).toBe(true);
    expect(sheetVisible(renderer)).toBe(false);
    expect(camera(renderer).props.permissionPurpose).toBe('ein Foto aufzunehmen');
    expect(mocks.launchLibrary).not.toHaveBeenCalled();
  });

  it('opens the gallery directly for initialSource="gallery" without the source sheet', async () => {
    grantGallery({ uri: 'file:///direct.jpg', mimeType: 'image/jpeg' });
    const renderer = await render(baseProps({ initialSource: 'gallery' }));

    expect(mocks.requestPermission).toHaveBeenCalledTimes(1);
    expect(mocks.launchLibrary).toHaveBeenCalledTimes(1);
    expect(sheetVisible(renderer)).toBe(false);
    expect(cameraVisible(renderer)).toBe(false);
    expect(editorVisible(renderer)).toBe(true);
    expect(editor(renderer).props.imageUri).toBe('file:///direct.jpg');
  });

  it('switches from the sheet to the camera when "Kamera" is chosen', async () => {
    const renderer = await render(baseProps());
    await press(renderer, 'Kamera öffnen');

    expect(cameraVisible(renderer)).toBe(true);
    expect(sheetVisible(renderer)).toBe(false);
  });

  it('closes via "Abbrechen" and the backdrop', async () => {
    const onClose = vi.fn();
    const renderer = await render(baseProps({ onClose }));

    await press(renderer, 'Fotoauswahl abbrechen');
    await press(renderer, 'Fotoauswahl schließen');

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('FramedPhotoPicker gallery', () => {
  it('explains a denied permission that can be asked again and does not open the library', async () => {
    mocks.requestPermission.mockResolvedValue({ granted: false, canAskAgain: true });
    const renderer = await render(baseProps());
    await press(renderer, 'Galerie öffnen');

    expect(texts(renderer)).toContain('Der Zugriff auf deine Fotos wurde nicht erteilt.');
    expect(mocks.launchLibrary).not.toHaveBeenCalled();
    expect(sheetVisible(renderer)).toBe(true);
  });

  it('points to the device settings when the permission is permanently denied', async () => {
    mocks.requestPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    const renderer = await render(baseProps());
    await press(renderer, 'Galerie öffnen');

    expect(texts(renderer)).toContain('Bitte erlaube FitTrack den Fotozugriff in den Geräteeinstellungen.');
    expect(mocks.launchLibrary).not.toHaveBeenCalled();
  });

  it('shows the sheet with the message when initialSource="gallery" is denied', async () => {
    mocks.requestPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    const onClose = vi.fn();
    const renderer = await render(baseProps({ initialSource: 'gallery', onClose }));

    expect(sheetVisible(renderer)).toBe(true);
    expect(texts(renderer)).toContain('Bitte erlaube FitTrack den Fotozugriff in den Geräteeinstellungen.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the sheet open and triggers neither selection nor crop when the library is cancelled', async () => {
    mocks.requestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mocks.launchLibrary.mockResolvedValue({ canceled: true, assets: null });
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(mocks.cropImageToFrame).not.toHaveBeenCalled();
    expect(sheetVisible(renderer)).toBe(true);
    expect(editorVisible(renderer)).toBe(false);
  });

  it('closes the picker when the library is cancelled and was opened via initialSource', async () => {
    mocks.requestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mocks.launchLibrary.mockResolvedValue({ canceled: true, assets: null });
    const props = baseProps({ initialSource: 'gallery', output: 'cropped-file' });
    await render(props);

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSelected).not.toHaveBeenCalled();
    expect(mocks.cropImageToFrame).not.toHaveBeenCalled();
  });

  it('reports an asset without URI and a library exception in the sheet', async () => {
    mocks.requestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mocks.launchLibrary.mockResolvedValueOnce({ canceled: false, assets: [{}] });
    const renderer = await render(baseProps());
    await press(renderer, 'Galerie öffnen');
    expect(texts(renderer)).toContain('Das Foto konnte nicht übernommen werden.');
    expect(editorVisible(renderer)).toBe(false);

    mocks.launchLibrary.mockRejectedValueOnce(new Error('boom'));
    await press(renderer, 'Galerie öffnen');
    expect(texts(renderer)).toContain('Die Galerie konnte nicht geöffnet werden. Bitte versuche es erneut.');
  });

  it('passes the chosen image to the editor and maps the MIME type', async () => {
    grantGallery({ uri: 'file:///gallery.png', mimeType: 'image/png' });
    const renderer = await render(baseProps());
    await press(renderer, 'Galerie öffnen');

    expect(editorVisible(renderer)).toBe(true);
    expect(sheetVisible(renderer)).toBe(false);
    expect(editor(renderer).props.imageUri).toBe('file:///gallery.png');
    expect(editor(renderer).props.title).toBe('Foto zuschneiden');
    // 3 / 4 is the nutritionLabel preset
    expect(editor(renderer).props.aspectRatio).toBe(3 / 4);
  });

  it('returns to the sheet when the editor is cancelled, and closes when opened via initialSource', async () => {
    grantGallery();
    const renderer = await render(baseProps());
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      (editor(renderer).props.onCancel as () => void)();
    });
    expect(editorVisible(renderer)).toBe(false);
    expect(sheetVisible(renderer)).toBe(true);

    const direct = baseProps({ initialSource: 'gallery' });
    const directRenderer = await render(direct);
    await act(async () => {
      (editor(directRenderer).props.onCancel as () => void)();
    });
    expect(direct.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('FramedPhotoPicker output', () => {
  async function openEditor(props: PickerProps) {
    grantGallery({ uri: 'file:///gallery.png', mimeType: 'image/png' });
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');
    return renderer;
  }

  it('output="metadata" returns the original file with the crop and never crops', async () => {
    const props = baseProps({ output: 'metadata' });
    const renderer = await openEditor(props);
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });

    expect(mocks.cropImageToFrame).not.toHaveBeenCalled();
    expect(props.onSelected).toHaveBeenCalledTimes(1);
    expect(props.onSelected).toHaveBeenCalledWith({ uri: 'file:///gallery.png', mime: 'image/png', crop: CROP });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(editorVisible(renderer)).toBe(false);
  });

  it('output="cropped-file" crops with rect, image size and preset maxEdge and returns the JPEG', async () => {
    mocks.cropImageToFrame.mockResolvedValue({ uri: 'file:///cropped.jpg', mime: 'image/jpeg' });
    const props = baseProps({ output: 'cropped-file', preset: 'nutritionLabel' });
    const renderer = await openEditor(props);
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });

    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(1);
    expect(mocks.cropImageToFrame).toHaveBeenCalledWith('file:///gallery.png', 3 / 4, CROP, 2000);
    expect(props.onSelected).toHaveBeenCalledWith({ uri: 'file:///cropped.jpg', mime: 'image/jpeg', crop: CROP });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('passes no maxEdge for a preset that keeps the original resolution', async () => {
    mocks.cropImageToFrame.mockResolvedValue({ uri: 'file:///cropped.jpg', mime: 'image/jpeg' });
    const props = baseProps({ output: 'cropped-file', preset: 'recipeHero' });
    const renderer = await openEditor(props);
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });

    expect(mocks.cropImageToFrame.mock.calls[0]![3]).toBeUndefined();
  });

  it('shows a processing error in the source sheet and does not call onSelected', async () => {
    mocks.cropImageToFrame.mockRejectedValue(new Error('crop failed'));
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await openEditor(props);
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(editorVisible(renderer)).toBe(false);
    expect(sheetVisible(renderer)).toBe(true);
    expect(texts(renderer)).toContain(GENERIC_ERROR);
  });

  it('allows a retry after a processing error', async () => {
    mocks.cropImageToFrame.mockRejectedValueOnce(new Error('crop failed'));
    mocks.cropImageToFrame.mockResolvedValueOnce({ uri: 'file:///cropped.jpg', mime: 'image/jpeg' });
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await openEditor(props);
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });

    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(2);
    expect(props.onSelected).toHaveBeenCalledTimes(1);
  });

  it('crops only once when the confirmation fires twice while busy', async () => {
    let resolveCrop!: (value: { uri: string; mime: 'image/jpeg' }) => void;
    mocks.cropImageToFrame.mockReturnValue(new Promise((resolve) => { resolveCrop = resolve; }));
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await openEditor(props);

    await act(async () => {
      const confirm = editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void;
      confirm(CROP, IMAGE);
      confirm(CROP, IMAGE);
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCrop({ uri: 'file:///cropped.jpg', mime: 'image/jpeg' });
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(1);
    expect(props.onSelected).toHaveBeenCalledTimes(1);
  });
});

describe('FramedPhotoPicker camera review', () => {
  const PHOTO = { uri: 'file:///photo.jpg', mime: 'image/jpeg' as const, width: 4000, height: 3000 };
  const FRAME_RECT = { x: 400, y: 300, width: 2000, height: 1500 };

  it('cameraReview="direct" crops immediately with the visible frame rectangle', async () => {
    mocks.cropImageToFrame.mockResolvedValue({ uri: 'file:///cropped.jpg', mime: 'image/jpeg' });
    const props = baseProps({
      initialSource: 'camera',
      cameraReview: 'direct',
      output: 'cropped-file',
      preset: 'mealPhoto',
    });
    const renderer = await render(props);
    await act(async () => {
      await (camera(renderer).props.onCaptured as (p: unknown) => Promise<void>)({ ...PHOTO, frameRect: FRAME_RECT });
    });

    expect(editorVisible(renderer)).toBe(false);
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(1);
    const [uri, aspectRatio, crop, maxEdge] = mocks.cropImageToFrame.mock.calls[0]!;
    expect(uri).toBe(PHOTO.uri);
    expect(aspectRatio).toBe(4 / 3);
    expect(maxEdge).toBe(1600);
    const rect = getSourceRectForCrop(PHOTO, aspectRatio as number, crop as typeof CROP);
    expect(rect.x).toBeCloseTo(FRAME_RECT.x, 3);
    expect(rect.y).toBeCloseTo(FRAME_RECT.y, 3);
    expect(rect.width).toBeCloseTo(FRAME_RECT.width, 3);
    expect(rect.height).toBeCloseTo(FRAME_RECT.height, 3);
    expect(props.onSelected).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///cropped.jpg', mime: 'image/jpeg' }),
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('cameraReview="editor" opens the editor with the captured photo and does not crop yet', async () => {
    const props = baseProps({ initialSource: 'camera', cameraReview: 'editor', output: 'cropped-file' });
    const renderer = await render(props);
    await act(async () => {
      await (camera(renderer).props.onCaptured as (p: unknown) => Promise<void>)({ ...PHOTO, frameRect: FRAME_RECT });
    });

    expect(editorVisible(renderer)).toBe(true);
    expect(editor(renderer).props.imageUri).toBe(PHOTO.uri);
    expect(cameraVisible(renderer)).toBe(false);
    expect(mocks.cropImageToFrame).not.toHaveBeenCalled();
    expect(props.onSelected).not.toHaveBeenCalled();
  });

  it('closes the picker when the camera is closed', async () => {
    const props = baseProps({ initialSource: 'camera' });
    const renderer = await render(props);
    await act(async () => {
      (camera(renderer).props.onClose as () => void)();
    });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('cameraReview="direct" shows a crop failure in the source sheet and does not call onSelected', async () => {
    mocks.cropImageToFrame.mockRejectedValue(new Error('crop failed'));
    const props = baseProps({
      initialSource: 'camera',
      cameraReview: 'direct',
      output: 'cropped-file',
      preset: 'mealPhoto',
    });
    const renderer = await render(props);
    await act(async () => {
      await (camera(renderer).props.onCaptured as (p: unknown) => Promise<void>)({ ...PHOTO, frameRect: FRAME_RECT });
    });

    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(1);
    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(cameraVisible(renderer)).toBe(false);
    expect(editorVisible(renderer)).toBe(false);
    expect(sheetVisible(renderer)).toBe(true);
    expect(texts(renderer)).toContain(GENERIC_ERROR);
  });
});

describe('FramedPhotoPicker direct camera crop closed mid-flight', () => {
  const PHOTO = { uri: 'file:///photo.jpg', mime: 'image/jpeg' as const, width: 4000, height: 3000 };
  const FRAME_RECT = { x: 400, y: 300, width: 2000, height: 1500 };

  async function capturePending() {
    let resolve!: (value: { uri: string; mime: 'image/jpeg' }) => void;
    let reject!: (reason: unknown) => void;
    mocks.cropImageToFrame.mockReturnValue(new Promise((res, rej) => { resolve = res; reject = rej; }));
    const props = baseProps({
      initialSource: 'camera',
      cameraReview: 'direct',
      output: 'cropped-file',
      preset: 'mealPhoto',
    });
    const renderer = await render(props);
    let captured!: Promise<void>;
    await act(async () => {
      captured = (camera(renderer).props.onCaptured as (p: unknown) => Promise<void>)({ ...PHOTO, frameRect: FRAME_RECT });
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(1);
    await act(async () => {
      (camera(renderer).props.onClose as () => void)();
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    return { props, renderer, captured, resolve, reject };
  }

  it('discards the result when the camera is closed during the crop', async () => {
    const { props, renderer, captured, resolve } = await capturePending();

    await act(async () => {
      resolve({ uri: 'file:///cropped.jpg', mime: 'image/jpeg' });
      await captured;
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(texts(renderer)).not.toContain(GENERIC_ERROR);
    expect(sheetVisible(renderer)).toBe(false);
  });

  it('sets no error state when the crop fails after the camera was closed', async () => {
    const { props, renderer, captured, reject } = await capturePending();

    await act(async () => {
      reject(new Error('crop failed'));
      await captured;
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(texts(renderer)).not.toContain(GENERIC_ERROR);
    expect(sheetVisible(renderer)).toBe(false);
  });
});

describe('FramedPhotoPicker gallery request options', () => {
  it('opens the system library for exactly one image without the system editor', async () => {
    grantGallery();
    const renderer = await render(baseProps());
    await press(renderer, 'Galerie öffnen');

    expect(mocks.launchLibrary).toHaveBeenCalledTimes(1);
    expect(mocks.launchLibrary).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: false,
      selectionLimit: 1,
      quality: 0.85,
    });
  });
});

describe('FramedPhotoPicker source switching and stale results (F-08)', () => {
  function deferredGallery() {
    let resolve!: (value: unknown) => void;
    mocks.requestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mocks.launchLibrary.mockReturnValue(new Promise((r) => { resolve = r; }));
    return (value: unknown) => resolve(value);
  }

  async function update(renderer: ReactTestRenderer, props: PickerProps) {
    await act(async () => {
      (renderer as ReactTestRenderer & { update(element: React.ReactElement): void })
        .update(<FramedPhotoPicker {...props} />);
    });
  }

  it('opens only the gallery when initialSource switches from camera to gallery while visible', async () => {
    grantGallery({ uri: 'file:///switched.jpg', mimeType: 'image/jpeg' });
    const props = baseProps({ initialSource: 'camera' });
    const renderer = await render(props);
    expect(cameraVisible(renderer)).toBe(true);

    await update(renderer, { ...props, initialSource: 'gallery' });

    expect(mocks.launchLibrary).toHaveBeenCalledTimes(1);
    expect(cameraVisible(renderer)).toBe(false);
    expect(editorVisible(renderer)).toBe(true);
    expect(editor(renderer).props.imageUri).toBe('file:///switched.jpg');
  });

  it('opens only the camera when initialSource switches from gallery to camera and drops the late gallery result', async () => {
    const resolveGallery = deferredGallery();
    const props = baseProps({ initialSource: 'gallery' });
    const renderer = await render(props);
    expect(mocks.launchLibrary).toHaveBeenCalledTimes(1);

    await update(renderer, { ...props, initialSource: 'camera' });
    expect(cameraVisible(renderer)).toBe(true);

    await act(async () => {
      resolveGallery({ canceled: false, assets: [{ uri: 'file:///late.jpg', mimeType: 'image/jpeg' }] });
    });

    expect(cameraVisible(renderer)).toBe(true);
    expect(editorVisible(renderer)).toBe(false);
    expect(editor(renderer).props.imageUri).toBeNull();
  });

  it('does not close the picker for a late cancelled gallery result after a source switch', async () => {
    const resolveGallery = deferredGallery();
    const props = baseProps({ initialSource: 'gallery' });
    const renderer = await render(props);
    await update(renderer, { ...props, initialSource: 'camera' });

    await act(async () => {
      resolveGallery({ canceled: true, assets: null });
    });

    expect(props.onClose).not.toHaveBeenCalled();
    expect(cameraVisible(renderer)).toBe(true);
  });

  it('discards a late gallery result after the picker was hidden and leaves no stale editor on reopen', async () => {
    const resolveGallery = deferredGallery();
    const props = baseProps({ initialSource: 'gallery' });
    const renderer = await render(props);

    await update(renderer, { ...props, visible: false, initialSource: undefined });
    await act(async () => {
      resolveGallery({ canceled: false, assets: [{ uri: 'file:///late.jpg', mimeType: 'image/jpeg' }] });
    });
    await update(renderer, { ...props, visible: true, initialSource: undefined });

    expect(editorVisible(renderer)).toBe(false);
    expect(editor(renderer).props.imageUri).toBeNull();
    expect(sheetVisible(renderer)).toBe(true);
  });

  it('discards a late gallery result after the sheet was closed', async () => {
    const resolveGallery = deferredGallery();
    const props = baseProps();
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');
    await press(renderer, 'Fotoauswahl abbrechen');

    await act(async () => {
      resolveGallery({ canceled: false, assets: [{ uri: 'file:///late.jpg', mimeType: 'image/jpeg' }] });
    });

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(editorVisible(renderer)).toBe(false);
  });

  it('resets error and editor state when the picker is hidden and shown again', async () => {
    mocks.requestPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    const props = baseProps();
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');
    expect(texts(renderer)).toContain('Bitte erlaube FitTrack den Fotozugriff in den Geräteeinstellungen.');

    await update(renderer, { ...props, visible: false });
    await update(renderer, { ...props, visible: true });

    expect(texts(renderer)).not.toContain('Bitte erlaube FitTrack den Fotozugriff in den Geräteeinstellungen.');
    expect(sheetVisible(renderer)).toBe(true);
  });

  it('resets an open editor when the picker is hidden and shown again', async () => {
    grantGallery({ uri: 'file:///open.jpg', mimeType: 'image/jpeg' });
    const props = baseProps();
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');
    expect(editorVisible(renderer)).toBe(true);
    expect(editor(renderer).props.imageUri).toBe('file:///open.jpg');

    await update(renderer, { ...props, visible: false });
    await update(renderer, { ...props, visible: true });

    expect(editor(renderer).props.imageUri).toBeNull();
    expect(editorVisible(renderer)).toBe(false);
    expect(sheetVisible(renderer)).toBe(true);
  });

  it('does not restart the gallery when re-rendered with unchanged props and new callback identities', async () => {
    grantGallery();
    const props = baseProps({ initialSource: 'gallery' });
    const renderer = await render(props);
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1);
    expect(mocks.launchLibrary).toHaveBeenCalledTimes(1);

    await update(renderer, { ...props, onClose: vi.fn(), onSelected: vi.fn() });

    expect(mocks.requestPermission).toHaveBeenCalledTimes(1);
    expect(mocks.launchLibrary).toHaveBeenCalledTimes(1);
    expect(editorVisible(renderer)).toBe(true);
    expect(editor(renderer).props.imageUri).toBe('file:///gallery.png');
  });
});

describe('FramedPhotoPicker stale crop results (F-09)', () => {
  async function update(renderer: ReactTestRenderer, props: PickerProps) {
    await act(async () => {
      (renderer as ReactTestRenderer & { update(element: React.ReactElement): void })
        .update(<FramedPhotoPicker {...props} />);
    });
  }

  function deferredCrop() {
    let resolve!: (value: { uri: string; mime: 'image/jpeg' }) => void;
    let reject!: (reason: unknown) => void;
    mocks.cropImageToFrame.mockReturnValue(new Promise((res, rej) => { resolve = res; reject = rej; }));
    return {
      resolve: (value = { uri: 'file:///cropped.jpg', mime: 'image/jpeg' as const }) => resolve(value),
      reject: (reason: unknown = new Error('crop failed')) => reject(reason),
    };
  }

  async function confirmPending(props: PickerProps) {
    grantGallery({ uri: 'file:///gallery.png', mimeType: 'image/png' });
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(1);
    return renderer;
  }

  it('discards the result when the sheet is closed during the crop', async () => {
    const crop = deferredCrop();
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await confirmPending(props);
    await press(renderer, 'Fotoauswahl schließen');
    expect(props.onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      crop.resolve();
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('discards the result when the editor is cancelled during the crop', async () => {
    const crop = deferredCrop();
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await confirmPending(props);
    await act(async () => {
      (editor(renderer).props.onCancel as () => void)();
    });

    await act(async () => {
      crop.resolve();
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(sheetVisible(renderer)).toBe(true);
  });

  it('discards the result when the picker is hidden during the crop', async () => {
    const crop = deferredCrop();
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await confirmPending(props);
    await update(renderer, { ...props, visible: false });

    await act(async () => {
      crop.resolve();
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('discards the result when initialSource switches during the crop', async () => {
    const crop = deferredCrop();
    const props = baseProps({ output: 'cropped-file', initialSource: 'gallery' });
    grantGallery({ uri: 'file:///gallery.png', mimeType: 'image/png' });
    const renderer = await render(props);
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });
    await update(renderer, { ...props, initialSource: 'camera' });

    await act(async () => {
      crop.resolve();
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(cameraVisible(renderer)).toBe(true);
  });

  it('sets no error state when the crop fails after the request was cancelled', async () => {
    const crop = deferredCrop();
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await confirmPending(props);
    await press(renderer, 'Fotoauswahl schließen');
    await update(renderer, { ...props, visible: false });
    await update(renderer, { ...props, visible: true });

    await act(async () => {
      crop.reject();
    });

    expect(texts(renderer)).not.toContain(GENERIC_ERROR);
    expect(props.onSelected).not.toHaveBeenCalled();
    expect(sheetVisible(renderer)).toBe(true);
    expect(editorVisible(renderer)).toBe(false);
  });

  it('lets a new confirmation start while a discarded crop is still pending', async () => {
    let resolveFirst!: (value: { uri: string; mime: 'image/jpeg' }) => void;
    let resolveSecond!: (value: { uri: string; mime: 'image/jpeg' }) => void;
    mocks.cropImageToFrame
      .mockReturnValueOnce(new Promise((res) => { resolveFirst = res; }))
      .mockReturnValueOnce(new Promise((res) => { resolveSecond = res; }))
      .mockResolvedValueOnce({ uri: 'file:///third.jpg', mime: 'image/jpeg' });
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await confirmPending(props);
    const confirm = () => (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);

    // Cancel the editor (invalidates the first request), pick again and confirm immediately.
    await act(async () => {
      (editor(renderer).props.onCancel as () => void)();
    });
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      confirm();
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSecond({ uri: 'file:///second.jpg', mime: 'image/jpeg' });
    });
    expect(props.onSelected).toHaveBeenCalledTimes(1);
    expect(props.onSelected).toHaveBeenCalledWith({ uri: 'file:///second.jpg', mime: 'image/jpeg', crop: CROP });

    await act(async () => {
      resolveFirst({ uri: 'file:///first.jpg', mime: 'image/jpeg' });
    });
    expect(props.onSelected).toHaveBeenCalledTimes(1);
    expect(texts(renderer)).not.toContain(GENERIC_ERROR);

    // The guard is released: a later request can crop again.
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      confirm();
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(3);
    expect(props.onSelected).toHaveBeenCalledTimes(2);
  });

  it('still calls onSelected and onClose exactly once on the normal path', async () => {
    const crop = deferredCrop();
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await confirmPending(props);

    await act(async () => {
      crop.resolve();
    });

    expect(props.onSelected).toHaveBeenCalledTimes(1);
    expect(props.onSelected).toHaveBeenCalledWith({ uri: 'file:///cropped.jpg', mime: 'image/jpeg', crop: CROP });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(editorVisible(renderer)).toBe(false);
  });

  it('keeps a pending guard when a discarded older crop settles (conditional busy reset)', async () => {
    let resolveA!: (value: { uri: string; mime: 'image/jpeg' }) => void;
    let resolveB!: (value: { uri: string; mime: 'image/jpeg' }) => void;
    mocks.cropImageToFrame
      .mockReturnValueOnce(new Promise((res) => { resolveA = res; }))
      .mockReturnValueOnce(new Promise((res) => { resolveB = res; }))
      .mockResolvedValueOnce({ uri: 'file:///third.jpg', mime: 'image/jpeg' });
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await confirmPending(props);
    const confirm = () => (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);

    // A is discarded by the editor cancel; B starts on a new gallery pick.
    await act(async () => {
      (editor(renderer).props.onCancel as () => void)();
    });
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      confirm();
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveA({ uri: 'file:///a.jpg', mime: 'image/jpeg' });
    });
    expect(props.onSelected).not.toHaveBeenCalled();

    // B is still running: a further confirmation must not start another crop.
    await act(async () => {
      confirm();
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveB({ uri: 'file:///b.jpg', mime: 'image/jpeg' });
    });
    expect(props.onSelected).toHaveBeenCalledTimes(1);
    expect(props.onSelected).toHaveBeenCalledWith({ uri: 'file:///b.jpg', mime: 'image/jpeg', crop: CROP });

    // After B settled, a new crop can start again.
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      confirm();
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(3);
    expect(props.onSelected).toHaveBeenCalledTimes(2);
  });
});

describe('FramedPhotoPicker unmount (F-11)', () => {
  it('discards a crop result that settles after unmount', async () => {
    let resolveCrop!: (value: { uri: string; mime: 'image/jpeg' }) => void;
    mocks.cropImageToFrame.mockReturnValue(new Promise((res) => { resolveCrop = res; }));
    grantGallery({ uri: 'file:///gallery.png', mimeType: 'image/png' });
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });
    expect(mocks.cropImageToFrame).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
    await act(async () => {
      resolveCrop({ uri: 'file:///cropped.jpg', mime: 'image/jpeg' });
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('triggers neither onSelected nor onClose when a crop fails after unmount', async () => {
    let rejectCrop!: (reason: unknown) => void;
    mocks.cropImageToFrame.mockReturnValue(new Promise((_, rej) => { rejectCrop = rej; }));
    grantGallery({ uri: 'file:///gallery.png', mimeType: 'image/png' });
    const props = baseProps({ output: 'cropped-file' });
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });
    await act(async () => {
      renderer.unmount();
    });
    await act(async () => {
      rejectCrop(new Error('crop failed'));
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('ignores a gallery result that arrives after unmount', async () => {
    let resolveGallery!: (value: unknown) => void;
    mocks.requestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mocks.launchLibrary.mockReturnValue(new Promise((r) => { resolveGallery = r; }));
    const props = baseProps({ initialSource: 'gallery', output: 'cropped-file' });
    const renderer = await render(props);
    expect(mocks.launchLibrary).toHaveBeenCalledTimes(1);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      renderer.unmount();
    });
    await act(async () => {
      resolveGallery({ canceled: false, assets: [{ uri: 'file:///late.jpg', mimeType: 'image/jpeg' }] });
    });

    expect(props.onSelected).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(mocks.cropImageToFrame).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ignores a late cancelled gallery result after unmount (no onClose for initialSource)', async () => {
    let resolveGallery!: (value: unknown) => void;
    mocks.requestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    mocks.launchLibrary.mockReturnValue(new Promise((r) => { resolveGallery = r; }));
    const props = baseProps({ initialSource: 'gallery' });
    const renderer = await render(props);

    await act(async () => {
      renderer.unmount();
    });
    await act(async () => {
      resolveGallery({ canceled: true, assets: null });
    });

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('output="metadata" still reports the selection immediately (recipe path unchanged)', async () => {
    grantGallery({ uri: 'file:///gallery.png', mimeType: 'image/png' });
    const props = baseProps({ output: 'metadata' });
    const renderer = await render(props);
    await press(renderer, 'Galerie öffnen');
    await act(async () => {
      (editor(renderer).props.onConfirm as (c: unknown, i: unknown) => void)(CROP, IMAGE);
    });

    expect(props.onSelected).toHaveBeenCalledTimes(1);
    expect(props.onSelected).toHaveBeenCalledWith({ uri: 'file:///gallery.png', mime: 'image/png', crop: CROP });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(mocks.cropImageToFrame).not.toHaveBeenCalled();
  });
});

