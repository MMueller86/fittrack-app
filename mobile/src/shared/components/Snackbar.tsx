// Snackbar — lightweight toast notification with optional Undo action.
// Renders at the bottom of the screen above the tab bar.
// Usage: call show() via the ref returned from useSnackbar().

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface SnackbarConfig {
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
  durationMs?: number;
}

export interface SnackbarHandle {
  show: (config: SnackbarConfig) => void;
}

interface State {
  config: SnackbarConfig;
  timerProgress: Animated.Value;
  visible: boolean;
}

export const Snackbar = React.forwardRef<SnackbarHandle>((_, ref) => {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerProgress = useRef(new Animated.Value(1)).current;

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setState(null);
    });
  }, [opacity]);

  const show = useCallback(
    (config: SnackbarConfig) => {
      // Cancel any existing timer
      if (timerRef.current) clearTimeout(timerRef.current);

      const duration = config.durationMs ?? 3500;
      timerProgress.setValue(1);

      setState({ config, timerProgress, visible: true });

      // Fade in
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();

      // Timer bar animation
      Animated.timing(timerProgress, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start();

      // Auto-dismiss
      timerRef.current = setTimeout(dismiss, duration);
    },
    [opacity, timerProgress, dismiss],
  );

  // Expose imperative handle
  React.useImperativeHandle(ref, () => ({ show }), [show]);

  if (!state) return null;

  const { config } = state;
  const hasUndo = !!config.onUndo;

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, spacing.md) + 64, opacity },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.snackbar}>
        <Text style={styles.message} numberOfLines={2}>{config.message}</Text>
        {hasUndo && (
          <TouchableOpacity
            onPress={() => {
              config.onUndo?.();
              dismiss();
            }}
            style={styles.undoBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.undoLabel}>{config.undoLabel ?? 'Rückgängig'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Timer bar */}
      <Animated.View
        style={[
          styles.timerBar,
          {
            width: timerProgress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </Animated.View>
  );
});

Snackbar.displayName = 'Snackbar';

/** Hook that provides a ref + convenience show() function */
export function useSnackbar() {
  const ref = useRef<SnackbarHandle>(null);
  const show = useCallback((config: SnackbarConfig) => ref.current?.show(config), []);
  return { ref, show };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
  },
  snackbar: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    ...typography.body2,
    color: colors.text,
    flex: 1,
  },
  undoBtn: {
    marginLeft: spacing.md,
  },
  undoLabel: {
    ...typography.button,
    color: colors.primary,
  },
  timerBar: {
    height: 3,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    marginTop: -3,
    opacity: 0.6,
  },
});
