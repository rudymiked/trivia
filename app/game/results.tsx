import { useAuth } from '@/hooks/useAuth';
import { useGameStore } from '@/hooks/useGame';
import { submitScore } from '@/services/api';
import { getTodayDate } from '@/services/puzzle';
import { getUserProgress, saveDailyResult, saveGameResult, type UserProgress } from '@/services/storage';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

export default function ResultsScreen() {
  const router = useRouter();
  const { user, getValidIdToken } = useAuth();
  const { puzzle, results, totalScore, resetGame } = useGameStore();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(false);

  // Check if this is a daily puzzle (date-based ID)
  const isDailyPuzzle = puzzle && /^\d{4}-\d{2}-\d{2}$/.test(puzzle.id);

  useEffect(() => {
    const saveAndLoadProgress = async () => {
      const currentProgress = await getUserProgress();
      if (puzzle) {
        // Only save to progress/stats for daily puzzles
        if (isDailyPuzzle) {
          await saveGameResult(puzzle.date, totalScore, currentProgress.lastPlayedDate);
          // Save the full results for this daily puzzle
          await saveDailyResult(puzzle.date, totalScore, results);
        }

        // Sync to backend if logged in with valid token (daily puzzles only)
        if (user && isDailyPuzzle) {
          try {
            const roundScores = results.map(r => Math.round(r.score));
            const validToken = getValidIdToken();
            await submitScore(puzzle.date, user.id, user.name, totalScore, roundScores, validToken || undefined);
            setSynced(true);
          } catch (error) {
            console.error('Failed to sync score:', error);
          }
        }
      }
      const updatedProgress = await getUserProgress();
      setProgress(updatedProgress);
    };

    saveAndLoadProgress();
  }, [puzzle, totalScore, results, user, isDailyPuzzle, getValidIdToken]);

  const getScoreEmoji = (score: number, multiplier: number) => {
    const baseScore = score / multiplier;
    if (baseScore >= 90) return '🟢';
    if (baseScore >= 70) return '🟡';
    if (baseScore >= 50) return '🟠';
    return '🔴';
  };

  const generateShareText = () => {
    if (!puzzle) return '';

    const emojiGrid = results.map((r) => getScoreEmoji(r.score, r.multiplier)).join('');
    const date = new Date(puzzle.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://pinpoint.app';

    return `PinPoint ${date}

${emojiGrid} ${totalScore}/500

Play at: ${appUrl}`;
  };

  const handleShare = async () => {
    const shareText = generateShareText();

    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      try {
        await Share.share({
          message: shareText,
        });
      } catch {
        // User cancelled
      }
    }
  };

  const handlePlayAgain = () => {
    resetGame();
    router.replace('/');
  };

  if (!puzzle) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No game data found</Text>
        <Pressable style={styles.button} onPress={handlePlayAgain}>
          <Text style={styles.buttonText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Complete!</Text>

      {/* Score summary */}
      <View style={styles.scoreCard}>
        <Text style={styles.dateText}>
          {new Date(puzzle.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        <Text style={styles.totalScore}>{totalScore}</Text>
        <Text style={styles.maxScore}>out of 500</Text>

        {/* Round breakdown */}
        <View style={styles.roundsContainer}>
          {results.map((result, index) => (
            <View key={index} style={styles.roundRow}>
              <Text style={styles.roundLabel}>Round {index + 1}</Text>
              <View style={styles.roundScoreContainer}>
                <Text style={styles.roundEmoji}>
                  {getScoreEmoji(result.score, result.multiplier)}
                </Text>
                <Text style={styles.roundScore}>
                  {Math.round(result.score / result.multiplier)}
                  {result.multiplier > 1 && (
                    <Text style={styles.multiplier}> x{result.multiplier}</Text>
                  )}
                </Text>
                <Text style={styles.roundDistance}>
                  {Math.round(result.distanceKm)} km
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Stats */}
      {progress && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress.gamesPlayed}</Text>
            <Text style={styles.statLabel}>Played</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress.highScore}</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>
            {copied ? 'Copied!' : Platform.OS === 'web' ? 'Copy Results' : 'Share Results'}
          </Text>
        </Pressable>

        <Pressable style={styles.homeButton} onPress={handlePlayAgain}>
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A202C',
    padding: 20,
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  scoreCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  dateText: {
    color: '#A0AEC0',
    fontSize: 14,
    marginBottom: 8,
  },
  totalScore: {
    color: '#4ECDC4',
    fontSize: 72,
    fontWeight: '700',
  },
  maxScore: {
    color: '#718096',
    fontSize: 18,
    marginBottom: 24,
  },
  roundsContainer: {
    width: '100%',
  },
  roundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  roundLabel: {
    color: '#A0AEC0',
    fontSize: 14,
  },
  roundScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundEmoji: {
    fontSize: 16,
  },
  roundScore: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
  },
  multiplier: {
    color: '#FFE66D',
    fontSize: 12,
  },
  roundDistance: {
    color: '#718096',
    fontSize: 12,
    minWidth: 60,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#718096',
    fontSize: 12,
    marginTop: 4,
  },
  actionsContainer: {
    marginTop: 32,
    gap: 12,
  },
  shareButton: {
    backgroundColor: '#4ECDC4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
  homeButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4A5568',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#4ECDC4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
});
