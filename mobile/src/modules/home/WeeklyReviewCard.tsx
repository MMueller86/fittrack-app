import React, { useEffect, useReducer, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  WEEKLY_TARGET_MAX_PERCENT,
  WEEKLY_TARGET_MIN_PERCENT,
  type WeeklyTargetBand,
  type WeeklyNutritionReviewResponse,
} from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import { isValidDateOnly } from '../../shared/date/localDate';
import {
  createWeeklyReviewViewModel,
  type WeeklyReviewDayCalorieSummary,
  type WeeklyReviewDayDetailGroup,
  type WeeklyReviewDayMacroSummary,
  type WeeklyReviewDayMarker,
  type WeeklyReviewDayViewModel,
} from './weeklyReviewViewModel';
import { getWeeklyReviewErrorState } from './weeklyReviewCardState';
import {
  getWeeklyReviewEvaluationText,
  getWeeklyReviewEvaluationRenderContract,
  hasWeeklyReviewEvaluationResetInputsChanged,
  INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
  weeklyReviewEvaluationReducer,
  type WeeklyReviewEvaluationResetInputs,
} from './weeklyReviewEvaluationState';
import {
  getWeeklyReviewMarkerCells,
  getWeeklyReviewMarkerLegend,
  getWeeklyReviewMetricAccessibilityLabel,
  getWeeklyReviewMetricDisplayValue,
  getWeeklyReviewTargetBandColor,
  getWeeklyReviewVisibleWeekdayLabel,
  WEEKLY_REVIEW_BAR_SLOT_HEIGHT,
  WEEKLY_REVIEW_BAR_SLOT_TOP_MARGIN,
  WEEKLY_REVIEW_MARKER_SLOT_HEIGHT,
  WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN,
  isWeeklyReviewSpecialActivityDay,
  WEEKLY_REVIEW_SPECIAL_ACTIVITY_FRAME_TOP_OFFSET,
  WEEKLY_REVIEW_VALUE_SLOT_HEIGHT,
  WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT,
  WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN,
  WEEKLY_REVIEW_MIN_TOUCH_HEIGHT,
} from './weeklyReviewCardLayout';

const CHART_HEIGHT = WEEKLY_REVIEW_BAR_SLOT_HEIGHT;
type Percentage = `${number}%`;

interface Props {
  review: WeeklyNutritionReviewResponse | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenDiary: (date: string) => void;
}

function SkeletonLine({ width }: { width: Percentage }) {
  return <View style={[styles.skeletonLine, { width }]} />;
}

function WeeklyReviewSkeleton() {
  return (
    <Animated.View
      entering={FadeIn}
      style={[styles.card, styles.skeletonCard]}
      accessible
      accessibilityLabel="Wochenrückblick wird geladen"
    >
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonIcon} />
        <View style={styles.skeletonCopy}>
          <SkeletonLine width="58%" />
          <SkeletonLine width="34%" />
        </View>
      </View>
      <View style={styles.skeletonBars}>
        {[spacing.xl, spacing.xxl, spacing.lg, spacing.xxl, spacing.xl, spacing.lg, spacing.xxl].map(
          (height, index) => <View key={index} style={[styles.skeletonBar, { height }]} />,
        )}
      </View>
      <View style={styles.skeletonStats}>
        <SkeletonLine width="30%" />
        <SkeletonLine width="30%" />
      </View>
    </Animated.View>
  );
}

function WeeklyReviewError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={[styles.card, styles.stateCard]}>
      <View style={styles.stateContent} accessible accessibilityLabel="Wochenrückblick nicht verfügbar">
        <View style={styles.stateIcon}>
          <Icon lib="feather" name="info" size="md" color={colors.textMuted} />
        </View>
        <View style={styles.stateCopy}>
          <Text style={styles.stateTitle}>Wochenrückblick nicht geladen</Text>
          <Text style={styles.stateText}>Prüfe deine Verbindung und versuche es erneut.</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={onRetry}
        activeOpacity={0.75}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Erneut versuchen"
        accessibilityHint="Lädt den Wochenrückblick erneut."
      >
        <Icon lib="feather" name="refresh-cw" size="sm" color={colors.background} />
        <Text style={styles.retryText}>Erneut versuchen</Text>
      </TouchableOpacity>
    </View>
  );
}

