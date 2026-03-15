import { RoundResult } from '@/types/game';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface RoundProgressProps {
  totalRounds: number;
  currentRound: number;
  results: RoundResult[];
}

export default function RoundProgress({ totalRounds, currentRound, results }: RoundProgressProps) {
  const getIndicatorColor = (index: number) => {
    if (index < results.length) {
      const result = results[index];
      if (result.score >= 80) return '#4ECDC4';
      if (result.score >= 50) return '#FFE66D';
      return '#FF6B6B';
    }
    if (index === currentRound) return '#FFFFFF';
    return '#4A5568';
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: totalRounds }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.indicator,
            { backgroundColor: getIndicatorColor(index) },
            index === currentRound && results.length <= index && styles.currentIndicator,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.8,
  },
  currentIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    opacity: 1,
  },
});
