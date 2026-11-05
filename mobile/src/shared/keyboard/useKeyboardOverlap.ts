import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Keyboard, Platform } from 'react-native';
import type { View } from 'react-native';

// Android modals are not reliably resized by the keyboard, so measure how far it covers the attached view.
// iOS screens use KeyboardAvoidingView instead and always report 0.
export function useKeyboardOverlap() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      // Wait for a possible window resize before measuring.
      timer = setTimeout(() => {
        ref.current?.measureInWindow((_x, y, _width, height) => {
          setOverlap(Math.max(0, Math.round(y + height - keyboardTop)));
        });
      }, 150);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (timer) clearTimeout(timer);
      setOverlap(0);
    });
    return () => {
      if (timer) clearTimeout(timer);
      show.remove();
      hide.remove();
    };
  }, []);

  return { ref, overlap };
}
