import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecipeIngredient } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { MealChip } from '../../shared/components/MealChip';
import { hasDistinctRecipeShareUris } from './recipeShareDraftState';
import {
  MAX_RECIPE_INSTAGRAM_TAGS,
  toggleRecipeInstagramTag,
  type RecipeInstagramOptions,
} from './recipeInstagramOptions';
import type { WizardExportDraft } from './recipeWizardTypes';
import {
  RECIPE_EXPORT_MAX_INGREDIENTS,
  RECIPE_EXPORT_MAX_STEP_LENGTH,
  RECIPE_EXPORT_MAX_STEPS,
  RECIPE_EXPORT_MAX_TEASER_LENGTH,
  RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES,
} from '../../../../shared/types/recipeExport';
import type {
  RecipeShareAssetStatus,
  RecipeShareRenderStage,
  RecipeShareRenderStatus,
  RecipeShareStatus,
} from './recipeShareDraftState';

const SHARE_PREVIEW_ASPECT_RATIO = 1080 / 1350;
type PreviewAsset = 'instagram' | 'detail';

function CharacterCounter({ length, max, testID }: { length: number; max: number; testID: string }) {
  const remaining = Math.max(0, max - length);
  const nearLimit = remaining <= Math.ceil(max / 10);
  return (
    <Text style={[styles.characterCount, nearLimit && styles.characterCountNear]} testID={testID}>
      Noch {remaining} von {max} Zeichen frei
    </Text>
  );
}

export interface RecipeInstagramPreviewProps {
  visible: boolean;
  preparationMessage: string | null;
  providerRequestInFlight: boolean;
  instagramUri: string | null;
  detailUri: string | null;
  exportDraft: WizardExportDraft | null;
  exportIngredients: readonly RecipeIngredient[];
  recipeTags: readonly string[];
  selectedTags: readonly string[];
  nutritionHighlight: RecipeInstagramOptions['nutritionHighlight'];
  previewErrors: readonly string[];
  saveErrors: readonly string[];
  exportDraftValid: boolean;
  exportDraftSaveValid: boolean;
  exportDraftNeedsSaving: boolean;
  canChangeOptions: boolean;
  renderStatus: RecipeShareRenderStatus;
  renderStage: RecipeShareRenderStage;
  assetStatus: RecipeShareAssetStatus;
  shareStatus: RecipeShareStatus;
  canAdjustCrop: boolean;
  busy: boolean;
  onClose: () => void;
  onChangeExportDraft: (draft: WizardExportDraft) => void;
  onToggleIncludedIngredient: (ingredientId: string) => void;
  onChangeOptions: (options: RecipeInstagramOptions) => void;
  onUpdatePreview: () => void;
  onSaveExportDraft: () => Promise<boolean>;
  onAdjustCrop: () => void;
  onRetryRender: () => void;
  onSaveAndShare: () => void;
}

