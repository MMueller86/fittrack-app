// RootNavigator — bottom tab shell with Home stack.
// Auth/Onboarding stacks will wrap this in M2.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../../modules/home/HomeScreen';
import WeightDetailScreen from '../../modules/weight/WeightDetailScreen';
import DiaryScreen from '../../modules/nutrition/DiaryScreen';
import RecipeListScreen from '../../modules/recipes/RecipeListScreen';
import ProfileScreen from '../../modules/profile/ProfileScreen';
import { colors } from '../theme';

// --- Home stack (Home + Weight detail) ---
export type HomeStackParamList = {
  HomeMain: undefined;
  WeightDetail: undefined;
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'Home' }} />
      <HomeStack.Screen name="WeightDetail" component={WeightDetailScreen} options={{ title: 'Weight' }} />
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
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
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
