declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestInstance {
    type: string;
    props: Record<string, unknown>;
    findAll(predicate: (instance: ReactTestInstance) => boolean): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    root: ReactTestInstance;
    unmount(): void;
  }

  export function act(callback: () => void | Promise<void>): void | Promise<void>;
  export function create(element: ReactElement): ReactTestRenderer;
}