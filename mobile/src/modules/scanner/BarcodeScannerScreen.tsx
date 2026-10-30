// BarcodeScannerScreen — scans a product barcode and looks it up in the catalog.
//
// Flow:
//   1. Camera preview with barcode detection overlay (expo-camera, siehe AndroidBarcodeScanner)
//   2. On scan: query /api/food-search?query=<barcode>
//   3a. Match found → callback with FoodSearchResult
//   3b. No match   → open ProductEditor pre-filled with the barcode

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
// Types
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  onClose: () => void;
  safeAreaTopInset?: number;
  /** Called when a matching catalog item is found */
  onProductFound?: (result: FoodSearchResult) => void;
  /** Called when user saved a new personal product from the no-match flow */
  onProductCreated?: (item: ReusableItem) => void;
  /** Called when barcode scanned but no product found and user wants to scan the label */
  onNoMatch?: (barcode: string) => void;
}

type ScanState = 'scanning' | 'loading' | 'not-found' | 'error';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BarcodeScannerScreen({
  visible,
  onClose,
  safeAreaTopInset,
  onProductFound,
  onProductCreated,
  onNoMatch,
}: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, safeAreaTopInset ?? 0);
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'denied' | 'checking'>('checking');

  useEffect(() => {
    if (!visible) return;
    setScanState('scanning');
    setLastBarcode(null);
    setShowEditor(false);
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

  return (
    <>
      <Modal
        visible={visible && !showEditor}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          {scanState === 'scanning' && (
            <AndroidBarcodeScanner
              onCodeScanned={handleCodeScanned}
              onPermissionDenied={() => setCameraPermission('denied')}
            />
          )}

          {/* Overlay content */}
          <View style={styles.overlay}>
            {/* Header */}
            <View style={[styles.topBar, { paddingTop: topInset + spacing.sm }]}>
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
              {/* Kein Kamerazugriff */}
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
            {scanState === 'scanning' && cameraPermission !== 'denied' && (
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
    ...StyleSheet.absoluteFill,
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
