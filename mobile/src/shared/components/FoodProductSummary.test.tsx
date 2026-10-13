import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { FoodProductSummary } from './FoodProductSummary';
import { FOOD_THUMBNAIL_SIZE } from './foodProductSummaryUtils';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  Image: 'Image',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  View: 'View',
}));
vi.mock('./Icon', () => ({ Icon: 'Icon' }));

function texts(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((n: ReactTestInstance) => n.type === 'Text')
    .map((n: ReactTestInstance) => String(n.props.children));
}

function byType(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === type);
}

function render(props: Partial<React.ComponentProps<typeof FoodProductSummary>> = {}) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <FoodProductSummary
        name="Haferflocken"
        nutritionBasis="per100g"
        nutrition={{ calories: 370, protein: 13, carbs: 59, fat: 7 }}
        {...props}
      />,
    );
  });
  return renderer;
}

describe('FoodProductSummary', () => {
  it('renders a 52 pt thumbnail with name, brand, badges and the nutrition line', () => {
    const renderer = render({
      brand: 'Kölln',
      imageUri: 'https://example.invalid/oats.jpg',
      badges: [{ label: 'Scan', tone: 'neutral' }],
    });

    const image = byType(renderer, 'Image')[0]!;
    expect((image.props.style as { width: number; height: number }).width).toBe(FOOD_THUMBNAIL_SIZE);
    expect((image.props.style as { width: number; height: number }).height).toBe(FOOD_THUMBNAIL_SIZE);
    expect(texts(renderer)).toEqual([
      'Haferflocken',
      'Kölln',
      'Scan',
      '370 kcal \u00b7 EW 13 g \u00b7 KH 59 g \u00b7 F 7 g \u00b7 je 100 g',
    ]);
  });

  it('falls back to a letter avatar without image, with a blob path, and after an image error', () => {
    const noImage = render();
    expect(byType(noImage, 'Image')).toHaveLength(0);
    expect(texts(noImage)).toContain('H');

    const blobPath = render({ imageUri: 'user-1/item-1.jpg' });
    expect(byType(blobPath, 'Image')).toHaveLength(0);

    const broken = render({ imageUri: 'https://example.invalid/missing.jpg' });
    const image = byType(broken, 'Image')[0]!;
    act(() => (image.props.onError as () => void)());
    expect(byType(broken, 'Image')).toHaveLength(0);
    expect(texts(broken)).toContain('H');
  });

  it('exposes the incomplete marker accessibly and renders caller slots without own actions', () => {
    const renderer = render({
      incomplete: true,
      trailing: React.createElement('Trailing'),
      footer: React.createElement('Footer'),
    });

    expect(
      renderer.root.findAll((n: ReactTestInstance) => n.props.accessibilityLabel === 'Nährwerte unvollständig'),
    ).toHaveLength(1);
    expect(renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Trailing')).toHaveLength(1);
    expect(renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Footer')).toHaveLength(1);
    expect(renderer.root.findAll((n: ReactTestInstance) => typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('hides the nutrition line without calories', () => {
    const renderer = render({ nutrition: undefined });
    expect(texts(renderer)).toEqual(['H', 'Haferflocken']);
  });
});
