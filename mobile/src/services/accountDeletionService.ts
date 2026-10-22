import AsyncStorage from '@react-native-async-storage/async-storage';
import { SKIP_WIZARD_KEY } from '../modules/profile/ProfileWizardScreen';
import { useAuthStore } from '../modules/auth/useAuthStore';
import { healthSyncService } from './health/healthSyncService';
import { nutritionSyncService } from './health/nutritionSyncService';
import { syncLogger } from './health/syncLogger';

export async function completeAccountDeletionLocally(): Promise<boolean> {
  const results = await Promise.allSettled([
    Promise.resolve().then(() => AsyncStorage.removeItem(SKIP_WIZARD_KEY)),
    Promise.resolve().then(() => healthSyncService.resetForAccountDeletion()),
    Promise.resolve().then(() => nutritionSyncService.resetForAccountDeletion()),
    Promise.resolve().then(() => syncLogger.clear()),
  ]);
  let cleanupFailed = results.some((result) => result.status === 'rejected');
  try {
    await useAuthStore.getState().logout();
  } catch {
    cleanupFailed = true;
  }

  if (cleanupFailed) {
    useAuthStore.getState().showAccountDeletionCleanupNotice();
  }

  return cleanupFailed;
}