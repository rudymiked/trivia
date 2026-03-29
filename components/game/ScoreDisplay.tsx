import { RoundResult } from '@/types/game';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface ScoreDisplayProps {
  result: RoundResult;
  onAnimationComplete?: () => void;
}

export default function ScoreDisplay({ result, onAnimationComplete }: ScoreDisplayProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (onAnimationComplete) {
        setTimeout(onAnimationComplete, 1500);
      }
    });
  }, []);

  const getScoreColor = () => {
    const baseScore = result.score / result.multiplier;
    if (baseScore >= 80) return '#4ECDC4';
    if (baseScore >= 50) return '#FFE66D';
    return '#FF6B6B';
  };

  const formatDistance = (km: number) => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${Math.round(km).toLocaleString()} km`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.scoreCircle}>
        <Text style={[styles.scoreText, { color: getScoreColor() }]}>
          {Math.round(result.score / result.multiplier)}
        </Text>
        {result.multiplier > 1 && (
          <Text style={styles.multiplierText}>x{result.multiplier}</Text>
        )}
      </View>

      <Text style={styles.distanceText}>
        {formatDistance(result.distanceKm)} away
      </Text>

      {result.score >= 80 && (
        <Text style={styles.bonusText}>Great shot!</Text>
      )}
      {result.distanceKm < 50 && (
        <Text style={styles.perfectText}>Perfect!</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 16,
    margin: 12,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '700',
  },
  multiplierText: {
    color: '#FFE66D',
    fontSize: 14,
    fontWeight: '600',
  },
  distanceText: {
    color: '#A0AEC0',
    fontSize: 14,
    marginBottom: 4,
  },
  bonusText: {
    color: '#4ECDC4',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  perfectText: {
    color: '#FFE66D',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
});