function WeeklyReviewRefreshError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.refreshError}>
      <View style={styles.refreshErrorCopy} accessible accessibilityRole="text">
        <Icon lib="feather" name="alert-circle" size="sm" color={colors.textMuted} />
        <Text style={styles.refreshErrorText}>Aktualisierung fehlgeschlagen</Text>
      </View>
      <TouchableOpacity
        style={styles.refreshRetryButton}
        onPress={onRetry}
        activeOpacity={0.75}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Erneut versuchen"
        accessibilityHint="Aktualisiert den Wochenrückblick erneut."
      >
        <Text style={styles.refreshRetryText}>Erneut versuchen</Text>
        <Icon lib="feather" name="refresh-cw" size="sm" color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function getBarColor(day: WeeklyReviewDayViewModel): string {
  return getWeeklyReviewTargetBandColor(day.targetBand);
}

function getBarHeight(day: WeeklyReviewDayViewModel, scaleMaxPercent: number): Percentage {
  if (day.targetPercent == null) return '0%';
  const visiblePercent = Math.min(Math.max(day.targetPercent, 0), scaleMaxPercent);
  if (visiblePercent === 0) return `${(spacing.xs / CHART_HEIGHT) * 100}%` as Percentage;
  return `${(visiblePercent / scaleMaxPercent) * 100}%` as Percentage;
}

