import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const Container = ({ children }: { children?: React.ReactNode }) =>
    ReactModule.createElement('div', null, children);
  return {
    View: Container,
    ScrollView: Container,
    Text: Container,
    TouchableOpacity: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => ReactModule.createElement('button', { onClick: onPress }, children),
    StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('shows the JavaScript and React component stacks for a render error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function BrokenScreen(): never {
      throw new Error("Cannot read property 'Length' of undefined");
    }

    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ErrorBoundary>
          <BrokenScreen />
        </ErrorBoundary>,
      );
    });

    const renderedText = renderer!.root.findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children)
      .join('\n');

    expect(renderedText).toContain("Cannot read property 'Length' of undefined");
    expect(renderedText).toContain('React-Komponenten (kopierbar):');
    expect(renderedText).toContain('BrokenScreen');
    expect(renderedText).toContain('JavaScript-Stack (kopierbar):');
  });
});