import { ClueCard, RoundProgress, ScoreDisplay } from '@/components/game';
import Globe from '@/components/map';
import { useGameStore } from '@/hooks/useGame';
import { generateDailyPuzzle } from '@/services/puzzle';
import { Coordinates, RoundResult } from '@/types/game';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type GamePhase = 'playing' | 'result' | 'complete';

export default function GameScreen() {
  const router = useRouter();
  const { puzzleId } = useLocalSearchParams<{ puzzleId: string }>();

  const {
    puzzle,
    currentRound,
    results,
    isComplete,
    totalScore,
    startGame,
    submitGuess,
    nextRound,
  } = useGameStore();

  const [phase, setPhase] = useState<GamePhase>('playing');
  const [currentGuess, setCurrentGuess] = useState<Coordinates | null>(null);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if puzzleId looks like a date (YYYY-MM-DD)
  const isDateBasedPuzzle = /^\d{4}-\d{2}-\d{2}$/.test(puzzleId || '');

  // Load puzzle on mount
  useEffect(() => {
    const loadPuzzle = async () => {
      // If puzzle is already loaded with matching ID (from play-modes), skip loading
      if (puzzle && puzzle.id === puzzleId) {
        setIsLoading(false);
        return;
      }

      // Only fetch from API for date-based puzzles
      if (isDateBasedPuzzle) {
        const dailyPuzzle = await generateDailyPuzzle(puzzleId);
        startGame(dailyPuzzle);
      }
      setIsLoading(false);
    };

    loadPuzzle();
  }, [puzzleId, puzzle?.id, isDateBasedPuzzle]);

  const handleLocationSelect = useCallback((coords: Coordinates) => {
    if (phase !== 'playing') return;
    setCurrentGuess(coords);
  }, [phase]);

  const handleConfirmGuess = useCallback(() => {
    if (!currentGuess || phase !== 'playing') return;

    const result = submitGuess(currentGuess);
    setCurrentResult(result);
    setPhase('result');
  }, [currentGuess, phase, submitGuess]);

  const handleNextRound = useCallback(() => {
    if (isComplete) {
      router.push('/game/results');
      return;
    }

    nextRound();
    setPhase('playing');
    setCurrentGuess(null);
    setCurrentResult(null);
  }, [isComplete, nextRound, router]);

  if (isLoading || !puzzle) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Loading puzzle...</Text>
      </View>
    );
  }

  const currentRoundData = puzzle.rounds[currentRound];

  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <RoundProgress
          totalRounds={puzzle.rounds.length}
          currentRound={currentRound}
          results={results}
        />
        <Text style={styles.scoreText}>Score: {totalScore}</Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <Globe
          onLocationSelect={handleLocationSelect}
          guessMarker={currentGuess}
          targetMarker={phase === 'result' ? currentResult?.target : null}
          showArc={phase === 'result'}
          disabled={phase !== 'playing'}
        />
      </View>

      {/* Clue card */}
      {phase === 'playing' && currentRoundData && (
        <View style={styles.clueContainer}>
          <ClueCard
            round={currentRoundData}
            roundNumber={currentRound + 1}
            totalRounds={puzzle.rounds.length}
          />

          {currentGuess && (
            <Pressable style={styles.confirmButton} onPress={handleConfirmGuess}>
              <Text style={styles.confirmButtonText}>Confirm Guess</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Score display */}
      {phase === 'result' && currentResult && currentRoundData && (
        <View style={styles.resultContainer}>
          {currentRoundData.category === 'questions' && currentRoundData.answer && (
            <View style={styles.answerReveal}>
              <Text style={styles.answerLabel}>The answer was:</Text>
              <Text style={styles.answerText}>{currentRoundData.answer}</Text>
              <Text style={styles.countryText}>{currentRoundData.country}</Text>
            </View>
          )}
          <ScoreDisplay result={currentResult} />
          <Pressable style={styles.nextButton} onPress={handleNextRound}>
            <Text style={styles.nextButtonText}>
              {isComplete ? 'See Results' : 'Next Round'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A202C',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A202C',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#1A202C',
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  clueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  confirmButton: {
    backgroundColor: '#4ECDC4',
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
  resultContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 32,
  },
  answerReveal: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
    width: '90%',
  },
  answerLabel: {
    color: '#A0AEC0',
    fontSize: 12,
    marginBottom: 4,
  },
  answerText: {
    color: '#4ECDC4',
    fontSize: 22,
    fontWeight: '700',
  },
  countryText: {
    color: '#718096',
    fontSize: 14,
    marginTop: 4,
  },
  nextButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  nextButtonText: {
    color: '#1A202C',
    fontSize: 18,
    fontWeight: '700',
  },
});
