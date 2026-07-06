// BarcodeSubFlow — Wrapper um BarcodeScannerScreen für den FoodEntryHub.
// Bei Match → schließt sich und öffnet den ProduktDialog im Hub (via onProductFound).
// Bei Kein-Treffer → Alert "Label scannen?" → LabelSubFlow öffnet sich.
// Bei neuem Produkt (kein Match + manuell) → ProductEditor intern im BarcodeScannerScreen.

import React, { useState } from 'react';
import { Alert } from 'react-native';
import type { FoodSearchResult, ReusableItem } from '@fittrack/shared';
import BarcodeScannerScreen from '../../scanner/BarcodeScannerScreen';
import { LabelSubFlow } from './LabelSubFlow';
import type { FoodEntryHubContext } from './useFoodEntryHubStore';

interface Props {
  visible: boolean;
  context: FoodEntryHubContext;
  onClose: () => void;
  /** Gefundenes Produkt → ProduktDialog im Hub öffnen */
  onProductFound: (result: FoodSearchResult) => void;
  /** Neu angelegtes Produkt über ProductEditor → Snackbar */
  onProductCreated: (item: ReusableItem) => void;
  /** Label-Scan gespeichert → ProduktDialog */
  onLabelProductFound?: (product: FoodSearchResult) => void;
}

export function BarcodeSubFlow({
  visible,
  context,
  onClose,
  onProductFound,
  onProductCreated,
  onLabelProductFound,
}: Props) {
  const [showLabelSubFlow, setShowLabelSubFlow] = useState(false);

  function handleNoMatch(barcode: string) {
    Alert.alert(
      'Produkt nicht gefunden',
      `Barcode ${barcode} ist nicht in der Datenbank.\nMöchtest du das Nährwert-Label auf der Verpackung scannen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: '📷 Label scannen',
          onPress: () => setShowLabelSubFlow(true),
        },
      ],
    );
  }

  function handleLabelSaved(productName: string) {
    setShowLabelSubFlow(false);
    // LabelSubFlow.onSaved is called for "Einmalig" path → just close
    onClose();
  }

  return (
    <>
      <BarcodeScannerScreen
        visible={visible && !showLabelSubFlow}
        onClose={onClose}
        onProductFound={onProductFound}
        onProductCreated={onProductCreated}
        onNoMatch={handleNoMatch}
      />
      <LabelSubFlow
        visible={showLabelSubFlow}
        context={context}
        onClose={() => {
          setShowLabelSubFlow(false);
          // Return to barcode scanner after cancel
        }}
        onSaved={handleLabelSaved}
        onProductFound={(product) => {
          setShowLabelSubFlow(false);
          onLabelProductFound?.(product);
          onClose();
        }}
      />
    </>
  );
}

