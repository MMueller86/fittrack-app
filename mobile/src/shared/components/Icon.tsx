// Icon — typsicherer Wrapper um @expo/vector-icons.
// Verwendet Feather, Ionicons und MaterialCommunityIcons konsistent im gesamten Hub.
// Standardgrößen: sm=16, md=20, lg=24

import React from 'react';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../app/theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type IonName = React.ComponentProps<typeof Ionicons>['name'];
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

// ---------------------------------------------------------------------------
// Feather Icons
// ---------------------------------------------------------------------------

interface FeatherIconProps {
  lib: 'feather';
  name: FeatherName;
  size?: IconSize | number;
  color?: string;
}

// ---------------------------------------------------------------------------
// Ionicons
// ---------------------------------------------------------------------------

interface IonIconProps {
  lib: 'ion';
  name: IonName;
  size?: IconSize | number;
  color?: string;
}

// ---------------------------------------------------------------------------
// MaterialCommunityIcons
// ---------------------------------------------------------------------------

interface MCIIconProps {
  lib: 'mci';
  name: MCIName;
  size?: IconSize | number;
  color?: string;
}

type IconProps = FeatherIconProps | IonIconProps | MCIIconProps;

export function Icon(props: IconProps) {
  const rawSize = props.size ?? 'md';
  const resolvedSize = typeof rawSize === 'string' ? SIZE_MAP[rawSize] : rawSize;
  const color = props.color ?? colors.text;

  if (props.lib === 'feather') {
    return <Feather name={props.name} size={resolvedSize} color={color} />;
  }
  if (props.lib === 'ion') {
    return <Ionicons name={props.name} size={resolvedSize} color={color} />;
  }
  return <MaterialCommunityIcons name={props.name} size={resolvedSize} color={color} />;
}
