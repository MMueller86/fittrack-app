// Tab bar icons — custom SVG paths plus Ionicons, all following the color and size from React Navigation.
// Each component accepts a `color` prop passed by React Navigation and an optional `size`.

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 10.75L12 4L20 10.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6.5 9.5V20H10V14.75H14V20H17.5V9.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function NutritionIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13.3 6.2C15.8 3.7 19.2 5 20 5.5C20.2 8 18.9 10.4 16.7 11.3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 7.5C10.5 5.7 7.3 5.9 5.6 7.6C3.3 9.9 3.9 14.5 7.2 18.1C9.2 20.3 10.9 20.2 12 19.2C13.1 20.2 14.8 20.3 16.8 18.1C20.1 14.5 20.7 9.9 18.4 7.6C16.7 5.9 13.5 5.7 12 7.5Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 7.5C12.1 6.1 12.6 4.9 13.5 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function WeightIcon({ color, size = 24 }: IconProps) {
  // Classic balance scale (Waage)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Vertical stand */}
      <Path d="M12 6V18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Base */}
      <Path d="M8 18H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Horizontal beam */}
      <Path d="M4 9H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Pivot dot */}
      <Circle cx="12" cy="6" r="1.5" fill={color} />
      {/* Left chain + pan */}
      <Path d="M4 9V14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M2 14H6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Right chain + pan (slightly longer = natural tilt) */}
      <Path d="M20 9V15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M18 15.5H22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="2" />
      <Path d="M5.5 19C6.4 15.9 8.7 14 12 14C15.3 14 17.6 15.9 18.5 19" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function RecipesIcon({ color, size = 24 }: IconProps) {
  return <Ionicons name="book-outline" size={size} color={color} />;
}

// Trending-up arrow: represents progress, development, and improvement across
// all future metrics (weight, body measurements, AI insights, goal achievement).
export function ProgressIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 17L9 11L13 14L21 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 6H21V11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
