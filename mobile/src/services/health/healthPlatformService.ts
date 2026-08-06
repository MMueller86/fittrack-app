// Factory: returns the real HealthConnectService on Android non-dev builds,
// MockHealthPlatformService everywhere else (iOS, dev builds, tests).

import { Platform } from 'react-native';
import type { IHealthPlatformService } from './IHealthPlatformService';
import { MockHealthPlatformService } from './MockHealthPlatformService';
import { syncLogger } from './syncLogger';

const IS_DEV = process.env.EXPO_PUBLIC_APP_VARIANT === 'development';

function createService(): IHealthPlatformService {
  if (IS_DEV || Platform.OS !== 'android') {
    syncLogger.warn('healthPlatformService', `Using MOCK — IS_DEV=${String(IS_DEV)} platform=${Platform.OS}`);
    return new MockHealthPlatformService();
  }
  try {
    // Dynamic require prevents the native module from loading on iOS.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HealthConnectService } = require('./HealthConnectService') as {
      HealthConnectService: new () => IHealthPlatformService;
    };
    syncLogger.info('healthPlatformService', 'Using HealthConnectService (real)');
    return new HealthConnectService();
  } catch (loadError) {
    // Native module present but failed to load — surface the error in every write so it appears in SyncStatusSheet.
    const errMsg = `HC module not loaded: ${loadError instanceof Error ? loadError.message : String(loadError)}`;
    syncLogger.error('healthPlatformService', 'Native module load failed', errMsg);
    return {
      getAvailability: async () => ({ status: 'error' as const, message: errMsg }),
      initialize: async () => true,
      requestPermissions: async () => true,
      hasPermissions: async () => false,
      upsertRecord: async () => { throw new Error(errMsg); },
      deleteRecord: async () => { throw new Error(errMsg); },
      readRecords: async () => [],
    };
  }
}

export const healthPlatformService: IHealthPlatformService = createService();
