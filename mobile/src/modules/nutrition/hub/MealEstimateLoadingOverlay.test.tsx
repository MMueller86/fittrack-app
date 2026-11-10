import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { colors } from '../../../app/theme';
import { MealEstimateLoadingOverlay } from './MealEstimateLoadingOverlay';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  StyleSheet: {
    absoluteFill: { position: 'absolute' },
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  View: 'View',
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (factory: () => object) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withRepeat: (value: number) => value,
  withTiming: (value: number) => value,
}));
vi.mock('../../../shared/components/Icon', () => ({ Icon: 'Icon' }));

const renderers: ReactTestRenderer[] = [];

function nodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => (node.type as unknown) === type);
}

function texts(renderer: ReactTestRenderer): string[] {
  return nodes(renderer, 'Text').map((node) => String(node.props.children));
}

afterEach(() => {
  renderers.splice(0).forEach((renderer) => act(() => renderer.unmount()));
});

describe('MealEstimateLoadingOverlay', () => {
  it('keeps photo estimates indeterminate before a confirmed phase', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MealEstimateLoadingOverlay hasPhoto imageUri="/meal.jpg" phase={null} photoUse={null} />);
    });
    renderers.push(renderer);

    const labels = texts(renderer);
    expect(labels).toContain('Prüfe Bild');
    expect(labels).toContain('Foto und Beschreibung abgleichen');
    expect(labels).toContain('Mahlzeit schätzen');
    expect(labels).toContain('Portion und Nährwerte ermitteln');
    expect(nodes(renderer, 'ActivityIndicator')).toHaveLength(1);
    expect(nodes(renderer, 'ActivityIndicator')[0]?.props.accessibilityLabel).toBe('Prüfe Bild läuft');
    expect(nodes(renderer, 'Icon').some((node) => node.props.name === 'check')).toBe(false);
    expect(labels).not.toContain('Foto geprüft');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);
    expect(nodes(renderer, 'Image')).toHaveLength(1);
    expect(labels).not.toContain('100%');
  });

  it('shows photo completion only after the photo-check event', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MealEstimateLoadingOverlay
          hasPhoto
          imageUri="/meal.jpg"
          phase="photo_check.completed"
          photoUse="included"
        />,
      );
    });
    renderers.push(renderer);

    const labels = texts(renderer);
    expect(labels).toContain('Foto geprüft');
    expect(labels).toContain('FOTO PASST');
    expect(labels).toContain('Passt zur Beschreibung');
    expect(nodes(renderer, 'Icon').some((node) => node.props.name === 'check')).toBe(true);
    expect(labels).toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'ActivityIndicator')).toHaveLength(0);
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);
  });

  it('starts the estimate animation only after the estimate-started event', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MealEstimateLoadingOverlay
          hasPhoto
          imageUri="/meal.jpg"
          phase="estimate.started"
          photoUse="included"
        />,
      );
    });
    renderers.push(renderer);

    const labels = texts(renderer);
    expect(labels).toContain('Foto geprüft');
    expect(labels).toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'ActivityIndicator')).toHaveLength(1);
    expect(nodes(renderer, 'ActivityIndicator')[0]?.props.accessibilityLabel).toBe('Mahlzeit schätzen läuft');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);
  });

  it('moves from indeterminate waiting through confirmed photo check to estimation', () => {
    type Phase = Parameters<typeof MealEstimateLoadingOverlay>[0]['phase'];
    let updatePhase: (phase: Phase) => void = () => {};
    let confirmPhotoCheck: () => void = () => {};
    function PhaseHarness() {
      const [phase, setPhase] = React.useState<Phase>(null);
      const [photoUse, setPhotoUse] = React.useState<'included' | null>(null);
      updatePhase = setPhase;
      confirmPhotoCheck = () => {
        setPhotoUse('included');
        setPhase('photo_check.completed');
      };
      return <MealEstimateLoadingOverlay hasPhoto imageUri="/meal.jpg" phase={phase} photoUse={photoUse} />;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<PhaseHarness />);
    });
    renderers.push(renderer);

    expect(texts(renderer)).toContain('Prüfe Bild');
    expect(texts(renderer)).toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'ActivityIndicator')).toHaveLength(1);
    expect(texts(renderer)).not.toContain('FOTO PASST');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);

    act(() => confirmPhotoCheck());
    expect(texts(renderer)).toContain('Foto geprüft');
    expect(texts(renderer)).toContain('FOTO PASST');
    expect(texts(renderer)).toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'Icon').some((node) => node.props.name === 'check')).toBe(true);
    expect(nodes(renderer, 'ActivityIndicator')).toHaveLength(0);
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);

    act(() => {
      updatePhase('estimate.started');
    });
    expect(texts(renderer)).toContain('Mahlzeit schätzen');
    expect(texts(renderer)).toContain('Foto geprüft');
    expect(nodes(renderer, 'ActivityIndicator')).toHaveLength(1);
    expect(nodes(renderer, 'ActivityIndicator')[0]?.props.accessibilityLabel).toBe('Mahlzeit schätzen läuft');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);
  });

  it('shows a single estimate stage without a photo', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MealEstimateLoadingOverlay hasPhoto={false} phase={null} photoUse={null} />);
    });
    renderers.push(renderer);

    const labels = texts(renderer);
    expect(labels).toContain('Wir schätzen deine Mahlzeit');
    expect(labels).toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'ActivityIndicator')).toHaveLength(1);
    expect(labels).not.toContain('Foto + Text abgleichen');
    expect(nodes(renderer, 'Image')).toHaveLength(0);
  });

  it.each([
    {
      photoUse: 'excluded_mismatch' as const,
      badge: 'FOTO ABGELEHNT',
      title: 'Foto abgelehnt',
      icon: 'x',
      tagIcon: 'x-circle',
      tone: colors.negative,
    },
    {
      photoUse: 'excluded_uncertain' as const,
      badge: 'ABGLEICH UNKLAR',
      title: 'Foto nicht genutzt',
      icon: 'alert-triangle',
      tagIcon: 'alert-circle',
      tone: colors.warning,
    },
  ])('shows $badge without a positive confirmation', ({ photoUse, badge, title, icon, tagIcon, tone }) => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MealEstimateLoadingOverlay
          hasPhoto
          imageUri="/meal.jpg"
          phase="photo_check.completed"
          photoUse={photoUse}
        />,
      );
    });
    renderers.push(renderer);

    expect(texts(renderer)).toContain(badge);
    expect(texts(renderer)).toContain(title);
    expect(nodes(renderer, 'Icon').some((node) => node.props.name === icon && node.props.color === colors.background)).toBe(true);
    expect(nodes(renderer, 'Icon').some((node) => node.props.name === tagIcon && node.props.color === tone)).toBe(true);
    expect(nodes(renderer, 'Icon').some((node) => node.props.name === 'check')).toBe(false);
  });
});