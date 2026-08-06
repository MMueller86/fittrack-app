// ProfileScreen — Zwei-Tab-Layout: "Mein Profil" und "Meine Lebensmittel".

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { UserProfile, ProfileTargets, Gender, ActivityLevel, GoalType, ReusableItem } from '@fittrack/shared';
import { profileApi } from '../../shared/api/profileApi';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';
import { colors, radius, spacing, typography } from '../../app/theme';
import ProfileWizardScreen from './ProfileWizardScreen';
import LabelScanReviewScreen from '../nutrition/LabelScanReviewScreen';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Männlich',
  female: 'Weiblich',
  other: 'Divers',
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Überwiegend sitzend',
  light: 'Leicht aktiv',
  active: 'Aktiv',
  very_active: 'Sehr aktiv',
};

const GOAL_LABELS: Record<GoalType, string> = {
  lose_weight: 'Abnehmen',
  maintain: 'Gewicht halten',
  gain_muscle: 'Muskeln aufbauen',
  recomposition: 'Rekomposition',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MacroGrid({ targets, title }: { targets: ProfileTargets['restDay']; title: string }) {
  return (
    <View style={styles.macroCard}>
      <Text style={styles.macroTitle}>{title}</Text>
      <View style={styles.macroRow}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValueHighlight}>{targets.calories}</Text>
          <Text style={styles.macroLabel}>kcal</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{targets.proteinG} g</Text>
          <Text style={styles.macroLabel}>Protein</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{targets.fatG} g</Text>
          <Text style={styles.macroLabel}>Fett</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{targets.carbsG} g</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Products tab helpers
// ---------------------------------------------------------------------------

const SOURCE_BADGE: Record<string, string> = {
  manual: '✏️ Manuell',
  'label-scan': '📷 Scan',
  ai: '✨ KI',
};

function macroChip(value: number | undefined, label: string): string | null {
  if (value == null) return null;
  return `${Math.round(value * 10) / 10}g ${label}`;
}

function ProductCard({
  item,
  onTap,
  onDelete,
}: {
  item: ReusableItem;
  onTap: () => void;
  onDelete: () => void;
}) {
  const kcal = item.nutritionPer100g?.calories ?? null;
  const n = item.nutritionPer100g;
  const chips = [
    macroChip(n?.protein, 'P'),
    macroChip(n?.carbs, 'K'),
    macroChip(n?.fat, 'F'),
    macroChip(n?.fiber, 'Bal'),
  ].filter(Boolean) as string[];

  return (
    <TouchableOpacity style={styles.productCard} onPress={onTap} activeOpacity={0.7}>
      <View style={styles.productCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          {item.brand ? <Text style={styles.productBrand} numberOfLines={1}>{item.brand}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.productDeleteBtn}
        >
          <Text style={styles.productDeleteText}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.productCardFooter}>
        <View style={styles.productBadgeRow}>
          {kcal != null && (
            <View style={styles.kcalBadge}>
              <Text style={styles.kcalText}>{Math.round(kcal)} kcal</Text>
              <Text style={styles.kcalUnit}>/100g</Text>
            </View>
          )}
          {chips.map((c) => (
            <View key={c} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
            </View>
          ))}
        </View>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceText}>{SOURCE_BADGE[item.sourceType] ?? item.sourceType}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProfileScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'products'>('profile');

  // --- Profile tab state ---
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<ProfileTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // --- Products tab state ---
  const [products, setProducts] = useState<ReusableItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsRefreshing, setProductsRefreshing] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editItem, setEditItem] = useState<ReusableItem | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await profileApi.getMe();
      setProfile(res.profile as UserProfile | null);
      setTargets(res.targets);
    } catch {
      // Fehler ignorieren — leerer Zustand wird angezeigt
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadProfile();
    }, [loadProfile])
  );

  const loadProducts = useCallback(async () => {
    try {
      const { items: loaded } = await reusableItemsApi.list();
      setProducts(
        loaded
          .filter((i) => i.sourceType !== 'openFoodFacts')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    } catch {
      // ignore
    }
  }, []);

  // Load products when products tab becomes active
  useEffect(() => {
    if (activeTab === 'products') {
      setProductsLoading(true);
      loadProducts().finally(() => setProductsLoading(false));
    }
  }, [activeTab, loadProducts]);

  function onRefresh() {
    setRefreshing(true);
    void loadProfile();
  }

  function onProductsRefresh() {
    setProductsRefreshing(true);
    loadProducts().finally(() => setProductsRefreshing(false));
  }

  function handleProductDelete(item: ReusableItem) {
    Alert.alert(
      `"${item.name}" löschen?`,
      'Das Produkt wird aus deiner Bibliothek entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            reusableItemsApi.remove(item.id)
              .then(() => setProducts((prev) => prev.filter((i) => i.id !== item.id)))
              .catch(() => Alert.alert('Fehler', 'Produkt konnte nicht gelöscht werden.'));
          },
        },
      ],
    );
  }

  const filteredProducts = productSearch.trim()
    ? products.filter((i) =>
        i.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (i.brand ?? '').toLowerCase().includes(productSearch.toLowerCase()),
      )
    : products;

  // --- Loading ---
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // --- Wizard ---
  if (showWizard) {
    return (
      <ProfileWizardScreen
        isNewProfile={true}
        onComplete={() => { setShowWizard(false); setLoading(true); void loadProfile(); }}
        onDismiss={() => { setShowWizard(false); }}
      />
    );
  }

  // --- Kein Profil ---
  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Noch kein Profil</Text>
          <Text style={styles.emptyBody}>Richte dein Profil ein, damit FitTrack deine Ziele berechnen kann.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowWizard(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Profil einrichten →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Aktivitätslevel ermitteln ---
  const activityDisplay = profile
    ? profile.activityLevel
      ? ACTIVITY_LABELS[profile.activityLevel]
      : profile.stepsPerDay != null
      ? `${profile.stepsPerDay.toLocaleString()} Schritte/Tag`
      : '—'
    : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Top Tab Bar ── */}
      <View style={styles.tabBar}>
        {(['profile', 'products'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'profile' ? 'Mein Profil' : 'Meine Lebensmittel'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab: Mein Profil ── */}
      {activeTab === 'profile' && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {!profile ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Noch kein Profil</Text>
              <Text style={styles.emptyBody}>Richte dein Profil ein, damit FitTrack deine Ziele berechnen kann.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setShowWizard(true)} activeOpacity={0.8}>
                <Text style={styles.primaryButtonText}>Profil einrichten →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.screenTitle}>Mein Profil</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => (navigation as any).navigate('Library')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editButtonText}>Bibliothek</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => navigation.navigate('ProfileEdit', { profile })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editButtonText}>Bearbeiten</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Basisdaten */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Basisdaten</Text>
                <InfoRow label="Geschlecht" value={GENDER_LABELS[profile.gender]} />
                <InfoRow label="Alter" value={`${profile.age} Jahre`} />
                <InfoRow label="Größe" value={`${profile.heightCm} cm`} />
                <InfoRow label="Gewicht" value={`${profile.weightKg} kg`} />
                <InfoRow label="Zielgewicht" value={`${profile.targetWeightKg} kg`} />
              </View>

              {/* Alltag & Training */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Alltag & Training</Text>
                <InfoRow label="Aktivität" value={activityDisplay} />
                <InfoRow
                  label="Training"
                  value={
                    profile.trainingFrequencyPerWeek === 0
                      ? 'Kein Training'
                      : `${profile.trainingFrequencyPerWeek}× / Woche, ${profile.trainingDurationMinutes} min`
                  }
                />
                {profile.sports.length > 0 && (
                  <InfoRow label="Sportarten" value={profile.sports.join(', ')} />
                )}
              </View>

              {/* Ziel */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Ziel</Text>
                <InfoRow label="Ziel" value={GOAL_LABELS[profile.goal]} />
                {profile.goalIntensity && (
                  <InfoRow
                    label="Intensität"
                    value={profile.goalIntensity === 'gentle' ? 'Sanft' : profile.goalIntensity === 'moderate' ? 'Moderat' : 'Aggressiv'}
                  />
                )}
              </View>

              {/* Tagesziele */}
              {targets && (
                <>
                  <Text style={styles.sectionHeader}>Tagesziele</Text>
                  <MacroGrid title="🛌 Ruhetag" targets={targets.restDay} />
                  <MacroGrid title="💪 Trainingstag" targets={targets.trainingDay} />
                </>
              )}

              {/* Integrationen */}
              <Text style={[styles.cardTitle, styles.integrationHeader]}>Integrationen</Text>
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.navRow}
                  onPress={() => navigation.navigate('HealthConnect')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navRowLabel}>Health Connect</Text>
                  <Text style={styles.navRowChevron}>{'›'}</Text>
                </TouchableOpacity>
              </View>

            </>
          )}
        </ScrollView>
      )}

      {/* ── Tab: Meine Lebensmittel ── */}
      {activeTab === 'products' && (
        <>
          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Suchen…"
              placeholderTextColor={colors.textMuted}
              clearButtonMode="while-editing"
            />
          </View>

          {productsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.productScroll}
              refreshControl={
                <RefreshControl refreshing={productsRefreshing} onRefresh={onProductsRefresh} tintColor={colors.primary} />
              }
              showsVerticalScrollIndicator={false}
            >
              {filteredProducts.length === 0 ? (
                <View style={styles.productEmpty}>
                  <Text style={styles.productEmptyIcon}>📦</Text>
                  <Text style={styles.productEmptyTitle}>
                    {productSearch.trim() ? 'Keine Treffer' : 'Noch keine Produkte'}
                  </Text>
                  <Text style={styles.productEmptyText}>
                    {productSearch.trim()
                      ? 'Versuche einen anderen Suchbegriff.'
                      : 'Füge Produkte über den Scan- oder Manuell-Tab beim Hinzufügen eines Eintrags hinzu.'}
                  </Text>
                </View>
              ) : (
                filteredProducts.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    onTap={() => setEditItem(item)}
                    onDelete={() => handleProductDelete(item)}
                  />
                ))
              )}
              <View style={{ height: spacing.xl * 2 }} />
            </ScrollView>
          )}

          {/* Edit Modal */}
          {editItem && (
            <LabelScanReviewScreen
              visible
              mealId=""
              mode="edit"
              existingItem={editItem}
              onClose={() => setEditItem(null)}
              onSaved={() => setEditItem(null)}
              onUpdated={() => {
                setEditItem(null);
                void loadProducts();
                setTimeout(() => void loadProducts(), 4000);
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabText: { ...typography.body2, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '600' },

  // ── Profile Tab ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  screenTitle: { ...typography.h2, color: colors.text },
  editButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  editButtonText: { ...typography.button, color: colors.primaryBright },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase' },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.body2, color: colors.textSecondary },
  infoValue: { ...typography.body2, color: colors.text, fontWeight: '600' },

  sectionHeader: { ...typography.h3, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },

  integrationHeader: { marginTop: spacing.md, marginBottom: spacing.xs },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  navRowLabel: { ...typography.body1, color: colors.text },
  navRowChevron: { fontSize: 20, color: colors.textMuted, lineHeight: 24 },

  macroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  macroTitle: { ...typography.body1, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem: { alignItems: 'center' },
  macroValueHighlight: { ...typography.h3, color: colors.primaryBright },
  macroValue: { ...typography.body1, color: colors.text, fontWeight: '600' },
  macroLabel: { ...typography.caption, color: colors.textMuted },

  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  emptyBody: { ...typography.body1, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  primaryButtonText: { ...typography.button, color: colors.white },

  // ── Products Tab ──
  searchContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: {
    ...typography.body1,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productScroll: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  productEmpty: { alignItems: 'center', paddingTop: spacing.xl * 2 },
  productEmptyIcon: { fontSize: 48, marginBottom: spacing.md },
  productEmptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  productEmptyText: { ...typography.body2, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },

  // Product card
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  productCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  productName: { ...typography.body1, color: colors.text, fontWeight: '600' },
  productBrand: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  productDeleteBtn: { paddingLeft: spacing.sm },
  productDeleteText: { ...typography.body1, color: colors.textMuted },
  productCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  productBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, flex: 1 },
  kcalBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    gap: 2,
  },
  kcalText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  kcalUnit: { fontSize: 9, color: colors.primary },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  chipText: { ...typography.caption, color: colors.textSecondary },
  sourceBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sourceText: { ...typography.caption, color: colors.textMuted },
});

