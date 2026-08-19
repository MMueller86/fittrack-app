import { describe, expect, it } from 'vitest';
import { spacing } from '../../app/theme';
import {
  INFO_OVERLAY_CONTENT_MAX_HEIGHT,
  INFO_OVERLAY_FOOTER_MARGIN_TOP,
  INFO_OVERLAY_MIN_TOUCH_HEIGHT,
  INFO_OVERLAY_PANEL_BOTTOM_PADDING,
} from './infoOverlayLayout';

describe('InfoOverlay layout contract', () => {
  it('keeps the content scroll owner bounded and places the CTA below it', () => {
    expect(INFO_OVERLAY_CONTENT_MAX_HEIGHT).toBe('70%');
    expect(INFO_OVERLAY_FOOTER_MARGIN_TOP).toBe(spacing.md);
    expect(INFO_OVERLAY_PANEL_BOTTOM_PADDING).toBe(spacing.xs);
  });

  it('uses the shared 48 dp touch target for overlay actions', () => {
    expect(INFO_OVERLAY_MIN_TOUCH_HEIGHT).toBe(spacing.xxl);
    expect(INFO_OVERLAY_MIN_TOUCH_HEIGHT).toBe(48);
  });
});