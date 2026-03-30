import { RoundResult } from '@/types/game';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface RoundProgressProps {
  totalRounds: number;
  currentRound: number;
  results: RoundResult[];
}

function RoundDot({
  index,
  currentRound,
  results,
}: {
  index: number;
  currentRound: number;
  results: RoundResult[];
}) {
  const scaleAnim = useRef(new Animated.Value(index === 0 ? 1 : 0.6)).current;
  const prevResultsLengthRef = useRef(results.length);

  const isCompleted = index < results.length;
  const isCurrent = index === currentRound && !isCompleted;

  const getColor = () => {
    if (isCompleted) {
      const result = results[index];
      if (result.score >= 80) return '#4ECDC4';
      if (result.score >= 50) return '#FFE66D';
      return '#FF6B6B';
    }
    if (isCurrent) return '#FFFFFF';
    return '#4A5568';
  };

  // Pop animation when this dot just got a result
  useEffect(() => {
    if (results.length > prevResultsLengthRef.current && index === results.length - 1) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.5, tension: 200, friction: 5, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 140, friction: 7, useNativeDriver: true }),
      ]).start();
    }
    prevResultsLengthRef.current = results.length;
  }, [results.length]);

  // Pulse the current dot
  useEffect(() => {
    if (isCurrent) {
      Animated.spring(scaleAnim, { toValue: 1.25, tension: 160, friction: 6, useNativeDriver: true }).start();
    } else if (!isCompleted) {
      Animated.spring(scaleAnim, { toValue: 0.7, tension: 160, friction: 6, useNativeDriver: true }).start();
    }
  }, [isCurrent, isCompleted]);

  const size = isCurrent ? 16 : 12;
  const borderRadius = size / 2;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: getColor(),
          transform: [{ scale: scaleAnim }],
        },
        isCurrent && styles.currentIndicator,
      ]}
    />
  );
}

export default function RoundProgress({ totalRounds, currentRound, results }: RoundProgressProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalRounds }).map((_, index) => (
        <RoundDot key={index} index={index} currentRound={currentRound} results={results} />
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
  currentIndicator: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    opacity: 1,
  },
});
