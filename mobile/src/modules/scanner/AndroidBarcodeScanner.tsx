// AndroidBarcodeScanner — expo-camera basierter Barcode-Scanner für Android.
// Wird ausschließlich auf Android gerendert; iOS nutzt react-native-vision-camera.
//
// expo-camera v17 (SDK 54): CameraView mit onBarcodeScanned + useCameraPermissions

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, typography } from '../../app/theme';

// ---------------------------------------------------------------------------
// Throttle: nur ein Barcode pro 2 Sekunden verarbeiten
// ---------------------------------------------------------------------------
const SCAN_COOLDOWN_MS = 2000;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  onCodeScanned: (barcode: string) => void;
  onPermissionDenied: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AndroidBarcodeScanner({ onCodeScanned, onPermissionDenied }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScan = useRef(0);
  const [requested, setRequested] = useState(false);

  // Permission anfragen wenn noch nicht bestimmt
  useEffect(() => {
    if (!permission || requested) return;
    if (permission.granted) return;
    if (!permission.canAskAgain) {
      onPermissionDenied();
      return;
    }
    setRequested(true);
    requestPermission().then((result) => {
      if (!result.granted) onPermissionDenied();
    });
  }, [permission, requested, requestPermission, onPermissionDenied]);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!data) return;
      const now = Date.now();
      if (now - lastScan.current < SCAN_COOLDOWN_MS) return;
      lastScan.current = now;
      onCodeScanned(data);
    },
    [onCodeScanned],
  );

  if (!permission) {
    // Noch nicht geladen
    return null;
  }

  if (!permission.granted) {
    // Warten auf Dialog / onPermissionDenied wurde bereits aufgerufen
    return null;
  }

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      onBarcodeScanned={handleBarcodeScanned}
      barcodeScannerSettings={{
        barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
      }}
    />
  );
}
