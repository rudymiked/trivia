import { Round } from '@/types/game';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ClueCardProps {
  round: Round;
  roundNumber: number;
  totalRounds: number;
  showAnswer?: boolean;
}

const difficultyColors = {
  easy: '#4ECDC4',
  medium: '#FFE66D',
  hard: '#FF6B6B',
};

const categoryColors: Record<string, string> = {
  places: '#9F7AEA',
  questions: '#ED8936',
  geography: '#48BB78',
};

export default function ClueCard({ round, roundNumber, totalRounds, showAnswer = false }: ClueCardProps) {
  const isTrivia = round.category === 'questions';
  const isGeography = round.category === 'geography';

  const getCategoryLabel = () => {
    if (isTrivia) return 'TRIVIA';
    if (isGeography) return 'GEOGRAPHY';
    return 'PLACES';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.roundText}>
          Round {roundNumber}/{totalRounds}
        </Text>
        <View style={styles.badges}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColors[round.category] || '#9F7AEA' }]}>
            <Text style={styles.badgeText}>
              {getCategoryLabel()}
            </Text>
          </View>
          <View style={[styles.difficultyBadge, { backgroundColor: difficultyColors[round.difficulty] }]}>
            <Text style={styles.badgeText}>{round.difficulty.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.clueText, isTrivia && styles.triviaClueText]}>
        {round.clue}
      </Text>

      {showAnswer && round.answer && (
        <View style={styles.answerContainer}>
          <Text style={styles.answerLabel}>Answer:</Text>
          <Text style={styles.answerText}>{round.answer}</Text>
        </View>
      )}

      <Text style={styles.hintText}>
        {isTrivia && 'Tap where you think the answer is located'}
        {isGeography && 'Tap the location of this feature'}
        {!isTrivia && !isGeography && round.type === 'landmark' && 'Tap the location of this landmark'}
        {!isTrivia && !isGeography && round.type === 'city' && 'Tap the location of this city'}
        {!isTrivia && !isGeography && round.type === 'country' && `Tap anywhere in ${round.country}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roundText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#1A202C',
    fontSize: 12,
    fontWeight: '700',
  },
  clueText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  triviaClueText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  answerContainer: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    alignItems: 'center',
  },
  answerLabel: {
    color: '#A0AEC0',
    fontSize: 12,
    marginBottom: 4,
  },
  answerText: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: '700',
  },
  hintText: {
    color: '#718096',
    fontSize: 14,
    textAlign: 'center',
  },
});
