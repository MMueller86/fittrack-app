# Health Connect — Implementierungsplan [Planned]

Stories: HC-1, HC-2a, HC-2b | Genehmigt: 2026-08-03

## Bibliothek

react-native-health-connect (Android, Expo Config Plugin)

## Service-Abstraktion

IHealthPlatformService (`mobile/src/services/health/`) — generisch für iOS-Erweiterung via HealthKit.  
Factory: `process.env.EXPO_PUBLIC_APP_VARIANT === 'development'` → Mock, sonst Real.  
Platform-Guard: Auf iOS und in Dev-Builds wird stets `MockHealthPlatformService` verwendet.

## Verzeichnisstruktur

```
mobile/src/
├── modules/
│   └── healthConnect/
│       └── HealthConnectScreen.tsx
├── services/
│   └── health/
│       ├── IHealthPlatformService.ts
│       ├── MockHealthPlatformService.ts
│       ├── HealthConnectService.ts        (Android-Implementierung)
│       ├── healthPlatformService.ts       (Factory)
│       └── healthSyncService.ts           (Sync State Machine)
```

## WeightRecord-Mapping

```ts
{
  recordType: 'Weight',
  metadata: {
    clientRecordId: entry.id,           // FitTrack UUID — kein separates Sync-ID
    clientRecordVersion: Date.now(),    // Timestamp-ms, monoton steigend
  },
  time: entry.createdAt,
  zoneOffset: '+HH:MM',                // aus new Date().getTimezoneOffset()
  weight: { inKilograms: entry.unit === 'lbs' ? value * 0.453592 : value },
}
```

## Sync-Zustand (AsyncStorage `hc:weight:sync`)

```ts
interface WeightSyncState {
  enabled: boolean;
  permissionRevoked: boolean;
  lastFullExportAt?: string;
  pendingOperations: PendingOp[];
}
```

Permanente Fehler: `retryCount >= 10 && sessionCount >= 2`

## Arbeitspakete

- WP-HC-Backend: ABGESCHLOSSEN (`healthSyncEnabled` in `UserProfile` + `PUT /api/profile`)
- WP-HC1-1: Library + Service-Abstraktion [UMGESETZT]
- WP-HC1-2: Navigation + HealthConnectScreen [UMGESETZT]
- WP-HC2a-1: IHealthPlatformService Permissions + Write/Delete [UMGESETZT]
- WP-HC2a-2: healthSyncService.ts Kern [UMGESETZT]
- WP-HC2a-3: HealthConnectScreen Aktivierungsflow [UMGESETZT]
- WP-HC2b-1: Ongoing Sync in ProgressScreen [UMGESETZT]
- WP-HC2b-2: Retry-Queue + Fehlerbehandlung [UMGESETZT]
- WP-HC2b-3: HealthConnectScreen Laufzeit-Status [UMGESETZT]

## Risiken

R1: Plugin-Kompatibilität Expo SDK 54 — ohne nativen Build nicht verifizierbar.  
R4: Play Store Health Connect Data Policy vor öffentlichem Release klären.
