import { useGameStore } from '@/hooks/useGame';
import { generatePuzzleByCategory, getCategories } from '@/services/puzzle';
import { Href, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

export default function PlayModesScreen() {
  const router = useRouter();
  const { startGame } = useGameStore();
  const categories = getCategories();

  const handleSelectMode = (category: string) => {
    const puzzle = generatePuzzleByCategory(category);
    startGame(puzzle);
    router.push(`/game/${puzzle.id}` as Href);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Play Modes</Text>
        <Text style={styles.subtitle}>Choose a category to practice</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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
