import { getTodayDate } from '@/services/puzzle';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  isCurrentUser?: boolean;
}

// Mock leaderboard data - will be replaced with Azure backend
const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, displayName: 'GeoMaster', score: 485 },
  { rank: 2, displayName: 'WorldExplorer', score: 472 },
  { rank: 3, displayName: 'MapPro', score: 468 },
  { rank: 4, displayName: 'TravelGuru', score: 455 },
  { rank: 5, displayName: 'Navigator', score: 442 },
  { rank: 6, displayName: 'GlobeTrotter', score: 438 },
  { rank: 7, displayName: 'AtlasFan', score: 425 },
  { rank: 8, displayName: 'Cartographer', score: 412 },
  { rank: 9, displayName: 'Wanderer', score: 398 },
  { rank: 10, displayName: 'PathFinder', score: 385 },
];

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call - will be replaced with Azure backend
    const loadLeaderboard = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLeaderboard(mockLeaderboard);
      setIsLoading(false);
    };

    loadLeaderboard();
  }, []);

  const renderItem = ({ item }: { item: LeaderboardEntry }) => (
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

      <FlatList
        data={leaderboard}
        keyExtractor={(item) => String(item.rank)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Sign in to appear on the leaderboard
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
