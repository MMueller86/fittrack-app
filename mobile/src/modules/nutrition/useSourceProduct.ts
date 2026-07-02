// useSourceProduct — fetches the ReusableItem linked to a diary MealItem's sourceId.
// Non-blocking: the sheet is interactive immediately; the product loads in background.

import { useEffect, useState } from 'react';
import type { ReusableItem } from '@fittrack/shared';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';

export interface UseSourceProductResult {
  product: ReusableItem | null;
  loading: boolean;
}

export function useSourceProduct(sourceId: string | undefined): UseSourceProductResult {
  const [product, setProduct] = useState<ReusableItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sourceId) {
      setProduct(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    reusableItemsApi
      .getById(sourceId)
      .then((r: { item: ReusableItem }) => {
        if (!cancelled) setProduct(r.item);
      })
      .catch(() => {
        if (!cancelled) setProduct(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sourceId]);

  return { product, loading };
}