export function RecipeInstagramPreview({
  visible,
  preparationMessage,
  providerRequestInFlight,
  instagramUri,
  detailUri,
  exportDraft,
  exportIngredients,
  recipeTags,
  selectedTags,
  nutritionHighlight,
  previewErrors,
  saveErrors,
  exportDraftValid,
  exportDraftSaveValid,
  exportDraftNeedsSaving,
  canChangeOptions,
  renderStatus,
  renderStage,
  assetStatus,
  shareStatus,
  canAdjustCrop,
  busy,
  onClose,
  onChangeExportDraft: emitExportDraftChange,
  onToggleIncludedIngredient: emitIncludedIngredientToggle,
  onUpdatePreview,
  onSaveExportDraft,
  onAdjustCrop,
  onChangeOptions: emitOptionsChange,
  onRetryRender,
  onSaveAndShare,
}: RecipeInstagramPreviewProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [viewerLayout, setViewerLayout] = useState({ width: 0, height: 0 });
  const viewerWidth = viewerLayout.width || windowWidth;
  const [editingOptionsAndTexts, setEditingOptionsAndTexts] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<PreviewAsset>('instagram');
  const [previewOutdated, setPreviewOutdated] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<PreviewAsset | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerIndexRef = useRef(0);
  const viewerRef = useRef<ScrollView>(null);
  const isRendering = renderStatus === 'loading';
  const isSaving = busy || assetStatus === 'loading' || shareStatus === 'loading';
  const hasPair = hasDistinctRecipeShareUris(instagramUri, detailUri);
  const previewAssets: PreviewAsset[] = ['instagram', 'detail'];
  const viewerAssets = previewAssets.filter((asset) => asset === 'instagram' ? instagramUri : detailUri);
  const showIngredientSelection = exportIngredients.length > RECIPE_EXPORT_MAX_INGREDIENTS;
  const canSave = hasPair
    && renderStatus === 'ready'
    && exportDraftValid
    && !previewOutdated
    && !isSaving;
  const canRefreshPreview = exportDraftValid && !isSaving && !isRendering;
  const savesOnRefresh = exportDraftSaveValid && exportDraftNeedsSaving;
  const hasEditorErrors = previewErrors.length > 0 || saveErrors.length > 0;
  const editorStatus = savesOnRefresh
    ? 'Geänderte Texte werden beim Aktualisieren im Rezept gespeichert.'
    : null;
  const cropDisabled = !hasPair || isSaving || isRendering || !canAdjustCrop;
  useEffect(() => {
    setEditingOptionsAndTexts(false);
    setSelectedAsset('instagram');
    setPreviewOutdated(false);
    setExpandedAsset(null);
  }, [visible]);

  useEffect(() => {
    if (expandedAsset === null) return;
    if (viewerAssets.length === 0) {
      setExpandedAsset(null);
      return;
    }
    const index = Math.min(viewerIndexRef.current, viewerAssets.length - 1);
    viewerIndexRef.current = index;
    viewerRef.current?.scrollTo({ x: index * viewerWidth, animated: false });
    setViewerIndex(index);
  }, [expandedAsset, viewerWidth, instagramUri, detailUri]);

  // Editor changes do not re-render; until the next refresh the PNGs no longer match the draft.
  const onChangeExportDraft = (draft: WizardExportDraft) => {
    setPreviewOutdated(true);
    emitExportDraftChange(draft);
  };
  const onToggleIncludedIngredient = (ingredientId: string) => {
    setPreviewOutdated(true);
    emitIncludedIngredientToggle(ingredientId);
  };
  const onChangeOptions = (options: RecipeInstagramOptions) => {
    setPreviewOutdated(true);
    emitOptionsChange(options);
  };

  const handleRefreshPreview = async () => {
    if (!canRefreshPreview) return;
    if (savesOnRefresh) {
      if (!(await onSaveExportDraft())) return;
    } else {
      onUpdatePreview();
    }
    setPreviewOutdated(false);
    setEditingOptionsAndTexts(false);
  };

  if (preparationMessage != null) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View
          style={[
            styles.preparationPage,
            { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <Animated.View
            style={styles.preparationContent}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
          >
            {providerRequestInFlight ? (
              <ActivityIndicator color={colors.primaryBright} size="large" />
            ) : null}
            <Text style={styles.preparationText}>{preparationMessage}</Text>
            <TouchableOpacity
              style={styles.preparationCancel}
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
            >
              <Text style={styles.secondaryButtonText}>Abbrechen</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  if (expandedAsset !== null) {
    const moveViewer = (index: number) => {
      viewerIndexRef.current = index;
      setViewerIndex(index);
      viewerRef.current?.scrollTo({ x: index * viewerWidth, animated: true });
    };
    return (
      <Modal visible={visible} animationType="fade" onRequestClose={() => setExpandedAsset(null)}>
        <View style={[
          styles.viewerPage,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}>
          <View style={styles.viewerHeader}>
            <Text style={styles.title}>
              {viewerAssets[viewerIndex] === 'instagram' ? 'Titelbild' : 'Detailbild'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setExpandedAsset(null)}
              accessibilityRole="button"
              accessibilityLabel="Großansicht schließen"
            >
              <Icon lib="feather" name="x" size="lg" color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={viewerRef}
            testID="recipe-share-image-viewer"
            style={styles.viewerScroll}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (expandedAsset === 'detail' && instagramUri ? 1 : 0) * viewerWidth, y: 0 }}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              if (width > 0 && height > 0) setViewerLayout({ width, height });
            }}
            onMomentumScrollEnd={(event) => {
              const index = Math.max(0, Math.min(
                viewerAssets.length - 1,
                Math.round(event.nativeEvent.contentOffset.x / viewerWidth),
              ));
              viewerIndexRef.current = index;
              setViewerIndex(index);
            }}
          >
            {viewerAssets.map((asset) => (
              <View key={asset} style={[
                styles.viewerSlide,
                { width: viewerWidth, height: viewerLayout.height || '100%' },
              ]}>
                <Animated.Image
                  source={{ uri: asset === 'instagram' ? instagramUri! : detailUri! }}
                  resizeMode="contain"
                  style={styles.previewImage}
                  accessibilityLabel={asset === 'instagram' ? 'Titelbild in Großansicht' : 'Detailbild in Großansicht'}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.viewerFooter}>
            {viewerAssets.length > 1 ? (
              <View style={styles.viewerPagination}>
                <TouchableOpacity
                  style={[styles.closeButton, viewerIndex === 0 && styles.disabledButton]}
                  disabled={viewerIndex === 0}
                  onPress={() => moveViewer(viewerIndex - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Vorheriges Bild"
                  accessibilityState={{ disabled: viewerIndex === 0 }}
                >
                  <Icon lib="feather" name="chevron-left" size="md" color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.helperText} accessibilityLiveRegion="polite">
                  {viewerIndex + 1} von {viewerAssets.length}
                </Text>
                <TouchableOpacity
                  style={[styles.closeButton, viewerIndex === viewerAssets.length - 1 && styles.disabledButton]}
                  disabled={viewerIndex === viewerAssets.length - 1}
                  onPress={() => moveViewer(viewerIndex + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Nächstes Bild"
                  accessibilityState={{ disabled: viewerIndex === viewerAssets.length - 1 }}
                >
                  <Icon lib="feather" name="chevron-right" size="md" color={colors.text} />
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.primaryButton, (isSaving || !canChangeOptions || !exportDraft) && styles.primaryButtonDisabled]}
              onPress={() => {
                setSelectedAsset(viewerAssets[viewerIndex] ?? expandedAsset);
                setExpandedAsset(null);
                setEditingOptionsAndTexts(true);
              }}
              disabled={isSaving || !canChangeOptions || !exportDraft}
              accessibilityRole="button"
              accessibilityLabel="Optionen & Texte bearbeiten"
              accessibilityState={{ disabled: isSaving || !canChangeOptions || !exportDraft }}
            >
              <Icon lib="feather" name="edit-3" size="sm" color={colors.background} />
              <Text style={styles.primaryButtonText}>Optionen &amp; Texte bearbeiten</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm },
        ]}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Vorschau schließen"
        />

        <Animated.View
          style={styles.card}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
        >
          <View style={styles.header}>
            {editingOptionsAndTexts ? (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setEditingOptionsAndTexts(false)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Zurück zur Vorschau"
              >
                <Icon lib="feather" name="arrow-left" size="md" color={colors.text} />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.title}>
              {editingOptionsAndTexts ? 'Bilder anpassen' : 'Rezept teilen'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Vorschau schließen"
              accessibilityState={{ disabled: isSaving }}
            >
              <Icon lib="feather" name="x" size="lg" color={colors.text} />
            </TouchableOpacity>
          </View>

          {editingOptionsAndTexts ? (
            <View
              style={styles.assetSelector}
              testID="recipe-share-asset-selector"
              accessibilityRole="tablist"
            >
              {previewAssets.map((asset) => {
                const label = asset === 'instagram' ? 'Titelbild' : 'Detailbild';
                const selected = asset === selectedAsset;
                return (
                  <TouchableOpacity
                    key={asset}
                    style={[styles.assetTab, selected && styles.assetTabSelected]}
                    onPress={() => setSelectedAsset(asset)}
                    hitSlop={{ top: spacing.xs, bottom: spacing.xs }}
                    activeOpacity={0.8}
                    accessibilityRole="tab"
                    accessibilityLabel={`${label} auswählen`}
                    accessibilityHint="Zeigt nur das ausgewählte Bild in der Vorschau."
                    accessibilityState={{ selected }}
                  >
                    <Icon
                      lib="feather"
                      name={asset === 'instagram' ? 'image' : 'file-text'}
                      size="sm"
                      color={selected ? colors.primaryBright : colors.textSecondary}
                    />
                    <Text style={[styles.assetTabText, selected && styles.assetTabTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={editingOptionsAndTexts ? [styles.previewPair, styles.previewStage] : styles.previewPair}
              testID={editingOptionsAndTexts ? 'recipe-share-preview-selected' : 'recipe-share-preview-pair'}
            >
              {previewAssets.map((asset) => {
                const label = asset === 'instagram' ? 'Titelbild' : 'Detailbild';
                const uri = asset === 'instagram' ? instagramUri : detailUri;
                const hidden = editingOptionsAndTexts && asset !== selectedAsset;
                return (
                  <View
                    key={asset}
                    testID={`recipe-share-preview-column-${asset}`}
                    style={[
                      styles.previewColumn,
                      editingOptionsAndTexts ? styles.previewSingleColumn : null,
                      hidden ? styles.previewColumnHidden : null,
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        if (!uri || isRendering || isSaving) return;
                        const index = viewerAssets.indexOf(asset);
                        viewerIndexRef.current = index;
                        setViewerIndex(index);
                        setExpandedAsset(asset);
                      }}
                      disabled={!uri || isRendering || isSaving}
                      accessibilityRole="button"
                      accessibilityLabel={`${label} vergrößern`}
                      accessibilityHint="Öffnet die bildschirmfüllende Vorschau"
                      accessibilityState={{ disabled: !uri || isRendering || isSaving }}
                    >
                    <View style={styles.previewFrame}>
                      {uri ? (
                        <Animated.Image
                          key={uri}
                          source={{ uri }}
                          resizeMode="contain"
                          style={styles.previewImage}
                          entering={FadeIn.duration(180)}
                        />
                      ) : isRendering ? (
                        <View style={styles.loadingState}>
                          <ActivityIndicator color={colors.primaryBright} />
                          <Text style={styles.loadingText}>Vorschau wird erstellt…</Text>
                        </View>
                      ) : (
                        <Text style={styles.loadingText}>
                          {exportDraftValid
                            ? 'Vorschau aktualisieren.'
                            : 'Bitte korrigiere die markierten Felder.'}
                        </Text>
                      )}

                      {uri && !isRendering ? (
                        <View style={styles.expandIndicator} pointerEvents="none">
                          <Icon lib="feather" name="maximize-2" size="sm" color={colors.textSecondary} />
                        </View>
                      ) : null}

                      {uri && isRendering ? (
                        <View style={styles.renderingOverlay} pointerEvents="none">
                          <ActivityIndicator color={colors.primaryBright} />
                          <Text style={styles.renderingText}>
                            {renderStage === 'final' ? 'Wird aktualisiert…' : 'Wird gerendert…'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    </Pressable>
                    {hidden ? null : (
                      <Text style={styles.stageCaption}>
                        {editingOptionsAndTexts && uri && !isRendering
                          ? `${label} · Tippen zum Vergrößern`
                          : label}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {previewOutdated && hasPair && !editingOptionsAndTexts ? (
              <Text style={[styles.previewHint, styles.previewHintOutdated]}>
                Deine Änderungen sind noch nicht in den Bildern. Öffne „Optionen &amp; Texte bearbeiten“ und aktualisiere die Vorschau.
              </Text>
            ) : null}

            {renderStatus === 'ready' && hasPair && !editingOptionsAndTexts && !previewOutdated ? (
              <Text style={styles.previewHint}>
                Check beide Bilder kurz durch. Texte, Ausschnitt und Tags kannst du jederzeit anpassen.
              </Text>
            ) : null}

            {editingOptionsAndTexts && exportDraft ? (
              <>
                {selectedAsset === 'instagram' ? (
                <View style={styles.editorSection} testID="recipe-share-editor-title-section">
                  <TouchableOpacity
                    style={[styles.secondaryButton, cropDisabled && styles.disabledButton]}
                    onPress={onAdjustCrop}
                    disabled={cropDisabled}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Ausschnitt anpassen"
                    accessibilityState={{ disabled: cropDisabled }}
                  >
                    <Icon lib="feather" name="crop" size="md" color={colors.primaryBright} />
                    <Text style={styles.secondaryButtonText}>Ausschnitt anpassen</Text>
                  </TouchableOpacity>

                  <View style={styles.metadataRow}>
                    <View style={styles.metadataField}>
                      <Text style={styles.fieldLabel}>Zeit (Min.)</Text>
                      <TextInput
                        style={styles.input}
                        value={exportDraft.totalTimeMinutes}
                        onChangeText={(totalTimeMinutes) => onChangeExportDraft({
                          ...exportDraft,
                          totalTimeMinutes,
                        })}
                        keyboardType="number-pad"
                        placeholder="Optional"
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel="Zubereitungszeit in Minuten"
                      />
                      <Text style={styles.fieldHint}>
                        1 bis {RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES.toLocaleString('de-DE')} Minuten
                      </Text>
                    </View>
                    <View style={styles.metadataField}>
                      <Text style={styles.fieldLabel}>Schwierigkeit</Text>
                      <TextInput
                        style={styles.input}
                        value={exportDraft.difficulty}
                        onChangeText={(difficulty) => onChangeExportDraft({ ...exportDraft, difficulty })}
                        placeholder="Optional"
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel="Export-Schwierigkeit"
                      />
                      <Text style={styles.fieldHint}>
                        Eine Zeile, kurz halten
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>Tags</Text>
                  {recipeTags.length === 0 ? (
                    <Text style={styles.helperText}>Für dieses Rezept sind keine Tags hinterlegt.</Text>
                  ) : (
                    <>
                      <View style={styles.tagList}>
                        {recipeTags.map((tag, index) => {
                          const selected = selectedTags.includes(tag);
                          const disabled = !selected && selectedTags.length >= MAX_RECIPE_INSTAGRAM_TAGS;
                          return (
                            <MealChip
                              key={`${tag}-${index}`}
                              label={tag}
                              filled={selected}
                              compact
                              disabled={disabled || !canChangeOptions}
                              onPress={() => onChangeOptions({
                                selectedTags: toggleRecipeInstagramTag(recipeTags, selectedTags, tag),
                                nutritionHighlight,
                              })}
                              accessibilityRole="checkbox"
                              accessibilityLabel={`Tag ${tag}`}
                              accessibilityState={{ checked: selected, disabled }}
                            />
                          );
                        })}
                      </View>
                      <Text style={styles.ingredientCount}>
                        {selectedTags.length} von {MAX_RECIPE_INSTAGRAM_TAGS} ausgewählt
                      </Text>
                    </>
                  )}

                  <View style={styles.toggleRow}>
                    <View style={styles.toggleCopy}>
                      <Text style={styles.toggleLabel}>High-Protein-Symbol anzeigen</Text>
                      <Text style={styles.helperText}>
                        {nutritionHighlight === 'high-protein' ? 'High-Protein' : 'Kein Highlight'}
                      </Text>
                    </View>
                    <Switch
                      value={nutritionHighlight === 'high-protein'}
                      disabled={!canChangeOptions}
                      onValueChange={(enabled) => onChangeOptions({
                        selectedTags: [...selectedTags],
                        nutritionHighlight: enabled ? 'high-protein' : null,
                      })}
                      trackColor={{ false: colors.surfaceMuted, true: colors.primaryDark }}
                      thumbColor={nutritionHighlight === 'high-protein' ? colors.primaryBright : colors.textMuted}
                      accessibilityRole="switch"
                      accessibilityLabel="High-Protein-Symbol anzeigen"
                      accessibilityState={{ checked: nutritionHighlight === 'high-protein' }}
                    />
                  </View>
                </View>
                ) : (
                <View style={styles.editorSection} testID="recipe-share-editor-detail-section">
                  <Text style={styles.fieldLabel}>Teaser</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={exportDraft.teaser}
                    onChangeText={(teaser) => onChangeExportDraft({ ...exportDraft, teaser })}
                    maxLength={RECIPE_EXPORT_MAX_TEASER_LENGTH}
                    multiline
                    textAlignVertical="top"
                    placeholder="Kurzer Text für das Bild"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Export-Teaser"
                  />
                  <CharacterCounter
                    length={exportDraft.teaser.length}
                    max={RECIPE_EXPORT_MAX_TEASER_LENGTH}
                    testID="recipe-share-teaser-character-count"
                  />
                  {showIngredientSelection ? (
                    <>
                      <View style={styles.ingredientHeader}>
                        <Text style={styles.fieldLabel}>Zutaten im Bild</Text>
                        <Text style={styles.ingredientCount}>
                          {exportDraft.includedIngredientIds.length} von {RECIPE_EXPORT_MAX_INGREDIENTS}
                        </Text>
                      </View>
                      {exportIngredients.map((ingredient, index) => {
                        const isSeasoning = (ingredient.category ?? 'food') === 'seasoning';
                        const selected = exportDraft.includedIngredientIds.includes(ingredient.id);
                        const atLimit = exportDraft.includedIngredientIds.length >= RECIPE_EXPORT_MAX_INGREDIENTS;
                        const disabled = isSeasoning || (!selected && atLimit);
                        return (
                          <View key={`${ingredient.id}-${index}`} style={styles.ingredientRow}>
                            <Text style={[styles.ingredientName, isSeasoning && styles.ingredientNameDisabled]}>
                              {ingredient.displayName}
                            </Text>
                            <Switch
                              value={selected}
                              onValueChange={() => onToggleIncludedIngredient(ingredient.id)}
                              disabled={disabled}
                              trackColor={{ false: colors.surfaceMuted, true: colors.primaryDark }}
                              thumbColor={selected ? colors.primaryBright : colors.textMuted}
                              accessibilityRole="switch"
                              accessibilityLabel={`${ingredient.displayName} im Bild anzeigen`}
                              accessibilityState={{ checked: selected, disabled }}
                            />
                          </View>
                        );
                      })}
                    </>
                  ) : null}

                  <Text style={styles.fieldLabel}>Zubereitungsschritte</Text>
                  {exportDraft.steps.map((step, index) => (
                    <View key={`export-step-${index}`} style={styles.stepEditor}>
                      <View style={styles.stepEditorHeader} testID={`export-step-header-${index}`}>
                        <Text style={styles.stepLabel}>Schritt {index + 1}</Text>
                        {exportDraft.steps.length > 1 ? (
                          <TouchableOpacity
                            style={styles.removeStepButton}
                            onPress={() => onChangeExportDraft({
                              ...exportDraft,
                              steps: exportDraft.steps
                                .filter((_, stepIndex) => stepIndex !== index)
                                .map((item, stepIndex) => ({ ...item, order: stepIndex + 1 })),
                            })}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={`Exportschritt ${index + 1} entfernen`}
                            accessibilityHint="Entfernt diesen Zubereitungsschritt"
                          >
                            <Icon lib="feather" name="trash-2" size="sm" color={colors.textMuted} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <TextInput
                        style={[styles.input, styles.stepInput]}
                        value={step.description}
                        onChangeText={(description) => onChangeExportDraft({
                          ...exportDraft,
                          steps: exportDraft.steps.map((item, stepIndex) => ({
                            ...item,
                            order: stepIndex + 1,
                            ...(stepIndex === index ? { description } : {}),
                          })),
                        })}
                        maxLength={RECIPE_EXPORT_MAX_STEP_LENGTH}
                        multiline
                        textAlignVertical="top"
                        placeholder={`Zubereitungsschritt ${index + 1}`}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={`Exportschritt ${index + 1}`}
                      />
                      <CharacterCounter
                        length={step.description.length}
                        max={RECIPE_EXPORT_MAX_STEP_LENGTH}
                        testID={`recipe-share-step-character-count-${index}`}
                      />
                    </View>
                  ))}
                  {exportDraft.steps.length < RECIPE_EXPORT_MAX_STEPS ? (
                    <TouchableOpacity
                      style={styles.addStepButton}
                      onPress={() => onChangeExportDraft({
                        ...exportDraft,
                        steps: [...exportDraft.steps, {
                          order: exportDraft.steps.length + 1,
                          description: '',
                        }],
                      })}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Exportschritt hinzufügen"
                    >
                      <Icon lib="feather" name="plus" size="sm" color={colors.primaryBright} />
                      <Text style={styles.secondaryButtonText}>Schritt hinzufügen</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                )}
              </>
            ) : null}
          </ScrollView>

          {editingOptionsAndTexts && hasEditorErrors ? (
            <View style={styles.validationErrors}>
              {[...new Set([...previewErrors, ...saveErrors])].map((error, index) => (
                <Text key={`${error}-${index}`} style={styles.validationError}>{error}</Text>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
              {editingOptionsAndTexts ? (
                <>
                  {editorStatus ? <Text style={styles.editorStatus}>{editorStatus}</Text> : null}
                  <TouchableOpacity
                    style={[styles.primaryButton, !canRefreshPreview && styles.primaryButtonDisabled]}
                    onPress={() => void handleRefreshPreview()}
                    disabled={!canRefreshPreview}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Vorschau aktualisieren"
                    accessibilityState={{ disabled: !canRefreshPreview, busy: isSaving || isRendering }}
                  >
                    {isRendering || isSaving
                      ? <ActivityIndicator color={colors.background} size="small" />
                      : <Icon lib="feather" name="refresh-cw" size="sm" color={colors.background} />}
                    <Text style={styles.primaryButtonText}>Vorschau aktualisieren</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {exportDraft ? (
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        (isSaving || !canChangeOptions) && styles.disabledButton,
                      ]}
                      onPress={() => setEditingOptionsAndTexts(true)}
                      disabled={isSaving || !canChangeOptions}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Optionen & Texte bearbeiten"
                      accessibilityState={{ disabled: isSaving || !canChangeOptions }}
                    >
                      <Icon lib="feather" name="edit-3" size="sm" color={colors.primaryBright} />
                      <Text style={styles.secondaryButtonText}>Optionen &amp; Texte bearbeiten</Text>
                    </TouchableOpacity>
                  ) : null}

                  {renderStatus === 'error' ? (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={onRetryRender}
                      disabled={isSaving}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Vorschau erneut rendern"
                      accessibilityState={{ disabled: isSaving }}
                    >
                      <Icon lib="feather" name="refresh-cw" size="md" color={colors.primaryBright} />
                      <Text style={styles.secondaryButtonText}>Erneut versuchen</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
                    onPress={onSaveAndShare}
                    disabled={!canSave}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Bilder speichern und teilen"
                    accessibilityState={{ disabled: !canSave, busy: isSaving }}
                  >
                    {isSaving ? <ActivityIndicator color={colors.background} size="small" /> : null}
                    <Text style={styles.primaryButtonText}>
                      {isSaving ? 'Werden gespeichert und geteilt…' : 'Speichern & teilen'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewerPage: {
    flex: 1,
    backgroundColor: colors.background,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  viewerScroll: {
    flex: 1,
    minHeight: 0,
  },
  viewerSlide: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  viewerFooter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  viewerPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  expandIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.8,
  },
  preparationPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  preparationContent: {
    alignItems: 'center',
    gap: spacing.lg,
    maxWidth: 360,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '94%',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  preparationText: {
    ...typography.body1,
    color: colors.text,
    textAlign: 'center',
    maxWidth: 320,
  },
  preparationCancel: {
    minHeight: spacing.xxl,
    minWidth: spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  closeButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPair: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  previewColumnHidden: {
    display: 'none',
  },
  previewSingleColumn: {
    width: '68%',
    alignItems: 'center',
  },
  previewStage: {
    justifyContent: 'center',
  },
  stageCaption: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  previewColumn: {
    width: '48%',
    gap: spacing.sm,
  },
  assetSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  assetTab: {
    flex: 1,
    minHeight: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  assetTabSelected: {
    backgroundColor: colors.primarySoft,
  },
  assetTabText: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  assetTabTextSelected: {
    color: colors.primaryBright,
  },
  contentScroll: {
    flexShrink: 1,
    minHeight: 0,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  editorSection: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  previewHint: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: spacing.lg,
  },
  previewHintOutdated: {
    color: colors.warning,
  },
  helperText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  toggleRow: {
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  toggleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleLabel: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '600',
  },
  fieldLabel: {
    ...typography.body2,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  characterCount: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
  },
  characterCountNear: {
    color: colors.warning,
  },
  editorStatus: {
    ...typography.caption,
    color: colors.textMuted,
  },
  input: {
    ...typography.body2,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: spacing.xxl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  multilineInput: {
    minHeight: spacing.xxl * 1.5,
  },
  metadataRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metadataField: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  stepEditor: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  stepEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.xxl,
  },
  stepLabel: {
    ...typography.body2,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  removeStepButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    minHeight: spacing.xxl * 1.5,
  },
  addStepButton: {
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ingredientCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ingredientRow: {
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ingredientName: {
    ...typography.body2,
    color: colors.text,
    flex: 1,
  },
  ingredientNameDisabled: {
    color: colors.textMuted,
  },
  validationErrors: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  validationError: {
    ...typography.caption,
    color: colors.negative,
  },
  previewFrame: {
    width: '100%',
    aspectRatio: SHARE_PREVIEW_ASPECT_RATIO,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  loadingState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  loadingText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  renderingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background,
    opacity: 0.86,
  },
  renderingText: {
    ...typography.body2,
    color: colors.text,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    minHeight: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryButton: {
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  disabledButton: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.textSecondary,
    flexShrink: 1,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: spacing.xxl,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.primaryDark,
    opacity: 0.65,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.background,
    flexShrink: 1,
    textAlign: 'center',
  },
});