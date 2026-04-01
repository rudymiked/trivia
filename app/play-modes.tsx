import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/hooks/useGame';
import { fetchPersonalizedPuzzle } from '@/services/api';
import { generatePuzzleByCategory, getCategories } from '@/services/puzzle';
import { Href, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  places: 'Famous Places',
  questions: 'Trivia Questions',
  geography: 'Geography',
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  places: 'Landmarks, monuments, and iconic locations',
  questions: 'Historical and cultural trivia',
  geography: 'Rivers, mountains, deserts, and more',
};

const CATEGORY_ICONS: Record<string, string> = {
  places: '🏛️',
  questions: '❓',
  geography: '🌍',
};

const CATEGORY_ACCENT: Record<string, 'teal' | 'gold' | 'violet' | 'green' | 'red' | 'blue'> = {
  places: 'blue',
  questions: 'violet',
  geography: 'green',
};

type PracticeDifficulty = 'all' | 'easy' | 'medium' | 'hard';

type QuickMode = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: 'all' | 'random' | 'places' | 'questions' | 'geography';
  difficulty?: PracticeDifficulty;
  accent: 'teal' | 'gold' | 'violet' | 'green' | 'red' | 'blue';
};

const DIFFICULTY_OPTIONS: Array<{ value: PracticeDifficulty; label: string }> = [
  { value: 'all', label: 'Default' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const QUICK_MODES: QuickMode[] = [
  {
    id: 'all-categories',
    title: 'All Categories',
    description: 'Mix of everything',
    emoji: '🎯',
    category: 'all',
    accent: 'teal',
  },
  {
    id: 'random',
    title: 'Random',
    description: 'Surprise me!',
    emoji: '🎲',
    category: 'random',
    accent: 'gold',
  },
  {
    id: 'landmark-sprint',
    title: 'Landmark Sprint',
    description: 'Fast iconic places only',
    emoji: '🏛️',
    category: 'places',
    difficulty: 'easy',
    accent: 'blue',
  },
  {
    id: 'trivia-rush',
    title: 'Trivia Rush',
    description: 'Culture and history clues',
    emoji: '🧠',
    category: 'questions',
    difficulty: 'medium',
    accent: 'violet',
  },
  {
    id: 'geo-master',
    title: 'Geo Master',
    description: 'Hardcore physical geography',
    emoji: '🗺️',
    category: 'geography',
    difficulty: 'hard',
    accent: 'red',
  },
  {
    id: 'mixed-medium',
    title: 'Mixed Medium',
    description: 'Balanced challenge across all categories',
    emoji: '⚖️',
    category: 'all',
    difficulty: 'medium',
    accent: 'gold',
  },
  {
    id: 'roulette-hard',
    title: 'Roulette Hard',
    description: 'Random category, hard clues only',
    emoji: '🎲',
    category: 'random',
    difficulty: 'hard',
    accent: 'green',
  },
];

export default function PlayModesScreen() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const { startGame } = useGameStore();
  const isWeb = Platform.OS === 'web';
  const categories = getCategories();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<PracticeDifficulty>('all');
  const [quickModesWidth, setQuickModesWidth] = useState(0);
  const [categoryModesWidth, setCategoryModesWidth] = useState(0);

  const quickModeLayout = useMemo(() => {
    const gap = isWeb ? 10 : 12;
    if (quickModesWidth <= 0) {
      return { columns: isWeb ? 6 : 2, tileSize: isWeb ? 108 : 150, gap };
    }

    const columns = isWeb
      ? quickModesWidth >= 1400
        ? 8
        : quickModesWidth >= 1180
          ? 7
          : quickModesWidth >= 980
            ? 6
            : quickModesWidth >= 760
              ? 5
              : 4
      : quickModesWidth >= 780
        ? 4
        : quickModesWidth >= 520
          ? 3
          : 2;
    const tileSize = Math.floor((quickModesWidth - gap * (columns - 1)) / columns);

    return {
      columns,
      tileSize: isWeb ? Math.max(92, Math.min(128, tileSize)) : Math.max(120, tileSize),
      gap,
    };
  }, [isWeb, quickModesWidth]);

  const categoryModeLayout = useMemo(() => {
    const gap = isWeb ? 10 : 12;
    if (categoryModesWidth <= 0) {
      return { columns: isWeb ? 6 : 2, tileSize: isWeb ? 108 : 150, gap };
    }

    const columns = isWeb
      ? categoryModesWidth >= 1400
        ? 8
        : categoryModesWidth >= 1180
          ? 7
          : categoryModesWidth >= 980
            ? 6
            : categoryModesWidth >= 760
              ? 5
              : 4
      : categoryModesWidth >= 780
        ? 4
        : categoryModesWidth >= 520
          ? 3
          : 2;
    const tileSize = Math.floor((categoryModesWidth - gap * (columns - 1)) / columns);

    return {
      columns,
      tileSize: isWeb ? Math.max(92, Math.min(128, tileSize)) : Math.max(120, tileSize),
      gap,
    };
  }, [categoryModesWidth, isWeb]);

  const getQuickModeAccentStyle = (accent: QuickMode['accent']) => {
    switch (accent) {
      case 'gold':
        return styles.quickModeGold;
      case 'violet':
        return styles.quickModeViolet;
      case 'green':
        return styles.quickModeGreen;
      case 'red':
        return styles.quickModeRed;
      case 'blue':
        return styles.quickModeBlue;
      default:
        return styles.quickModeTeal;
    }
  };

  const runMode = async (
    category: 'all' | 'random' | 'places' | 'questions' | 'geography',
    difficulty: PracticeDifficulty
  ) => {
    setIsLoading(true);

    try {
      const response = await fetchPersonalizedPuzzle(user!.id, category, difficulty);
      if (response.data) {
        startGame(response.data);
        router.push(`/game/${response.data.id}` as Href);
        return;
      }

      const puzzle = generatePuzzleByCategory(category, difficulty);
      startGame(puzzle);
      router.push(`/game/${puzzle.id}` as Href);
    } catch (error) {
      console.error('Error generating puzzle:', error);
      const puzzle = generatePuzzleByCategory(category, difficulty);
      startGame(puzzle);
      router.push(`/game/${puzzle.id}` as Href);
    } finally {
      setIsLoading(false);
    }
  };

  const requireSignedIn = () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Play Modes are only available for signed-in users. You can play the daily puzzle on the home screen without signing in.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => signIn() },
        ]
      );
      return false;
    }

    return true;
  };

  const handleSelectQuickMode = async (mode: QuickMode) => {
    if (!requireSignedIn()) {
      return;
    }

    const modeDifficulty = mode.difficulty ?? selectedDifficulty;
    await runMode(mode.category, modeDifficulty);
  };

  const handleSelectCategoryMode = async (category: string) => {
    if (!requireSignedIn()) {
      return;
    }

    await runMode(category as QuickMode['category'], selectedDifficulty);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Generating puzzle...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Play Modes</Text>
        <Text style={styles.subtitle}>
          {user ? 'Personalized puzzles just for you' : 'Sign in to unlock play modes'}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Quick Modes</Text>
        <View
          style={[styles.quickModesGrid, { gap: quickModeLayout.gap }]}
          onLayout={(event) => setQuickModesWidth(event.nativeEvent.layout.width)}
        >
          {QUICK_MODES.map((mode) => (
            <Pressable
              key={mode.id}
              style={[
                styles.quickModeTile,
                {
                  width: quickModeLayout.tileSize + 12,
                  height: quickModeLayout.tileSize,
                  padding: isWeb ? 0 : 12,
                },
                getQuickModeAccentStyle(mode.accent),
              ]}
              onPress={() => handleSelectQuickMode(mode)}
            >
              <Text style={styles.quickModeIcon}>{mode.emoji}</Text>
              <Text style={styles.quickModeTitle}>{mode.title}</Text>
              <Text style={styles.quickModeDescription} numberOfLines={2}>
                {mode.description}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Categories</Text>

        <View style={styles.difficultyRow}>
          {DIFFICULTY_OPTIONS.map((option) => {
            const isSelected = selectedDifficulty === option.value;
            const selectedStyle =
              option.value === 'easy'
                ? styles.difficultyChipEasySelected
                : option.value === 'medium'
                  ? styles.difficultyChipMediumSelected
                  : option.value === 'hard'
                    ? styles.difficultyChipHardSelected
                    : styles.difficultyChipSelected;

            const selectedTextStyle =
              option.value === 'medium'
                ? styles.difficultyChipTextSelectedDark
                : styles.difficultyChipTextSelected;

            return (
              <Pressable
                key={option.value}
                style={[styles.difficultyChip, isSelected && selectedStyle]}
                onPress={() => setSelectedDifficulty(option.value)}
              >
                <Text
                  style={[
                    styles.difficultyChipText,
                    isSelected && selectedTextStyle,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.difficultyHelpText}>
          Default includes easy, medium, and hard questions.
        </Text>

        <Text style={styles.sectionTitle}>Categories</Text>
        <View
          style={[styles.quickModesGrid, { gap: categoryModeLayout.gap }]}
          onLayout={(event) => setCategoryModesWidth(event.nativeEvent.layout.width)}
        >
          {categories.map((category) => (
            <Pressable
              key={category}
              style={[
                styles.quickModeTile,
                {
                  width: categoryModeLayout.tileSize,
                  height: categoryModeLayout.tileSize,
                  padding: isWeb ? 5 : 12,
                },
                getQuickModeAccentStyle(CATEGORY_ACCENT[category] || 'teal'),
              ]}
              onPress={() => handleSelectCategoryMode(category)}
            >
              <Text style={styles.quickModeIcon}>{CATEGORY_ICONS[category] || '📍'}</Text>
              <Text style={styles.quickModeTitle}>{CATEGORY_DISPLAY_NAMES[category] || category}</Text>
              <Text style={styles.quickModeDescription} numberOfLines={2}>
                {CATEGORY_DESCRIPTIONS[category] || `Practice ${category} questions`}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A202C',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#718096',
    fontSize: 16,
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  quickModesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    width: '100%',
  },
  quickModeTile: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
  },
  quickModeTeal: {
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  quickModeGold: {
    backgroundColor: 'rgba(255, 193, 7, 0.12)',
    borderColor: 'rgba(255, 193, 7, 0.34)',
  },
  quickModeViolet: {
    backgroundColor: 'rgba(159, 122, 234, 0.16)',
    borderColor: 'rgba(159, 122, 234, 0.34)',
  },
  quickModeGreen: {
    backgroundColor: 'rgba(72, 187, 120, 0.16)',
    borderColor: 'rgba(72, 187, 120, 0.34)',
  },
  quickModeRed: {
    backgroundColor: 'rgba(245, 101, 101, 0.16)',
    borderColor: 'rgba(245, 101, 101, 0.34)',
  },
  quickModeBlue: {
    backgroundColor: 'rgba(66, 153, 225, 0.16)',
    borderColor: 'rgba(66, 153, 225, 0.34)',
  },
  quickModeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickModeTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickModeDescription: {
    color: '#CBD5E0',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  quickModeMeta: {
    color: '#A0AEC0',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  difficultyChip: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  difficultyChipSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  difficultyChipEasySelected: {
    borderColor: '#2F855A',
    backgroundColor: 'rgba(72, 187, 120, 0.28)',
  },
  difficultyChipMediumSelected: {
    borderColor: '#D69E2E',
    backgroundColor: 'rgba(246, 224, 94, 0.9)',
  },
  difficultyChipHardSelected: {
    borderColor: '#E53E3E',
    backgroundColor: 'rgba(245, 101, 101, 0.28)',
  },
  difficultyChipText: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
  },
  difficultyChipTextSelected: {
    color: '#FFFFFF',
  },
  difficultyChipTextSelectedDark: {
    color: '#1A202C',
  },
  difficultyHelpText: {
    color: '#718096',
    fontSize: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  modeIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modeDescription: {
    color: '#718096',
    fontSize: 14,
    marginTop: 4,
  },
  backButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4A5568',
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
