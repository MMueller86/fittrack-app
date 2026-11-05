import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MealEstimateLoadingOverlay } from './MealEstimateLoadingOverlay';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
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
      renderer = create(<MealEstimateLoadingOverlay hasPhoto imageUri="/meal.jpg" phase={null} />);
    });
    renderers.push(renderer);

    const labels = texts(renderer);
    expect(labels).not.toContain('Foto geprüft');
    expect(labels).not.toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);
    expect(nodes(renderer, 'Image')).toHaveLength(1);
    expect(labels).not.toContain('100%');
  });

  it('shows photo completion only after the photo-check event', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MealEstimateLoadingOverlay hasPhoto imageUri="/meal.jpg" phase="photo_check.completed" />,
      );
    });
    renderers.push(renderer);

    const labels = texts(renderer);
    expect(labels).toContain('Foto geprüft');
    expect(labels).toContain('FOTO GEPRÜFT');
    expect(labels).not.toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);
  });

  it('starts the estimate animation only after the estimate-started event', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MealEstimateLoadingOverlay hasPhoto imageUri="/meal.jpg" phase="estimate.started" />,
      );
    });
    renderers.push(renderer);

    const labels = texts(renderer);
    expect(labels).toContain('Foto geprüft');
    expect(labels).toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(1);
  });

  it('moves from indeterminate waiting through confirmed photo check to estimation', () => {
    type Phase = Parameters<typeof MealEstimateLoadingOverlay>[0]['phase'];
    let updatePhase: (phase: Phase) => void = () => {};
    function PhaseHarness() {
      const [phase, setPhase] = React.useState<Phase>(null);
      updatePhase = setPhase;
      return <MealEstimateLoadingOverlay hasPhoto imageUri="/meal.jpg" phase={phase} />;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<PhaseHarness />);
    });
    renderers.push(renderer);

    expect(texts(renderer)).not.toContain('FOTO GEPRÜFT');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);

    act(() => {
      updatePhase('photo_check.completed');
    });
    expect(texts(renderer)).toContain('FOTO GEPRÜFT');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(0);

    act(() => {
      updatePhase('estimate.started');
    });
    expect(texts(renderer)).toContain('Mahlzeit schätzen');
    expect(nodes(renderer, 'AnimatedView')).toHaveLength(1);
  });

  it('shows a single estimate stage without a photo', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MealEstimateLoadingOverlay hasPhoto={false} phase={null} />);
    });
    renderers.push(renderer);

    const labels = texts(renderer);
    expect(labels).toContain('Mahlzeit schätzen');
    expect(labels).not.toContain('Foto + Text abgleichen');
    expect(nodes(renderer, 'Image')).toHaveLength(0);
  });
});