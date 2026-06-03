import React from 'react';
import { Image, type ImageSourcePropType, type StyleProp, type ImageStyle } from 'react-native';

export type BrandAssetName =
  | 'app_icon'
  | 'splash_logo'
  | 'header_symbol'
  | 'wordmark';

const SOURCES: Record<BrandAssetName, ImageSourcePropType> = {
  app_icon: require('../../../assets/brand/fittrack_app_icon_master_v1.png'),
  splash_logo: require('../../../assets/brand/fittrack_splash_logo_master_v1.png'),
  header_symbol: require('../../../assets/brand/fittrack_header_symbol_v1.png'),
  wordmark: require('../../../assets/brand/fittrack_wordmark_v1.png'),
};

interface Props {
  name: BrandAssetName;
  /** Width of the rendered asset. Height is derived from aspect ratio. */
  width: number;
  /** Explicit height override. If omitted, use width (square bounding box). */
  height?: number;
  style?: StyleProp<ImageStyle>;
}

export function BrandAsset({ name, width, height, style }: Props) {
  return (
    <Image
      source={SOURCES[name]}
      style={[{ width, height: height ?? width }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={`FitTrack ${name}`}
    />
  );
}
