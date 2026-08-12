import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { SwipeableRow } from '../../shared/components/SwipeableRow';
import type { WizardStepItem } from './recipeWizardTypes';

type StepInputField = 'title' | 'description';

interface StepEditorRowProps {
  step: WizardStepItem;
  index: number;
  dragging: boolean;
  onUpdate: (id: string, field: keyof WizardStepItem, value: string) => void;
  onRemove: () => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, translationY: number, absoluteY: number) => void;
  onDragEnd: (id: string, translationY: number) => void;
  onLayout: (id: string, height: number) => void;
  dragScrollAdjustment: SharedValue<number>;
}

function StepEditorRow({
  step,
  index,
  dragging,
  onUpdate,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
  onLayout,
  dragScrollAdjustment,
}: StepEditorRowProps) {
  const [titleHeight, setTitleHeight] = useState<number>();
  const [descriptionHeight, setDescriptionHeight] = useState<number>();
  const translateY = useSharedValue(0);
  const gestureActive = useSharedValue(false);

  const dragGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      gestureActive.value = true;
      runOnJS(onDragStart)(step.id);
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
      runOnJS(onDragMove)(step.id, event.translationY, event.absoluteY);
    })
    .onFinalize((event) => {
      if (gestureActive.value) {
        runOnJS(onDragEnd)(step.id, event.translationY);
      }
      gestureActive.value = false;
      translateY.value = 0;
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + (dragging ? dragScrollAdjustment.value : 0) }],
    zIndex: dragging ? 2 : 0,
  }));

  const handleContentSizeChange = (field: StepInputField, height: number) => {
    const minHeight = field === 'title' ? spacing.xl + spacing.sm : spacing.xxl * 2;
    const nextHeight = Math.max(minHeight, Math.ceil(height));
    const setHeight = field === 'title' ? setTitleHeight : setDescriptionHeight;
    setHeight((previous) => previous === nextHeight ? previous : nextHeight);
  };

  return (
    <View
      style={styles.stepRow}
      onLayout={(event) => onLayout(step.id, event.nativeEvent.layout.height)}
    >
      <SwipeableRow onDelete={onRemove} deleteIconOnly allowOverflow={dragging}>
        <Animated.View
          style={[styles.stepCard, dragStyle, dragging && styles.stepCardDragging]}
        >
          <GestureDetector gesture={dragGesture}>
            <Animated.View
              style={styles.stepCardHeader}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Schritt ${index + 1} verschieben`}
              accessibilityHint="Gedrückt halten und nach oben oder unten ziehen"
            >
              <View style={styles.stepHeaderLeading}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepHeaderLabel}>Schritt {index + 1}</Text>
              </View>
              <View style={styles.dragHandle} pointerEvents="none">
                <Icon lib="ion" name="arrow-up-outline" size="sm" color={colors.primaryBright} />
                <Icon lib="ion" name="arrow-down-outline" size="sm" color={colors.primaryBright} />
              </View>
            </Animated.View>
          </GestureDetector>

          <TextInput
            style={[styles.stepTitleInput, titleHeight != null && { height: titleHeight }]}
            placeholder="Titel des Schritts (optional)"
            placeholderTextColor={colors.textMuted}
            value={step.title}
            onChangeText={(value) => onUpdate(step.id, 'title', value)}
            onContentSizeChange={(event) => handleContentSizeChange('title', event.nativeEvent.contentSize.height)}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
          />

          <TextInput
            style={[styles.stepDescriptionInput, descriptionHeight != null && { height: descriptionHeight }]}
            placeholder="Anleitung hinzufügen"
            placeholderTextColor={colors.textMuted}
            value={step.description}
            onChangeText={(value) => onUpdate(step.id, 'description', value)}
            onContentSizeChange={(event) => handleContentSizeChange('description', event.nativeEvent.contentSize.height)}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
          />
        </Animated.View>
      </SwipeableRow>
    </View>
  );
}

interface StepDropPlaceholderProps {
  height: number;
  position: number;
}

function StepDropPlaceholder({ height, position }: StepDropPlaceholderProps) {
  return (
    <View
      style={[styles.stepDropPlaceholder, { height }]}
      accessible
      accessibilityLabel={`Hier einfügen, Position ${position}`}
    >
      <View style={styles.stepDropIndicator}>
        <View style={styles.stepDropLine} />
        <View style={styles.stepDropBadge}>
          <Icon lib="ion" name="arrow-down-outline" size="sm" color={colors.primaryBright} />
          <Text style={styles.stepDropBadgeText}>Hier einfügen · Position {position}</Text>
        </View>
        <View style={styles.stepDropLine} />
      </View>
    </View>
  );
}

interface Props {
  steps: WizardStepItem[];
  draggingStepId: string | null;
  dropTargetIndex: number | null;
  stepsScrollRef: React.RefObject<ScrollView | null>;
  dragScrollAdjustment: SharedValue<number>;
  getStepOriginTop: (index: number) => number;
  onStepsScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onStepsContentSizeChange: (width: number, height: number) => void;
  onStepsLayout: (event: LayoutChangeEvent) => void;
  onAddStep: () => void;
  onUpdateStep: (id: string, field: keyof WizardStepItem, value: string) => void;
  onRemoveStep: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, translationY: number, absoluteY: number) => void;
  onDragEnd: (id: string, translationY: number) => void;
  onStepLayout: (id: string, height: number) => void;
  onContinue: () => void;
}

export function RecipeWizardStepsPhase({
  steps,
  draggingStepId,
  dropTargetIndex,
  stepsScrollRef,
  dragScrollAdjustment,
  getStepOriginTop,
  onStepsScroll,
  onStepsContentSizeChange,
  onStepsLayout,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onDragStart,
  onDragMove,
  onDragEnd,
  onStepLayout,
  onContinue,
}: Props) {
  const renderStepEditorRows = () => {
    const isDragging = draggingStepId != null;
    const sourceIndex = isDragging
      ? steps.findIndex((step) => step.id === draggingStepId)
      : -1;
    const targetIndex = isDragging
      ? Math.max(0, Math.min(steps.length, dropTargetIndex ?? sourceIndex + 1))
      : null;
    const placeholderIndex = targetIndex != null && targetIndex > sourceIndex
      ? targetIndex - 1
      : targetIndex;
    const dropPosition = placeholderIndex != null ? placeholderIndex + 1 : 0;
    const rows: React.ReactNode[] = [];
    let remainingIndex = 0;

    steps.forEach((step, index) => {
      const stepIsDragging = step.id === draggingStepId;
      if (isDragging && !stepIsDragging && remainingIndex === placeholderIndex) {
        rows.push(
          <StepDropPlaceholder
            key="step-drop-placeholder"
            height={spacing.lg}
            position={dropPosition}
          />,
        );
      }

      rows.push(
        <Animated.View
          key={step.id}
          style={stepIsDragging
            ? [styles.stepDragOverlay, { top: getStepOriginTop(sourceIndex) }]
            : undefined}
        >
          <StepEditorRow
            step={step}
            index={index}
            dragging={stepIsDragging}
            onUpdate={onUpdateStep}
            onRemove={() => onRemoveStep(step.id)}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onLayout={onStepLayout}
            dragScrollAdjustment={dragScrollAdjustment}
          />
        </Animated.View>,
      );

      if (!stepIsDragging) remainingIndex += 1;
    });

    if (isDragging && placeholderIndex != null && placeholderIndex >= remainingIndex) {
      rows.push(
        <StepDropPlaceholder
          key="step-drop-placeholder"
          height={spacing.lg}
          position={dropPosition}
        />,
      );
    }

    return rows;
  };

  return (
    <>
      <ScrollView
        ref={stepsScrollRef}
        style={styles.phaseScroll}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        onScroll={onStepsScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onStepsContentSizeChange}
        onLayout={onStepsLayout}
      >
        <View>
          <View style={styles.stepsOverview}>
            <View style={styles.stepsSummaryLine}>
              <Text style={styles.stepsSummaryText}>
                <Text style={styles.summaryNumber}>{steps.length}</Text>{' '}
                {steps.length === 1 ? 'Schritt erkannt' : 'Schritte erkannt'}
              </Text>
            </View>
            <Text style={styles.stepsHint}>
              Überprüfe die Anleitung. Leere Schritte werden beim Speichern ignoriert.
            </Text>
          </View>

          {steps.length === 0 && (
            <Text style={styles.emptyHint}>
              Noch keine Schritte vorhanden. Füge sie manuell hinzu.
            </Text>
          )}

          <View style={styles.stepsList}>
            {renderStepEditorRows()}
          </View>

          <TouchableOpacity style={styles.addButton} onPress={onAddStep}>
            <Text style={styles.addButtonText}>+ Schritt hinzufügen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.stickyFooter}>
        {draggingStepId != null && dropTargetIndex != null && (() => {
          const sourceIndex = steps.findIndex((step) => step.id === draggingStepId);
          const insertionIndex = dropTargetIndex > sourceIndex ? dropTargetIndex - 1 : dropTargetIndex;
          return (
            <View style={styles.stepsDragStatus}>
              <Icon lib="ion" name="swap-vertical-outline" size="sm" color={colors.primaryBright} />
              <Text style={styles.stepsDragStatusText}>
                Schritt {sourceIndex + 1} · Zielposition {insertionIndex + 1}
              </Text>
            </View>
          );
        })()}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Weiter zur Vorschau →</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  phaseScroll: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: spacing.md },
  stepsOverview: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepsSummaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepsSummaryText: {
    ...typography.body1,
    color: colors.textSecondary,
    flex: 1,
  },
  summaryNumber: {
    color: colors.text,
    fontWeight: '700',
  },
  stepsHint: {
    ...typography.body2,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  emptyHint: {
    ...typography.body2,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  stepsList: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  stepDragOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
  },
  stepRow: {
    marginBottom: spacing.md,
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  stepCardDragging: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepHeaderLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  stepHeaderLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dragHandle: {
    width: spacing.xl,
    height: spacing.xl,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    borderRadius: radius.full,
  },
  stepDropPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  stepDropIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  stepDropLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.primary,
  },
  stepDropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stepDropBadgeText: {
    ...typography.caption,
    color: colors.primaryBright,
    fontWeight: '700',
  },
  stepDescriptionInput: {
    ...typography.body1,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: spacing.xxl * 2,
    textAlignVertical: 'top',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepBadgeText: {
    ...typography.caption,
    color: colors.primaryBright,
    fontWeight: '700',
  },
  stepTitleInput: {
    ...typography.h3,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: spacing.xl + spacing.sm,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addButtonText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  stickyFooter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepsDragStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  stepsDragStatusText: {
    ...typography.caption,
    color: colors.primaryBright,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
  },
});