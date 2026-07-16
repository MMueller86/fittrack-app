// BarcodeScannerScreen — scans a product barcode and looks it up in the catalog.
//
// Flow:
//   1. Camera preview with barcode detection overlay
//   2. On scan: query /api/food-search?query=<barcode>
//   3a. Match found → callback with FoodSearchResult
//   3b. No match   → open ProductEditor pre-filled with the barcode
//
// NOTE: react-native-vision-camera requires an EAS Build (native module).
// The screen gracefully degrades with an error message if the module is not
// available (e.g. Expo Go) so the JS bundle still loads without crashing.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FoodSearchResult, ReusableItem } from '@fittrack/shared';
import { colors, spacing, typography } from '../../app/theme';
import { foodApi } from '../../shared/api/foodApi';
import ProductEditor from '../nutrition/ProductEditor';
import { AndroidBarcodeScanner } from './AndroidBarcodeScanner';

// ---------------------------------------------------------------------------
// Camera + CodeScanner import with graceful fallback
// ---------------------------------------------------------------------------

let Camera: any = null;
let useCameraDevice: any = null;
let useObjectOutput: any = null;
let useCameraPermission: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const visionCamera = require('react-native-vision-camera');
  Camera = visionCamera.Camera;
  useCameraDevice = visionCamera.useCameraDevice;
  useObjectOutput = visionCamera.useObjectOutput;
  // v5: hook-based permission API
  useCameraPermission = visionCamera.useCameraPermission;
} catch {
  // native module not available (Expo Go, CI, etc.)
}

// ---------------------------------------------------------------------------
// CameraErrorBoundary — fängt Render-Fehler von vision-camera Hooks ab.
// In Expo Go lädt das JS-Modul erfolgreich, aber native Hooks (useCameraDevice,
// useCodeScanner) werfen beim ersten Render. Da Hooks nicht in try/catch sein
// können, kapseln wir CameraScanner in einem eigenen ErrorBoundary.
// ---------------------------------------------------------------------------

interface CameraErrorBoundaryProps {
  children: React.ReactNode;
  onError: () => void;
}

class CameraErrorBoundary extends React.Component<
  CameraErrorBoundaryProps,
  { hasError: boolean }
