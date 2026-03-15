import { Round } from '@/types/game';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ClueCardProps {
  round: Round;
  roundNumber: number;
  totalRounds: number;
}

const difficultyColors = {
  easy: '#4ECDC4',
  medium: '#FFE66D',
  hard: '#FF6B6B',
};

export default function ClueCard({ round, roundNumber, totalRounds }: ClueCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.roundText}>
          Round {roundNumber}/{totalRounds}
        </Text>
        <View style={[styles.difficultyBadge, { backgroundColor: difficultyColors[round.difficulty] }]}>
          <Text style={styles.difficultyText}>{round.difficulty.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.clueText}>{round.clue}</Text>
      <Text style={styles.hintText}>
        {round.type === 'landmark' && 'Tap the location of this landmark'}
        {round.type === 'city' && 'Tap the location of this city'}
        {round.type === 'country' && `Tap anywhere in ${round.country}`}
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
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
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
  hintText: {
    color: '#718096',
    fontSize: 14,
    textAlign: 'center',
  },
});
