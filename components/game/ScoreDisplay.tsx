import { RoundResult } from '@/types/game';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

interface ScoreDisplayProps {
  result: RoundResult;
  onAnimationComplete?: () => void;
}

export default function ScoreDisplay({ result, onAnimationComplete }: ScoreDisplayProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [displayedScore, setDisplayedScore] = useState(0);
  const targetScore = Math.round(result.score / result.multiplier);

  useEffect(() => {
    // Entrance animation
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
    ]).start(() => {
      if (onAnimationComplete) {
        setTimeout(onAnimationComplete, 1500);
      }
    });

    // Score count-up animation
    const duration = 700;
    const steps = 30;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedScore(Math.round(eased * targetScore));
      if (step >= steps) {
        clearInterval(timer);
        setDisplayedScore(targetScore);
      }
    }, interval);

    // Pulse effect on score circle after count-up
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 160, useNativeDriver: true }),
        Animated.spring(pulseAnim, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
      ]).start();
    }, duration + 80);

    return () => clearInterval(timer);
  }, []);

  const getScoreColor = () => {
    const baseScore = result.score / result.multiplier;
    if (baseScore >= 80) return '#4ECDC4';
    if (baseScore >= 50) return '#FFE66D';
    return '#FF6B6B';
  };

  const getScoreGlow = () => {
    const baseScore = result.score / result.multiplier;
    if (baseScore >= 80) return 'rgba(78, 205, 196, 0.25)';
    if (baseScore >= 50) return 'rgba(255, 230, 109, 0.2)';
    return 'rgba(255, 107, 107, 0.2)';
  };

  const formatDistance = (km: number) => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${Math.round(km).toLocaleString()} km`;
  };

  const baseScore = result.score / result.multiplier;
  const feedbackLabel =
    result.distanceKm < 50
      ? '🎯 Bullseye!'
      : baseScore >= 90
      ? '🔥 On fire!'
      : baseScore >= 80
      ? '⭐ Great shot!'
      : baseScore >= 60
      ? '👍 Nice try!'
      : baseScore >= 40
      ? '🌍 Getting closer!'
      : '📍 Keep exploring!';

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
      <Animated.View
        style={[
          styles.scoreCircle,
          { backgroundColor: getScoreGlow(), transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Text style={[styles.scoreText, { color: getScoreColor() }]}>
          {displayedScore}
        </Text>
        {result.multiplier > 1 && (
          <Text style={styles.multiplierText}>x{result.multiplier}</Text>
        )}
      </Animated.View>

      <Text style={styles.distanceText}>
        {formatDistance(result.distanceKm)} away
      </Text>

      <Text style={[styles.feedbackText, { color: getScoreColor() }]}>{feedbackLabel}</Text>
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
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '700',
  },
  multiplierText: {
    color: '#FFE66D',
    fontSize: 13,
    fontWeight: '600',
  },
  distanceText: {
    color: '#A0AEC0',
    fontSize: 14,
    marginBottom: 6,
  },
  feedbackText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
});
