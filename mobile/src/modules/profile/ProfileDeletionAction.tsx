import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { profileApi, type ProfileDeletionRequest } from '../../shared/api/profileApi';
import { recipeApi } from '../../shared/api/recipeApi';
import { completeAccountDeletionLocally } from '../../services/accountDeletionService';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { ProfileActionButton } from './ProfileActionButton';

type CommunityRecipeCheck = 'loading' | 'failed' | 'available' | 'none';

function getDeletionErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: unknown }>(error)) {
    switch (error.response?.data?.error) {
      case 'profile_deletion_in_progress':
        return 'Die Löschung konnte nicht durchgeführt werden. Bitte versuche es erneut.';
      case 'profile_deletion_unavailable':
        return 'Der Löschdienst ist vorübergehend nicht verfügbar. Bitte versuche es erneut.';
      case 'profile_deletion_failed':
        return 'Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.';
      case 'invalid_profile_deletion_request':
        return 'Die Löschanfrage ist ungültig. Bitte prüfe die Bestätigung und versuche es erneut.';
      case 'authentication_required':
        return 'Deine Anmeldung konnte nicht bestätigt werden. Bitte versuche es erneut.';
      default:
        return 'Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.';
    }
  }
  return 'Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.';
}

export function ProfileDeletionAction() {
  const insets = useSafeAreaInsets();
  const [deleteOverlayVisible, setDeleteOverlayVisible] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteCommunityRecipes, setDeleteCommunityRecipes] = useState(false);
  const [communityRecipeCheck, setCommunityRecipeCheck] = useState<CommunityRecipeCheck>('loading');
  const [pendingDeletionRequest, setPendingDeletionRequest] = useState<ProfileDeletionRequest | null>(null);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deletionInProgress, setDeletionInProgress] = useState(false);
  const deletionInProgressRef = useRef(false);
  const recipeCheckSequence = useRef(0);

  async function checkCommunityRecipes() {
    const sequence = ++recipeCheckSequence.current;
    setCommunityRecipeCheck('loading');
    try {
      const { recipes } = await recipeApi.list();
      if (sequence !== recipeCheckSequence.current) return;
      setCommunityRecipeCheck(
        recipes.some((recipe) => recipe.visibility === 'community' && recipe.communityPublication != null)
          ? 'available'
          : 'none',
      );
    } catch {
      if (sequence === recipeCheckSequence.current) setCommunityRecipeCheck('failed');
    }
  }

  function openDeletionOverlay() {
    setDeleteConfirmation('');
    setDeleteCommunityRecipes(false);
    setPendingDeletionRequest(null);
    setDeletionError(null);
    setDeleteOverlayVisible(true);
    void checkCommunityRecipes();
  }

  function closeDeletionOverlay() {
    if (deletionInProgressRef.current) return;
    recipeCheckSequence.current++;
    setDeleteOverlayVisible(false);
    setDeleteConfirmation('');
    setDeleteCommunityRecipes(false);
    setPendingDeletionRequest(null);
    setDeletionError(null);
  }

  async function submitDeletion(request: ProfileDeletionRequest) {
    if (deletionInProgressRef.current) return;
    deletionInProgressRef.current = true;
    setDeletionInProgress(true);
    setDeletionError(null);
    try {
      try {
        await profileApi.deleteProfile(request);
      } catch (error) {
        setDeletionError(getDeletionErrorMessage(error));
        return;
      }
      setDeleteOverlayVisible(false);
      try {
        await completeAccountDeletionLocally();
      } catch {
        // Local cleanup cannot change the confirmed server result.
      }
    } finally {
      deletionInProgressRef.current = false;
      setDeletionInProgress(false);
    }
  }

  function startDeletion() {
    if (
      deleteConfirmation !== 'DELETE' ||
      (communityRecipeCheck !== 'available' && communityRecipeCheck !== 'none') ||
      deletionInProgressRef.current
    ) return;
    const request: ProfileDeletionRequest = {
      confirmation: 'DELETE',
      deleteCommunityRecipes,
    };
    setPendingDeletionRequest(request);
    void submitDeletion(request);
  }

  return (
    <>
      <ProfileActionButton
        label="Konto löschen"
        iconName="trash-2"
        tone="danger"
        onPress={openDeletionOverlay}
        accessibilityHint="Öffnet die Bestätigung zur dauerhaften Kontolöschung."
      />
      {deleteOverlayVisible ? (
        <Modal visible transparent animationType="fade" onRequestClose={closeDeletionOverlay}>
          <View style={styles.deleteOverlayRoot}>
            <Pressable
              style={[StyleSheet.absoluteFill, styles.deleteBackdrop]}
              onPress={closeDeletionOverlay}
              disabled={deletionInProgress}
              accessibilityRole="button"
              accessibilityLabel="Bestätigung schließen"
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={[
                styles.deleteKeyboard,
                {
                  paddingTop: insets.top + spacing.md,
                  paddingBottom: Math.max(insets.bottom, spacing.md),
                },
              ]}
            >
              <View style={styles.deleteDialog}>
                <ScrollView
                  style={styles.deleteDialogBody}
                  contentContainerStyle={styles.deleteDialogContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.deleteTitle} accessibilityRole="header">
                    Profil endgültig löschen?
                  </Text>
                  <Text style={styles.deleteBody}>
                    Dein FitTrack-Profil und deine persönlichen FitTrack-Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                  </Text>
                  <Text style={styles.deleteHealthNotice}>
                    Bereits in Health Connect gespeicherte Daten bleiben davon unberührt.
                  </Text>

                  {communityRecipeCheck === 'loading' ? (
                    <View style={styles.deleteCheckStatus}>
                      <ActivityIndicator color={colors.primary} size="small" />
                      <Text style={styles.deleteStatusText}>Community-Rezepte werden geprüft …</Text>
                    </View>
                  ) : null}
                  {communityRecipeCheck === 'failed' ? (
                    <View style={styles.deleteCheckError}>
                      <Text style={styles.deleteErrorText}>
                        Deine Community-Rezepte konnten nicht geprüft werden. Bitte versuche es erneut.
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteRetryCheck}
                        onPress={() => void checkCommunityRecipes()}
                        disabled={deletionInProgress}
                        accessibilityRole="button"
                        accessibilityLabel="Erneut prüfen"
                      >
                        <Text style={styles.deleteRetryCheckText}>Erneut prüfen</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {communityRecipeCheck === 'available' ? (
                    <>
                      <View style={styles.deleteSwitchRow}>
                        <Text style={styles.deleteSwitchLabel}>Auch meine Community Rezepte löschen</Text>
                        <View style={styles.deleteSwitchControl}>
                          <Text style={styles.deleteSwitchValue}>{deleteCommunityRecipes ? 'Ja' : 'Nein'}</Text>
                          <Switch
                            value={deleteCommunityRecipes}
                            onValueChange={setDeleteCommunityRecipes}
                            disabled={deletionInProgress || pendingDeletionRequest !== null}
                            accessibilityLabel="Auch meine Community Rezepte löschen"
                            accessibilityState={{
                              checked: deleteCommunityRecipes,
                              disabled: deletionInProgress || pendingDeletionRequest !== null,
                            }}
                          />
                        </View>
                      </View>
                      <Text style={styles.deleteSecondaryNotice}>
                        Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten, sofern du sie nicht ebenfalls löschst.
                      </Text>
                    </>
                  ) : null}
                </ScrollView>

                <View style={styles.deleteFooter} testID="profile-deletion-footer">
                  <Text style={styles.deleteConfirmationPrompt}>Gib zur Bestätigung DELETE ein.</Text>
                  <TextInput
                    style={styles.deleteInput}
                    value={deleteConfirmation}
                    onChangeText={setDeleteConfirmation}
                    placeholder="DELETE"
                    placeholderTextColor={colors.textMuted}
                    underlineColorAndroid="transparent"
                    selectionColor={colors.primaryBright}
                    textAlignVertical="center"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={20}
                    editable={!deletionInProgress && pendingDeletionRequest === null}
                    accessibilityLabel="Löschbestätigung"
                    accessibilityHint="Gib DELETE in Großbuchstaben ein."
                  />

                  {deletionInProgress ? (
                    <View style={styles.deleteCheckStatus} accessibilityLiveRegion="polite">
                      <ActivityIndicator color={colors.primary} size="small" />
                      <Text style={styles.deleteStatusText}>Dein Profil wird gelöscht …</Text>
                    </View>
                  ) : null}
                  {deletionError ? (
                    <Text style={styles.deleteErrorText} accessibilityLiveRegion="polite">
                      {deletionError}
                    </Text>
                  ) : null}

                  <View style={styles.deleteActions}>
                    <TouchableOpacity
                      style={styles.deleteCancelButton}
                      onPress={closeDeletionOverlay}
                      disabled={deletionInProgress}
                      accessibilityRole="button"
                      accessibilityLabel="Abbrechen"
                      accessibilityState={{ disabled: deletionInProgress }}
                    >
                      <Text style={styles.deleteCancelText}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteConfirmButton, (
                        deletionInProgress || (deletionError === null && (
                          deleteConfirmation !== 'DELETE' ||
                          (communityRecipeCheck !== 'available' && communityRecipeCheck !== 'none')
                        ))
                      ) && styles.deleteConfirmButtonDisabled]}
                      onPress={deletionError && pendingDeletionRequest
                        ? () => void submitDeletion(pendingDeletionRequest)
                        : startDeletion}
                      disabled={deletionInProgress || (deletionError === null && (
                        deleteConfirmation !== 'DELETE' ||
                        (communityRecipeCheck !== 'available' && communityRecipeCheck !== 'none')
                      ))}
                      accessibilityRole="button"
                      accessibilityLabel={deletionError && pendingDeletionRequest ? 'Erneut versuchen' : 'Endgültig löschen'}
                      accessibilityState={{
                        disabled: deletionInProgress || (deletionError === null && (
                          deleteConfirmation !== 'DELETE' ||
                          (communityRecipeCheck !== 'available' && communityRecipeCheck !== 'none')
                        )),
                      }}
                    >
                      <Text style={styles.deleteConfirmText}>
                        {deletionError && pendingDeletionRequest ? 'Erneut versuchen' : 'Endgültig löschen'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  deleteOverlayRoot: { flex: 1 },
  deleteBackdrop: { backgroundColor: colors.overlay },
  deleteKeyboard: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  deleteDialog: {
    maxHeight: '100%',
    flexShrink: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  deleteDialogBody: { flexShrink: 1 },
  deleteDialogContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  deleteFooter: {
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  deleteTitle: { ...typography.h3, color: colors.text },
  deleteBody: { ...typography.body2, color: colors.text },
  deleteHealthNotice: { ...typography.body2, color: colors.textSecondary },
  deleteSecondaryNotice: { ...typography.body2, color: colors.textSecondary },
  deleteConfirmationPrompt: { ...typography.body2, color: colors.text },
  deleteCheckStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deleteStatusText: { ...typography.body2, color: colors.textSecondary, flexShrink: 1 },
  deleteCheckError: { gap: spacing.xs },
  deleteErrorText: { ...typography.body2, color: colors.negative },
  deleteRetryCheck: { minHeight: spacing.xxl, justifyContent: 'center', alignSelf: 'flex-start' },
  deleteRetryCheckText: { ...typography.button, color: colors.primaryBright },
  deleteSwitchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deleteSwitchLabel: { ...typography.body2, color: colors.text, flex: 1, flexShrink: 1 },
  deleteSwitchControl: { alignItems: 'center', minWidth: spacing.xxl * 2 },
  deleteSwitchValue: { ...typography.caption, color: colors.textSecondary },
  deleteInput: {
    ...typography.body1,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    height: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 0,
    paddingHorizontal: spacing.md,
  },
  deleteActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  deleteCancelButton: {
    flex: 1,
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteCancelText: { ...typography.button, color: colors.textSecondary },
  deleteConfirmButton: {
    flex: 1,
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.negative,
    paddingHorizontal: spacing.sm,
  },
  deleteConfirmButtonDisabled: { opacity: 0.4 },
  deleteConfirmText: { ...typography.button, color: colors.background, textAlign: 'center' },
});