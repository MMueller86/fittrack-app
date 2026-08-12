// SwipeableRow — swipe-left to reveal delete action.
// Built with react-native-gesture-handler + react-native-reanimated (UI-thread animations).
// Usage: wrap any row content with <SwipeableRow onDelete={...}> children </SwipeableRow>

import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from './Icon';

const DELETE_THRESHOLD = 80;  // px to reveal delete area
const CONFIRM_THRESHOLD = 220; // px to auto-confirm delete

interface Props {
  onDelete: () => void;
  children: React.ReactNode;
  deleteIconOnly?: boolean;
  allowOverflow?: boolean;
}

export function SwipeableRow({
  onDelete,
  children,
  deleteIconOnly = false,
  allowOverflow = false,
}: Props) {
  const translateX = useSharedValue(0);
  const deleteAreaOpacity = useSharedValue(0);
  const isDeleting = useSharedValue(false);

  const triggerDelete = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  }, [onDelete]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (isDeleting.value) return;
      // Only allow left swipe (negative)
      const x = Math.min(0, e.translationX);
      translateX.value = x;
      deleteAreaOpacity.value = Math.min(1, Math.abs(x) / DELETE_THRESHOLD);
    })
    .onEnd((e) => {
      if (isDeleting.value) return;
      const velocity = e.velocityX;
      const translation = translateX.value;

      const shouldDelete =
        translation < -CONFIRM_THRESHOLD || (translation < -DELETE_THRESHOLD && velocity < -600);

      if (shouldDelete) {
        isDeleting.value = true;
        translateX.value = withTiming(-500, { duration: 220 }, () => {
          runOnJS(triggerDelete)();
        });
      } else {
        // Snap back
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
        deleteAreaOpacity.value = withTiming(0, { duration: 200 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: deleteAreaOpacity.value,
  }));

  return (
    <View style={[styles.container, allowOverflow && styles.containerOverflowVisible]}>
      {/* Delete area behind the row */}
      <Animated.View style={[styles.deleteArea, deleteStyle]}>
        {deleteIconOnly ? (
          <Icon lib="ion" name="trash-outline" size="md" color={colors.white} />
        ) : (
          <Text style={styles.deleteLabel}>Entfernen</Text>
        )}
      </Animated.View>

      {/* Swipeable row content */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  containerOverflowVisible: {
    overflow: 'visible',
  },
  deleteArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.negative,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: spacing.md,
    borderRadius: radius.md,
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  row: {
    backgroundColor: colors.surface,
  },
});
