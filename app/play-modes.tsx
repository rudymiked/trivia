import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/hooks/useGame';
import { fetchPersonalizedPuzzle } from '@/services/api';
import { generatePuzzleByCategory, getCategories } from '@/services/puzzle';
import { Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

type PracticeDifficulty = 'all' | 'easy' | 'medium' | 'hard';

const DIFFICULTY_OPTIONS: Array<{ value: PracticeDifficulty; label: string }> = [
  { value: 'all', label: 'Default' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export default function PlayModesScreen() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const { startGame } = useGameStore();
  const categories = getCategories();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<PracticeDifficulty>('all');

  const handleSelectMode = async (category: string) => {
    // Require login for all play modes
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Play Modes are only available for signed-in users. You can play the daily puzzle on the home screen without signing in.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => signIn() },
        ]
      );
      return;
    }

    setIsLoading(true);

    try {
      // For logged-in users with "all" or "random", use server personalization
      if (user) {
        const response = await fetchPersonalizedPuzzle(user.id, category, selectedDifficulty);
        if (response.data) {
          startGame(response.data);
          router.push(`/game/${response.data.id}` as Href);
          return;
        }
        // Fall through to local generation if server fails
      }

      // Local generation for anonymous users or category-specific modes
      const puzzle = generatePuzzleByCategory(category, selectedDifficulty);
      startGame(puzzle);
      router.push(`/game/${puzzle.id}` as Href);
    } catch (error) {
      console.error('Error generating puzzle:', error);
      // Fallback to local generation
      const puzzle = generatePuzzleByCategory(category, selectedDifficulty);
      startGame(puzzle);
      router.push(`/game/${puzzle.id}` as Href);
    } finally {
      setIsLoading(false);
    }
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
        <Text style={styles.sectionTitle}>Difficulty</Text>
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

        {/* Special modes */}
        <View style={styles.specialModes}>
          <Pressable
            style={[styles.modeButton, styles.allButton]}
            onPress={() => handleSelectMode('all')}
          >
            <Text style={styles.modeIcon}>🎯</Text>
            <View style={styles.modeTextContainer}>
              <Text style={styles.modeTitle}>All Categories</Text>
              <Text style={styles.modeDescription}>Mix of everything</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.modeButton, styles.randomButton]}
            onPress={() => handleSelectMode('random')}
          >
            <Text style={styles.modeIcon}>🎲</Text>
            <View style={styles.modeTextContainer}>
              <Text style={styles.modeTitle}>Random</Text>
              <Text style={styles.modeDescription}>Surprise me!</Text>
            </View>
          </Pressable>
        </View>

        {/* Category modes */}
        <Text style={styles.sectionTitle}>Categories</Text>
        {categories.map((category) => (
          <Pressable
            key={category}
            style={styles.modeButton}
            onPress={() => handleSelectMode(category)}
          >
            <Text style={styles.modeIcon}>
              {CATEGORY_ICONS[category] || '📍'}
            </Text>
            <View style={styles.modeTextContainer}>
              <Text style={styles.modeTitle}>
                {CATEGORY_DISPLAY_NAMES[category] || category}
              </Text>
              <Text style={styles.modeDescription}>
                {CATEGORY_DESCRIPTIONS[category] || `Practice ${category} questions`}
              </Text>
            </View>
          </Pressable>
        ))}
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
  specialModes: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
  allButton: {
    flex: 1,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  randomButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
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