function WeeklyMetricRow({
  label,
  consumed,
  target,
  targetBand,
}: {
  label: string;
  consumed: string | null;
  target: string | null;
  targetBand: WeeklyTargetBand | null;
}) {
  const consumedColor = getWeeklyReviewTargetBandColor(targetBand);

  return (
    <View
      style={styles.metricRow}
      accessible
      accessibilityRole="text"
      accessibilityLabel={getWeeklyReviewMetricAccessibilityLabel(label, consumed, target)}
    >
      <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text
          style={[styles.metricValue, { color: consumedColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {getWeeklyReviewMetricDisplayValue(consumed, { omitUnit: true })}
        </Text>
        <Text style={styles.metricSeparator}> / </Text>
        <Text
          style={[styles.metricValue, styles.metricTargetValue]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {getWeeklyReviewMetricDisplayValue(target)}
        </Text>
      </View>
    </View>
  );
}

function DayValues({ day }: { day: WeeklyReviewDayViewModel }) {
  const valueColor = getWeeklyReviewTargetBandColor(day.targetBand);

  return (
    <View style={styles.valueColumn}>
      <Text
        style={[styles.percentText, { color: valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {day.percentLabel ?? '—'}
      </Text>
      <Text style={styles.calorieText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {day.consumedLabel ?? '—'}
      </Text>
    </View>
  );
}

function MissingPatternBar() {
  const patternSize = spacing.md;
  const path = [
    `M 0 ${patternSize} L ${patternSize} 0`,
    `M 0 ${patternSize * 2} L ${patternSize * 2} 0`,
    `M ${patternSize} ${patternSize * 2} L ${patternSize * 2} ${patternSize}`,
  ].join(' ');

  return (
    <View style={styles.missingBar} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${patternSize * 2} ${patternSize * 2}`}
        preserveAspectRatio="none"
      >
        <Rect width="100%" height="100%" fill={colors.surfaceMuted} />
        <Path d={path} stroke={colors.textMuted} strokeWidth={spacing.xs / 2} opacity={0.6} />
      </Svg>
    </View>
  );
}

function MissingLegendMarker() {
  const patternSize = spacing.sm;
  const path = `M 0 ${patternSize} L ${patternSize} 0 M 0 ${patternSize * 2} L ${patternSize * 2} 0`;

  return (
    <View style={styles.legendPattern} pointerEvents="none">
      <Svg width={patternSize} height={patternSize} viewBox={`0 0 ${patternSize} ${patternSize}`}>
        <Rect width="100%" height="100%" fill={colors.surfaceMuted} />
        <Path d={path} stroke={colors.textMuted} strokeWidth={spacing.xs / 2} opacity={0.8} />
      </Svg>
    </View>
  );
}

function DayMarkers({ markers }: { markers: readonly WeeklyReviewDayMarker[] }) {
  return (
    <View
      style={styles.markerContent}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {markers.map((marker) => (
        <View
          key={`${marker.kind}:${marker.label}`}
          style={styles.markerBadge}
          accessible={false}
        >
          <Icon
            {...marker.icon}
            size={spacing.sm + spacing.xs / 2}
            color={colors.textSecondary}
          />
        </View>
      ))}
    </View>
  );
}

function MarkerLegend({ markers }: { markers: WeeklyReviewDayMarker[] }) {
  if (markers.length === 0) return null;

  return (
    <View style={styles.markerLegendRow}>
      {markers.map((marker) => (
        <View
          key={`${marker.kind}:${marker.label}`}
          style={styles.markerLegendItem}
          accessible
          accessibilityRole="text"
          accessibilityLabel={marker.label}
        >
          <View
            style={styles.markerBadge}
            pointerEvents="none"
            accessible={false}
          >
            <Icon
              {...marker.icon}
              size={spacing.sm + spacing.xs / 2}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.markerLegendText} numberOfLines={2}>{marker.label}</Text>
        </View>
      ))}
    </View>
  );
}

function DayBar({
  day,
  scaleMaxPercent,
  onPress,
}: {
  day: WeeklyReviewDayViewModel;
  scaleMaxPercent: number;
  onPress: () => void;
}) {
  const hasBarData = day.hasNutrition && day.hasTarget;

  return (
    <TouchableOpacity
      style={styles.barColumn}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={day.accessibilityLabel}
      accessibilityHint="Öffnet informative Tagesdetails."
    >
      <View style={styles.barTrack}>
        <View
          style={[styles.referenceLine, { bottom: `${(100 / scaleMaxPercent) * 100}%` as Percentage }]}
          pointerEvents="none"
        />
        <View style={styles.barBaseline} />
        {hasBarData ? (
          <View style={[styles.bar, { height: getBarHeight(day, scaleMaxPercent), backgroundColor: getBarColor(day) }]} />
        ) : <MissingPatternBar />}
        <View
          style={[
            styles.targetMarker,
            { bottom: `${(100 / scaleMaxPercent) * 100}%` },
            !day.hasTarget && styles.targetMarkerUnavailable,
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

function DayMeta({ day }: { day: WeeklyReviewDayViewModel }) {
  return (
    <View style={styles.metaColumn}>
      <Text style={styles.weekdayText} numberOfLines={1}>{getWeeklyReviewVisibleWeekdayLabel(day)}</Text>
    </View>
  );
}

function DayColumn({
  day,
  markers,
  scaleMaxPercent,
  onPress,
}: {
  day: WeeklyReviewDayViewModel;
  markers: readonly WeeklyReviewDayMarker[];
  scaleMaxPercent: number;
  onPress: () => void;
}) {
  const hasSpecialActivity = isWeeklyReviewSpecialActivityDay(day);

  return (
    <View style={styles.dayColumn}>
      <DayValues day={day} />
      <DayBar day={day} scaleMaxPercent={scaleMaxPercent} onPress={onPress} />
      <DayMeta day={day} />
      <View
        style={styles.markerCell}
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <DayMarkers markers={markers} />
      </View>
      {hasSpecialActivity ? <View style={styles.specialActivityDayFrame} pointerEvents="none" /> : null}
    </View>
  );
}

function EvaluationSection({
  text,
  review,
  evaluationStatus,
}: {
  text: string | null;
  review: WeeklyNutritionReviewResponse;
  evaluationStatus: WeeklyNutritionReviewResponse['evaluation']['status'];
}) {
  const { fontScale } = useWindowDimensions();
  const evaluationText = getWeeklyReviewEvaluationText(text, evaluationStatus);
  const [evaluationState, dispatchEvaluation] = useReducer(
    weeklyReviewEvaluationReducer,
    INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
  );
  const [textContainerWidth, setTextContainerWidth] = useState(0);
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const evaluationResetInputsRef = useRef<WeeklyReviewEvaluationResetInputs | null>(null);
  const evaluationResetInputs: WeeklyReviewEvaluationResetInputs = {
    evaluationText,
    review,
    evaluationStatus,
    fontScale,
    textContainerWidth,
  };

  useEffect(() => {
    const hasResetInputsChanged = hasWeeklyReviewEvaluationResetInputsChanged(
      evaluationResetInputsRef.current,
      evaluationResetInputs,
    );
    evaluationResetInputsRef.current = evaluationResetInputs;
    if (!hasResetInputsChanged) return;

    dispatchEvaluation({ type: 'RESET' });
    setMeasurementVersion((version) => version + 1);
  }, [evaluationText, review, evaluationStatus, fontScale, textContainerWidth]);

  const measurementKey = `${measurementVersion}:${fontScale}:${textContainerWidth}`;
  const evaluationRenderContract = getWeeklyReviewEvaluationRenderContract(
    evaluationText,
    evaluationState,
  );
  const evaluationTextWidth: number | '100%' = textContainerWidth > 0 ? textContainerWidth : '100%';
  const evaluationAccessibilityLabel = evaluationText
    ? `Deine Wochenbewertung: ${evaluationText}`
    : 'Deine Wochenbewertung ist derzeit nicht verfügbar';
  const evaluationAccessibilityHint = evaluationText
    ? 'Enthält die vollständige Wochenbewertung, auch wenn sie visuell gekürzt ist.'
    : 'Informiert darüber, dass die Wochenbewertung derzeit nicht verfügbar ist.';

  return (
    <View style={styles.evaluationSection}>
      <View style={styles.evaluationHeader}>
        <Icon lib="feather" name="activity" size="md" color={colors.primaryBright} />
        <Text style={styles.evaluationTitle}>Deine Wochenbewertung</Text>
      </View>
      <View
        style={styles.evaluationTextContainer}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          setTextContainerWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
        }}
      >
        {evaluationText && textContainerWidth > 0 && (
          <Text
            key={measurementKey}
            style={[styles.evaluationText, styles.evaluationMeasureText, { width: textContainerWidth }]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            onTextLayout={(event) => dispatchEvaluation({
              type: 'MEASURE',
              lineCount: event.nativeEvent.lines.length,
            })}
          >
            {evaluationText}
          </Text>
        )}
        {evaluationText ? (
          evaluationState.isExpanded ? (
            <Text
              key={`${measurementKey}:expanded`}
              style={[styles.evaluationText, { width: evaluationTextWidth }, evaluationRenderContract.textStyle]}
              accessible
              accessibilityRole="text"
              accessibilityLabel={evaluationAccessibilityLabel}
              accessibilityHint={evaluationAccessibilityHint}
              {...evaluationRenderContract.textProps}
            >
              {evaluationText}
            </Text>
          ) : (
            <Text
              key={`${measurementKey}:collapsed`}
              style={[styles.evaluationText, { width: evaluationTextWidth }, evaluationRenderContract.textStyle]}
              accessible
              accessibilityRole="text"
              accessibilityLabel={evaluationAccessibilityLabel}
              accessibilityHint={evaluationAccessibilityHint}
              {...evaluationRenderContract.textProps}
            >
              {evaluationText}
            </Text>
          )
        ) : (
          <Text
            key={`${measurementKey}:neutral`}
            style={[styles.evaluationNeutralText, { width: evaluationTextWidth }, evaluationRenderContract.textStyle]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={evaluationAccessibilityLabel}
            accessibilityHint={evaluationAccessibilityHint}
            {...evaluationRenderContract.textProps}
          >
            Die KI-Wochenbewertung ist derzeit nicht verfügbar.
          </Text>
        )}
      </View>
      {evaluationText && evaluationRenderContract.toggle ? (
        <TouchableOpacity
          style={styles.evaluationToggle}
          onPress={() => dispatchEvaluation({ type: 'TOGGLE' })}
          activeOpacity={0.75}
          accessible
          accessibilityRole="button"
          accessibilityLabel={evaluationRenderContract.toggle.label}
          accessibilityHint={evaluationState.isExpanded
            ? 'Blendet die vollständige Wochenbewertung wieder auf zwei Zeilen ein.'
            : 'Zeigt die vollständige Wochenbewertung an.'}
          accessibilityState={{ expanded: evaluationState.isExpanded }}
        >
          <Text style={styles.evaluationToggleText}>{evaluationRenderContract.toggle.label}</Text>
          <Icon lib="feather" name={evaluationRenderContract.toggle.iconName} size="sm" color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function WeeklyDayDetailGroups({ groups }: { groups: WeeklyReviewDayDetailGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <View style={styles.detailGroups}>
      {groups.map((group) => (
        <View
          key={group.label}
          style={styles.detailGroup}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${group.label}: ${group.value}`}
        >
          <Text style={styles.detailLabel}>{group.label}</Text>
          <Text style={styles.detailValue} numberOfLines={2}>{group.value}</Text>
        </View>
      ))}
    </View>
  );
}

function WeeklyDayMacroValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macroValueBlock}>
      <Text style={styles.macroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
      <Text style={styles.macroLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function getCalorieSummaryColor(summary: WeeklyReviewDayCalorieSummary): string {
  if (summary.targetBand === 'outside_range') return colors.warning;
  if (summary.targetBand === 'in_range') return colors.primary;
  return colors.neutral;
}

function WeeklyDayCalorieSummary({ summary }: { summary: WeeklyReviewDayCalorieSummary }) {
  const progressColor = getCalorieSummaryColor(summary);

  return (
    <View
      style={styles.calorieSummary}
      accessible
      accessibilityRole="text"
      accessibilityLabel={summary.accessibilityLabel}
    >
      {summary.isAvailable ? (
        <>
          <View style={styles.calorieValueRow}>
            <View style={styles.calorieValueCopy}>
              <Text style={styles.calorieConsumed} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {summary.consumedLabel ?? '—'}
              </Text>
              <Text style={styles.calorieTarget} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                von {summary.targetLabel ?? '—'}
              </Text>
            </View>
            <Text
              style={[styles.caloriePercent, { color: progressColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {summary.percentLabel ?? '—'}
            </Text>
          </View>
          <View style={styles.calorieTrack}>
            <View style={[styles.calorieFill, { width: `${(summary.progressRatio ?? 0) * 100}%`, backgroundColor: progressColor }]} />
            <View style={styles.calorieTargetMarker} />
          </View>
        </>
      ) : (
        <Text style={styles.macroMissingText}>Kalorienvergleich nicht verfügbar.</Text>
      )}
    </View>
  );
}

function WeeklyDayMacroSummary({
  summary,
  calorieSummary,
}: {
  summary: WeeklyReviewDayMacroSummary;
  calorieSummary: WeeklyReviewDayCalorieSummary;
}) {
  return (
    <View style={styles.macroSummary}>
      <WeeklyDayCalorieSummary summary={calorieSummary} />
      {summary.isAvailable ? (
        <View
          style={styles.macroValuesRow}
          accessible
          accessibilityRole="text"
          accessibilityLabel={summary.accessibilityLabel}
        >
          <WeeklyDayMacroValue label="Protein" value={summary.proteinLabel ?? '—'} />
          <WeeklyDayMacroValue label="Kohlenhydrate" value={summary.carbsLabel ?? '—'} />
          <WeeklyDayMacroValue label="Fett" value={summary.fatLabel ?? '—'} />
        </View>
      ) : (
        <Text
          style={styles.macroMissingText}
          accessibilityRole="text"
          accessibilityLabel="Makrodaten nicht verfügbar"
        >
          Makrodaten nicht verfügbar.
        </Text>
      )}
    </View>
  );
}

function WeeklyMetrics({ viewModel }: { viewModel: ReturnType<typeof createWeeklyReviewViewModel> }) {
  return (
    <View style={styles.metricsSection}>
      <WeeklyMetricRow
        label="7-Tage-Ziel"
        consumed={viewModel.totalConsumedLabel}
        target={viewModel.totalTargetLabel}
        targetBand={viewModel.overallTargetBand}
      />
      <WeeklyMetricRow
        label="Ø Ziel / Tag"
        consumed={viewModel.averageConsumedLabel}
        target={viewModel.averageTargetLabel}
        targetBand={viewModel.overallTargetBand}
      />
    </View>
  );
}

function WeeklyReviewContent({
  review,
  error,
  onRetry,
  onOpenDiary,
}: {
  review: WeeklyNutritionReviewResponse;
  error: boolean;
  onRetry: () => void;
  onOpenDiary: (date: string) => void;
}) {
  const viewModel = createWeeklyReviewViewModel(review);
  const [selectedDay, setSelectedDay] = useState<WeeklyReviewDayViewModel | null>(null);
  const diaryNavigationLock = useRef(false);
  const markerLegend = getWeeklyReviewMarkerLegend(viewModel.days);
  const markerCells = getWeeklyReviewMarkerCells(viewModel.days);
  const chartDays = viewModel.days.slice(0, markerCells.length);

  useEffect(() => {
    setSelectedDay(null);
    diaryNavigationLock.current = false;
  }, [review]);

  const handleDayPress = (day: WeeklyReviewDayViewModel) => {
    diaryNavigationLock.current = false;
    setSelectedDay(day);
  };

  const handleOpenDiary = () => {
    if (!selectedDay || diaryNavigationLock.current) return;
    if (!isValidDateOnly(selectedDay.date)) return;
    diaryNavigationLock.current = true;
    const selectedDate = selectedDay.date;
    setSelectedDay(null);
    onOpenDiary(selectedDate);
  };

  return (
    <Animated.View entering={FadeIn} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Icon lib="feather" name="bar-chart-2" size="md" color={colors.primaryBright} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={2}>Letzte 7 Tage</Text>
          <Text style={styles.period}>{viewModel.periodLabel}</Text>
        </View>
        <View
          style={styles.headerPercent}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Zielerreichung in Prozent: ${viewModel.overallPercentLabel ?? 'Nicht verfügbar'}`}
        >
          <Text style={styles.headerPercentLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
            Zielerreichung in Prozent
          </Text>
          <Text
            style={[styles.headerPercentValue, { color: getWeeklyReviewTargetBandColor(viewModel.overallTargetBand) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {viewModel.overallPercentLabel ?? '—'}
          </Text>
        </View>
      </View>

      {error ? <WeeklyReviewRefreshError onRetry={onRetry} /> : null}

      <View style={styles.dayGrid}>
        {chartDays.map((day, index) => (
          <DayColumn
            key={day.date}
            day={day}
            markers={markerCells[index]?.markers ?? []}
            scaleMaxPercent={viewModel.chartScaleMaxPercent}
            onPress={() => handleDayPress(day)}
          />
        ))}
      </View>

      <MarkerLegend markers={markerLegend} />

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>{`Im Ziel (${WEEKLY_TARGET_MIN_PERCENT}\u2013${WEEKLY_TARGET_MAX_PERCENT} %)`}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Nicht im Ziel</Text>
        </View>
        <View style={styles.legendItem}>
          <MissingLegendMarker />
          <Text style={styles.legendText}>Keine Daten</Text>
        </View>
      </View>

      <WeeklyMetrics viewModel={viewModel} />

      <EvaluationSection
        text={review.evaluation.text}
        review={review}
        evaluationStatus={review.evaluation.status}
      />

      <InfoOverlay
        visible={selectedDay != null}
        title={selectedDay?.overlayDetails.title ?? ''}
        body={selectedDay?.overlayDetails.body ?? ''}
        onClose={() => setSelectedDay(null)}
        secondaryAction={{
          label: 'Tagebuch öffnen',
          onPress: handleOpenDiary,
          accessibilityLabel: 'Tagebuch für diesen Tag öffnen',
          accessibilityHint: 'Öffnet das Tagebuch mit dem ausgewählten Datum.',
        }}
      >
        {selectedDay && (
          <>
            <WeeklyDayDetailGroups groups={selectedDay.overlayDetails.detailGroups} />
            <WeeklyDayMacroSummary
              summary={selectedDay.macroSummary}
              calorieSummary={selectedDay.calorieSummary}
            />
          </>
        )}
      </InfoOverlay>
    </Animated.View>
  );
}

export function WeeklyReviewCard({ review, loading, error, onRetry, onOpenDiary }: Props) {
  const errorState = getWeeklyReviewErrorState(review != null, error);

  if (!review) {
    if (errorState === 'initial') return <WeeklyReviewError onRetry={onRetry} />;
    if (loading) return <WeeklyReviewSkeleton />;
    return <WeeklyReviewSkeleton />;
  }

  return (
    <WeeklyReviewContent
      review={review}
      error={errorState === 'stale'}
      onRetry={onRetry}
      onOpenDiary={onOpenDiary}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'visible',
    padding: spacing.md,
    marginHorizontal: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700' as const,
  },
  period: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  headerPercent: {
    flexBasis: spacing.xxl * 2,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  headerPercentLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
    flexShrink: 1,
  },
  headerPercentValue: {
    ...typography.body1,
    fontWeight: '700' as const,
    textAlign: 'right',
  },
  dayGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
    alignItems: 'stretch',
  },
  dayColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'stretch',
    position: 'relative',
    overflow: 'visible',
  },
  specialActivityDayFrame: {
    position: 'absolute',
    top: WEEKLY_REVIEW_SPECIAL_ACTIVITY_FRAME_TOP_OFFSET,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: colors.chart.specialActivityOutline,
    borderRadius: radius.sm,
  },
  valueColumn: {
    width: '100%',
    minWidth: 0,
    height: WEEKLY_REVIEW_VALUE_SLOT_HEIGHT,
    flexShrink: 0,
    alignItems: 'center',
    gap: spacing.xs,
  },
  percentText: {
    ...typography.body2,
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: typography.body2.fontSize,
  },
  calorieText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.caption.fontSize,
  },
  referenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: colors.textSecondary,
    borderStyle: 'dashed',
    zIndex: 3,
  },
  barColumn: {
    width: '100%',
    minWidth: 0,
    height: WEEKLY_REVIEW_BAR_SLOT_HEIGHT,
    flexShrink: 0,
    alignItems: 'center',
    marginTop: WEEKLY_REVIEW_BAR_SLOT_TOP_MARGIN,
  },
  barTrack: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  barBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  bar: {
    width: '72%',
    borderRadius: radius.sm,
  },
  markerContent: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    columnGap: spacing.xs / 2,
    rowGap: 0,
  },
  markerBadge: {
    width: spacing.sm + spacing.xs,
    height: spacing.sm + spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingBar: {
    width: '72%',
    height: '100%',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  targetMarker: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
    zIndex: 2,
  },
  targetMarkerUnavailable: {
    backgroundColor: colors.textMuted,
    opacity: 0.75,
  },
  metaColumn: {
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
    height: WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT,
    flexShrink: 0,
    justifyContent: 'flex-start',
    marginTop: WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN,
  },
  weekdayText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: typography.caption.fontSize,
  },
  markerCell: {
    width: '100%',
    minWidth: 0,
    height: WEEKLY_REVIEW_MARKER_SLOT_HEIGHT,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '30%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.full,
    flexShrink: 0,
  },
  legendPattern: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.sm,
    overflow: 'hidden',
    flexShrink: 0,
  },
  legendText: {
    ...typography.caption,
    color: colors.textSecondary,
    minWidth: 0,
    flexShrink: 1,
  },
  markerLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  markerLegendItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '30%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  markerLegendText: {
    ...typography.caption,
    color: colors.textSecondary,
    minWidth: 0,
    flexShrink: 1,
  },
  evaluationSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    minWidth: 0,
    overflow: 'visible',
  },
  evaluationTextContainer: {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    overflow: 'visible',
  },
  evaluationMeasureText: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  evaluationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  evaluationTitle: {
    ...typography.h3,
    color: colors.text,
  },
  evaluationText: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  evaluationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: spacing.xxl,
    paddingVertical: spacing.xs,
  },
  evaluationToggleText: {
    ...typography.button,
    color: colors.primary,
  },
  evaluationNeutralText: {
    ...typography.body2,
    color: colors.textMuted,
    lineHeight: 20,
  },
  detailGroups: {
    gap: spacing.sm,
  },
  detailGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    minWidth: 0,
  },
  detailValue: {
    ...typography.body2,
    color: colors.text,
    flex: 1.35,
    minWidth: 0,
    textAlign: 'right',
  },
  macroSummary: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  calorieSummary: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  calorieValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  calorieValueCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  calorieConsumed: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '700' as const,
  },
  calorieTarget: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  caloriePercent: {
    ...typography.body1,
    fontWeight: '700' as const,
  },
  calorieTrack: {
    height: spacing.sm,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
    position: 'relative',
  },
  calorieFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  calorieTargetMarker: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: spacing.xs / 2,
    backgroundColor: colors.text,
  },
  macroValuesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  macroValueBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xs,
  },
  macroValue: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '700' as const,
  },
  macroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  macroMissingText: {
    ...typography.body2,
    color: colors.textMuted,
  },
  metricsSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    minWidth: 0,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  metricValue: {
    ...typography.body2,
    fontWeight: '700' as const,
    flexShrink: 1,
    minWidth: 0,
  },
  metricTargetValue: {
    color: colors.neutral,
  },
  metricSeparator: {
    ...typography.body2,
    color: colors.textMuted,
  },
  skeletonCard: {
    gap: spacing.lg,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  skeletonIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  skeletonCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonLine: {
    height: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  skeletonStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonBars: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  skeletonBar: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.border,
    borderRadius: radius.sm,
  },
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  stateTitle: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '600' as const,
  },
  stateText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    minHeight: WEEKLY_REVIEW_MIN_TOUCH_HEIGHT,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    flexShrink: 1,
  },
  retryText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '600' as const,
  },
  refreshError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  refreshErrorCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  refreshErrorText: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
  refreshRetryButton: {
    minHeight: WEEKLY_REVIEW_MIN_TOUCH_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    flexShrink: 1,
  },
  refreshRetryText: {
    ...typography.button,
    color: colors.primary,
    flexShrink: 1,
  },
});