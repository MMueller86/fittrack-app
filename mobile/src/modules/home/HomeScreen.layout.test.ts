import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { spacing } from '../../app/theme';

const homeSource = readFileSync(new URL('./HomeScreen.tsx', import.meta.url), 'utf8');

describe('HomeScreen activity card layout', () => {
  it('renders the Daily Insight only inside the coaching card, not as a separate Home card', () => {
    expect(homeSource).not.toMatch(/import \{ InsightCard \}/);
    expect(homeSource).not.toMatch(/<InsightCard\b/);
    expect(homeSource).toMatch(/<CoachingHeroCard[\s\S]*?insight=\{insight\}[\s\S]*?insightDate=\{insightDate\}/);
  });

  it('places both activity states inside the same screen-owned horizontal inset', () => {
    expect(homeSource).toMatch(
      /<View style=\{styles\.activitySection\}>\s*\{todayDiary\.specialActivity \? \(\s*<ActivityCard[\s\S]*?\) : \(\s*<ActivityCtaCard[\s\S]*?\)\}\s*<\/View>/,
    );
    const activityStyle = homeSource.match(/activitySection:\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(activityStyle).toContain('marginHorizontal: spacing.md');
    expect(activityStyle).not.toMatch(/width:|paddingHorizontal:/);
  });

  it('matches neighboring Home card insets without doubling activity card margins', () => {
    expect(spacing.md).toBe(16);
    for (const filename of ['DayNutritionCard.tsx', 'WeeklyReviewCard.tsx', 'InsightCard.tsx']) {
      const source = readFileSync(new URL(`./${filename}`, import.meta.url), 'utf8');
      const cardStyle = source.match(/card:\s*\{([^}]*)\}/)?.[1] ?? '';
      expect(cardStyle).toContain('marginHorizontal: spacing.md');
    }
    for (const filename of ['ActivityCard.tsx', 'ActivityCtaCard.tsx']) {
      const source = readFileSync(new URL(`../nutrition/components/${filename}`, import.meta.url), 'utf8');
      const cardStyle = source.match(/card:\s*\{([^}]*)\}/)?.[1] ?? '';
      expect(cardStyle).not.toContain('marginHorizontal');
    }
  });
});

describe('Main tab screen safe-area layout', () => {
  it.each([
    './HomeScreen.tsx',
    '../nutrition/DiaryScreen.tsx',
    '../recipes/RecipeListScreen.tsx',
    '../progress/ProgressScreen.tsx',
    '../profile/ProfileScreen.tsx',
  ])('%s leaves the bottom system inset to the tab navigator', (filename) => {
    const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
    const screenSafeArea = source.match(/<SafeAreaView\b[^>]*>/)?.[0];

    expect(screenSafeArea).toContain("edges={['top']}");
  });
});