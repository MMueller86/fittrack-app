// RootNavigator — bottom tab shell with Home stack.
// On first launch (no profile): shows ProfileWizardScreen as a modal.

import React, { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen from '../../modules/home/HomeScreen';
import WeightDetailScreen from '../../modules/weight/WeightDetailScreen';
import DiaryScreen from '../../modules/nutrition/DiaryScreen';
import RecipeListScreen from '../../modules/recipes/RecipeListScreen';
import RecipeDetailScreen from '../../modules/recipes/RecipeDetailScreen';
import RecipeCreateScreen from '../../modules/recipes/RecipeCreateScreen';
import RecipeWizardScreen from '../../modules/recipes/RecipeWizardScreen';
import ProfileScreen from '../../modules/profile/ProfileScreen';
import ProfileEditScreen from '../../modules/profile/ProfileEditScreen';
import MyProductsScreen from '../../modules/profile/MyProductsScreen';
import ProfileWizardScreen, { SKIP_WIZARD_KEY } from '../../modules/profile/ProfileWizardScreen';
import type { UserProfile } from '@fittrack/shared';
import { colors } from '../theme';
import { HomeIcon, NutritionIcon, RecipesIcon, ProfileIcon, WeightIcon } from '../../assets/icons/TabIcons';
import { profileApi } from '../../shared/api/profileApi';

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

// --- Home stack ---
export type HomeStackParamList = {
  HomeMain: undefined;
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
    </HomeStack.Navigator>
  );
}

// --- Profile stack ---
export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileEdit: { profile: UserProfile | null };
  MyProducts: undefined;
};

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <ProfileStack.Screen name="MyProducts" component={MyProductsScreen} />
    </ProfileStack.Navigator>
  );
}

// --- Recipe stack ---
export type RecipeStackParamList = {
  RecipeList: undefined;
  RecipeDetail: { id: string };
  RecipeCreate: { editId?: string };
  RecipeWizard: undefined;
};

const RecipeStack = createNativeStackNavigator<RecipeStackParamList>();

function RecipeStackNavigator() {
  return (
    <RecipeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <RecipeStack.Screen name="RecipeList" component={RecipeListScreen} />
      <RecipeStack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <RecipeStack.Screen name="RecipeCreate" component={RecipeCreateScreen} />
      <RecipeStack.Screen name="RecipeWizard" component={RecipeWizardScreen} />
    </RecipeStack.Navigator>
  );
}

// --- Bottom tabs ---
export type RootTabParamList = {
  Home: undefined;
  Nutrition: undefined;
  Recipes: undefined;
  Weight: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const skipped = await AsyncStorage.getItem(SKIP_WIZARD_KEY);
        if (skipped === '1') return; // user permanently opted out
        const { profile } = await profileApi.getMe();
        if (!profile) setShowWizard(true);
      } catch {
        // Network error — don't block the user, they can set up later
      }
    })();
  }, []);

  if (showWizard) {
    return (
      <NavigationContainer theme={navigationTheme}>
        <ProfileWizardScreen
          onComplete={() => setShowWizard(false)}
          onDismiss={() => setShowWizard(false)}
          isNewProfile={true}
        />
      </NavigationContainer>
    );
  }

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
        <Tab.Screen
          name="Home"
          component={HomeStackNavigator}
          options={{ tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Nutrition"
          component={DiaryScreen}
          options={{ tabBarIcon: ({ color, size }) => <NutritionIcon color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Recipes"
          component={RecipeStackNavigator}
          options={{ tabBarIcon: ({ color, size }) => <RecipesIcon color={color} size={size} /> }}
        />
        <Tab.Screen
          name="Weight"
          component={WeightDetailScreen}
          options={{
            tabBarLabel: 'Gewicht',
            tabBarIcon: ({ color, size }) => <WeightIcon color={color} size={size} />,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStackNavigator}
          options={{ tabBarIcon: ({ color, size }) => <ProfileIcon color={color} size={size} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
