// RootNavigator — bottom tab shell with Home stack.
// Auth/Onboarding stacks will wrap this in M2.

import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../../modules/home/HomeScreen';
import WeightDetailScreen from '../../modules/weight/WeightDetailScreen';
import DiaryScreen from '../../modules/nutrition/DiaryScreen';
import RecipeListScreen from '../../modules/recipes/RecipeListScreen';
import ProfileScreen from '../../modules/profile/ProfileScreen';
import { colors } from '../theme';

// React Navigation needs a theme that matches our dark palette so that
// transient surfaces (e.g. screen background flashes between renders)
// don't show light grey.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.primaryBright,
  },
};

// --- Home stack (Home + Weight detail) ---
export type HomeStackParamList = {
  HomeMain: undefined;
  WeightDetail: undefined;
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="WeightDetail" component={WeightDetailScreen} />
    </HomeStack.Navigator>
  );
}

// --- Bottom tabs ---
export type RootTabParamList = {
  Home: undefined;
  Nutrition: undefined;
  Recipes: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primaryBright,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          headerShown: false,
        }}
      >
        <Tab.Screen name="Home" component={HomeStackNavigator} />
        <Tab.Screen name="Nutrition" component={DiaryScreen} />
        <Tab.Screen name="Recipes" component={RecipeListScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
