// App metadata for the telemetry batch. Version comes from app.json (expo-constants is not a
// direct dependency); device model from Platform.constants.Model (Android only).

import appConfig from '../../../app.json';
import type { AppInfo } from './telemetry';

interface PlatformLike {
  OS: string;
  Version: string | number;
  constants?: unknown;
}

const MODEL_PATTERN = /^[A-Za-z0-9 ._()+-]+$/;

export function buildAppInfo(platform: PlatformLike): AppInfo | null {
  try {
    if (platform.OS !== 'android' && platform.OS !== 'ios') return null;
    const variantEnv = process.env['EXPO_PUBLIC_APP_VARIANT'];
    const variant = variantEnv === 'development' || variantEnv === 'preview' ? variantEnv : 'production';
    const model = (platform.constants as { Model?: unknown } | undefined)?.Model;
    const deviceModel =
      platform.OS === 'android' && typeof model === 'string' && model.length <= 40 && MODEL_PATTERN.test(model)
        ? model
        : undefined;
    return {
      version: String(appConfig.expo.version).slice(0, 20),
      variant,
      os: platform.OS,
      osVersion: String(platform.Version).slice(0, 20),
      ...(deviceModel ? { deviceModel } : {}),
    };
  } catch {
    return null;
  }
}
