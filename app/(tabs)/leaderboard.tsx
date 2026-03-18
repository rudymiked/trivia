import { useAuth } from '@/hooks/useAuth';
import { fetchLeaderboard } from '@/services/api';
import { getTodayDate } from '@/services/puzzle';
import { LeaderboardEntry } from '@/types/game';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

interface LeaderboardEntryWithUser extends LeaderboardEntry {
  isCurrentUser?: boolean;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError(null);

    const today = getTodayDate();
    const { data, error: apiError } = await fetchLeaderboard(today, 50);

    if (apiError) {
      setError(apiError);
      setIsLoading(false);
      return;
    }

    if (data) {
      // Mark the current user's entry
      const entries = data.leaderboard.map((entry) => ({
        ...entry,
        isCurrentUser: user?.id === entry.userId,
      }));
      setLeaderboard(entries);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadLeaderboard();
  }, [user?.id]);

  const renderItem = ({ item }: { item: LeaderboardEntryWithUser }) => (
    <View
      style={[
        styles.row,
        item.rank <= 3 && styles.topThreeRow,
        item.isCurrentUser && styles.currentUserRow,
      ]}
    >
      <View style={styles.rankContainer}>
        {item.rank === 1 && <Text style={styles.medal}>🥇</Text>}
        {item.rank === 2 && <Text style={styles.medal}>🥈</Text>}
        {item.rank === 3 && <Text style={styles.medal}>🥉</Text>}
        {item.rank > 3 && <Text style={styles.rank}>{item.rank}</Text>}
      </View>
      <Text style={[styles.name, item.isCurrentUser && styles.currentUserName]}>
        {item.displayName}
      </Text>
      <Text style={styles.score}>{item.score}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load leaderboard</Text>
        <Pressable style={styles.retryButton} onPress={loadLeaderboard}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Leaderboard</Text>
        <Text style={styles.date}>
          {new Date(getTodayDate()).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.tableHeader}>
        <Text style={styles.headerRank}>#</Text>
        <Text style={styles.headerName}>Player</Text>
        <Text style={styles.headerScore}>Score</Text>
      </View>

      {leaderboard.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No scores yet today</Text>
          <Text style={styles.emptySubtext}>Be the first to play!</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {user ? `Playing as ${user.name}` : 'Sign in to appear on the leaderboard'}
        </Text>
      </View>
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
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#1A202C',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#718096',
    fontSize: 14,
    marginTop: 8,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  date: {
    color: '#718096',
    fontSize: 14,
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2D3748',
  },
  headerRank: {
    width: 50,
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerName: {
    flex: 1,
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerScore: {
    width: 60,
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  list: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  topThreeRow: {
    backgroundColor: 'rgba(78, 205, 196, 0.05)',
  },
  currentUserRow: {
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
  },
  rankContainer: {
    width: 50,
    alignItems: 'flex-start',
  },
  rank: {
    color: '#718096',
    fontSize: 16,
    fontWeight: '600',
  },
  medal: {
    fontSize: 24,
  },
  name: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  currentUserName: {
    fontWeight: '700',
    color: '#4ECDC4',
  },
  score: {
    width: 60,
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
  },
  footerText: {
    color: '#718096',
    fontSize: 14,
  },
});