> {
  constructor(props: CameraErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[BarcodeScannerScreen] CameraScanner Render-Fehler (kein EAS Build?):', error.message);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called when a matching catalog item is found */
  onProductFound?: (result: FoodSearchResult) => void;
  /** Called when user saved a new personal product from the no-match flow */
  onProductCreated?: (item: ReusableItem) => void;
  /** Called when barcode scanned but no product found and user wants to scan the label */
  onNoMatch?: (barcode: string) => void;
}

type ScanState = 'scanning' | 'loading' | 'not-found' | 'error';

// Throttle: only process one barcode per 2 seconds
const SCAN_COOLDOWN_MS = 2000;

// ---------------------------------------------------------------------------
// Inner scanner (renders when vision-camera is available)
// ---------------------------------------------------------------------------

function CameraScanner({
  onCodeScanned,
  onPermissionDenied,
}: {
  onCodeScanned: (barcode: string) => void;
  onPermissionDenied: () => void;
}) {
  const lastScan = useRef(0);
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().then((granted: boolean) => {
        if (!granted) onPermissionDenied();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const device = useCameraDevice('back');

  // v5: useObjectOutput ist iOS-only (wirft auf Android)
  const objectOutput = useObjectOutput({
    types: ['ean-13', 'ean-8', 'upc-e', 'code-128', 'code-39', 'qr'],
    onObjectsScanned: (objects: Array<{ value?: string }>) => {
      const code = objects[0]?.value;
      if (!code) return;
      const now = Date.now();
      if (now - lastScan.current < SCAN_COOLDOWN_MS) return;
      lastScan.current = now;
      onCodeScanned(code);
    },
  });

  if (!hasPermission) {
    return null;
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.hint}>Kein Kameragerät gefunden.</Text>
      </View>
    );
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive
      outputs={[objectOutput]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BarcodeScannerScreen({
  visible,
  onClose,
  onProductFound,
  onProductCreated,
  onNoMatch,
}: Props) {
  const insets = useSafeAreaInsets();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'checking'>('checking');

  // Permission-Anfrage vollständig im CameraScanner-Hook (v5)
  // Kein eigener useEffect mehr nötig
  useEffect(() => {
    if (!visible) return;
    setScanState('scanning');
    setLastBarcode(null);
    setShowEditor(false);

    if (!Camera || !useCameraPermission) {
      setCameraPermission('denied');
    }
  }, [visible]);

  const handleCodeScanned = useCallback(
    async (barcode: string) => {
      if (scanState !== 'scanning') return;
      setLastBarcode(barcode);
      setScanState('loading');

      try {
        const { results } = await foodApi.search(barcode);
        // A barcode lookup matches when the result's barcode or id matches
        const match = results.find(
          (r) =>
            r.sourceRef?.barcode === barcode ||
            r.id === `openFoodFacts:${barcode}`,
        );
        if (match) {
          onProductFound?.(match);
          // Kein onClose() hier — der Hub schließt den Scanner automatisch wenn
          // SELECT_PRODUCT den hubState.mode von 'subflow' auf 'product' wechselt.
        } else {
          setScanState('not-found');
        }
      } catch {
        setScanState('error');
      }
    },
    [scanState, onProductFound],
  );

  function handleRetry() {
    setScanState('scanning');
    setLastBarcode(null);
  }

  function handleOpenEditor() {
    setShowEditor(true);
  }

  // CameraScanner (useObjectOutput) wird nur auf iOS gerendert—auf Android nicht verfügbar
  const nativeAvailable = !!Camera && Platform.OS === 'ios';

  return (
    <>
      <Modal
        visible={visible && !showEditor}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Camera — in CameraErrorBoundary gekapselt, da vision-camera Hooks
               in Expo Go laden aber beim Render werfen. Der ErrorBoundary
               fängt den Fehler ab und setzt cameraPermission='denied' statt
               den gesamten App-Tree zu crashen. */}
          {/* iOS: react-native-vision-camera (useObjectOutput) */}
          {Platform.OS === 'ios' && nativeAvailable && cameraPermission !== 'denied' && scanState === 'scanning' && (
            <CameraErrorBoundary onError={() => setCameraPermission('denied')}>
              <CameraScanner
                onCodeScanned={handleCodeScanned}
                onPermissionDenied={() => setCameraPermission('denied')}
              />
            </CameraErrorBoundary>
          )}

          {/* Android: expo-camera mit nativem Barcode-Support */}
          {Platform.OS === 'android' && scanState === 'scanning' && (
            <AndroidBarcodeScanner
              onCodeScanned={handleCodeScanned}
              onPermissionDenied={() => setCameraPermission('denied')}
            />
          )}

          {/* Overlay content */}
          <View style={styles.overlay}>
            {/* Header */}
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Barcode scannen</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Centre content */}
            <View style={styles.centerArea}>
              {/* iOS: kein EAS-Build */}
              {!nativeAvailable && Platform.OS !== 'android' && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageTitle}>Kamera nicht verfügbar</Text>
                  <Text style={styles.messageBody}>
                    Der Barcode-Scanner ist nur in EAS-Builds verfügbar, nicht in Expo Go.
                  </Text>
                </View>
              )}

              {/* Kein Kamerazugriff (iOS + Android) */}
              {cameraPermission === 'denied' && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageTitle}>Kein Kamerazugriff</Text>
                  <Text style={styles.messageBody}>
                    Bitte erlaube den Kamerazugriff in den Einstellungen.
                  </Text>
                </View>
              )}

              {scanState === 'scanning' && cameraPermission !== 'denied' && (
                <View style={styles.scanFrame} />
              )}

              {scanState === 'loading' && (
                <View style={styles.messageBox}>
                  <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.sm }} />
                  <Text style={styles.messageBody}>Suche Produkt…</Text>
                </View>
              )}

              {scanState === 'not-found' && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageTitle}>Produkt nicht gefunden</Text>
                  <Text style={styles.messageBody}>
                    Barcode: {lastBarcode}
                    {'\n'}Kein Eintrag in der Datenbank.
                  </Text>
                  {onNoMatch && (
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() => onNoMatch(lastBarcode ?? '')}
                    >
                      <Text style={styles.primaryButtonText}>📷 Nährwert-Label scannen</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={onNoMatch ? styles.secondaryButton : styles.primaryButton} onPress={handleOpenEditor}>
                    <Text style={onNoMatch ? styles.secondaryButtonText : styles.primaryButtonText}>Manuell anlegen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                    <Text style={styles.secondaryButtonText}>Erneut scannen</Text>
                  </TouchableOpacity>
                </View>
              )}

              {scanState === 'error' && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageTitle}>Fehler</Text>
                  <Text style={styles.messageBody}>Produkt konnte nicht gesucht werden.</Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                    <Text style={styles.secondaryButtonText}>Erneut versuchen</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Bottom hint */}
            {scanState === 'scanning' && nativeAvailable && cameraPermission === 'granted' && (
              <View style={[styles.bottomHint, { paddingBottom: insets.bottom + spacing.md }]}>
                <Text style={styles.hint}>Barcode im Rahmen positionieren</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ProductEditor shown on no-match */}
      <ProductEditor
        visible={showEditor}
        initialData={{ barcode: lastBarcode ?? undefined }}
        onClose={() => {
          setShowEditor(false);
          onClose();
        }}
        onCreated={(item) => {
          setShowEditor(false);
          onProductCreated?.(item);
          onClose();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeButton: {
    width: 40,
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
  },
  headerTitle: {
    ...typography.h3,
    color: '#fff',
    fontSize: 17,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scanFrame: {
    width: 240,
    height: 150,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  messageBox: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    maxWidth: 300,
  },
  messageTitle: {
    ...typography.h3,
    color: '#fff',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  messageBody: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.body1,
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.body2,
    color: colors.textMuted,
  },
  bottomHint: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.md,
  },
  hint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
