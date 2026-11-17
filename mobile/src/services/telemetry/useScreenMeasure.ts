// React glue for screenTelemetry: one measure per screen, a new load supersedes the previous one.

import { useCallback, useRef } from 'react';
import { beginScreenLoad, type ScreenMeasure, type ScreenName } from './screenTelemetry';

export function useScreenMeasure(name: ScreenName): {
  /** Starts measuring a load; cancels the previous unfinished one. */
  begin: () => ScreenMeasure;
  /** Call from an effect after the state that follows the data was committed. */
  rendered: () => void;
} {
  const current = useRef<ScreenMeasure | null>(null);

  const begin = useCallback(() => {
    current.current?.cancel();
    const measure = beginScreenLoad(name);
    current.current = measure;
    return measure;
  }, [name]);

  const rendered = useCallback(() => {
    current.current?.rendered();
  }, []);

  return { begin, rendered };
}
