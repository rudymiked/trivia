import { useAuth } from '@/hooks/useAuth';
import { fetchAllTimeLeaderboard, fetchLeaderboard } from '@/services/api';
import { getTodayDate } from '@/services/puzzle';
import { LeaderboardEntry } from '@/types/game';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

interface LeaderboardEntryWithUser extends LeaderboardEntry {
  isCurrentUser?: boolean;
}

type LeaderboardTab = 'today' | 'alltime';

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('today');

  const loadLeaderboard = async (tab: LeaderboardTab) => {
    setIsLoading(true);
    setError(null);

    try {
      let data;
      let apiError;

      if (tab === 'today') {
        const today = getTodayDate();
        const result = await fetchLeaderboard(today, 50);
        data = result.data;
        apiError = result.error;
      } else {
        const result = await fetchAllTimeLeaderboard(50);
        data = result.data;
        apiError = result.error;
      }

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab: LeaderboardTab) => {
    setActiveTab(tab);
  };

  // Reload whenever the tab gains focus (navigating back after a game) or when the
  // active sub-tab / user changes. useFocusEffect fires on mount, focus, AND when
  // deps change while the screen is focused, so it handles all three cases.
  useFocusEffect(
    useCallback(() => {
      loadLeaderboard(activeTab);
    }, [user?.id, activeTab])
  );

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

  const handleCheckConnection = () => {
    Alert.alert(
      'Check Connection',
      'Make sure you are online and then tap Retry to reload the leaderboard.'
    );
  };

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.recoveryCard}>
          <Text style={styles.recoveryTitle}>Leaderboard unavailable</Text>
          <Text style={styles.recoveryBody}>{error}</Text>
          <View style={styles.recoveryActionsRow}>
            <Pressable style={styles.primaryRecoveryButton} onPress={() => loadLeaderboard(activeTab)}>
              <Text style={styles.primaryRecoveryButtonText}>Retry</Text>
            </Pressable>
            <Pressable style={styles.secondaryRecoveryButton} onPress={handleCheckConnection}>
              <Text style={styles.secondaryRecoveryButtonText}>Check connection</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const titleText = activeTab === 'today' ? "Today's Leaderboard" : 'All Time Leaderboard';
  const subtitleText = activeTab === 'today' 
    ? new Date(getTodayDate()).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'All time high scores';
  const emptyText = activeTab === 'today'
    ? 'No scores yet today'
    : 'No scores recorded';
  const emptySubtext = activeTab === 'today'
    ? 'Be the first to play!'
    : 'Play your first game to appear!';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.date}>{subtitleText}</Text>
      </View>

      {/* Tab buttons */}
      <View style={styles.tabs}>
        <Pressable 
          style={[styles.tab, activeTab === 'today' && styles.activeTab]}
          onPress={() => handleTabChange('today')}
        >
          <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
            Today
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'alltime' && styles.activeTab]}
          onPress={() => handleTabChange('alltime')}
        >
          <Text style={[styles.tabText, activeTab === 'alltime' && styles.activeTabText]}>
            All Time
          </Text>
        </Pressable>
      </View>

      <View style={styles.tableHeader}>
        <Text style={styles.headerRank}>#</Text>
        <Text style={styles.headerName}>Player</Text>
        <Text style={styles.headerScore}>Score</Text>
      </View>

      {leaderboard.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyText}</Text>
          <Text style={styles.emptySubtext}>{emptySubtext}</Text>
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
  recoveryCard: {
    width: '88%',
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 101, 101, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 101, 101, 0.4)',
  },
  recoveryTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  recoveryBody: {
    color: '#FEB2B2',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  recoveryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryRecoveryButton: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryRecoveryButtonText: {
    color: '#1A202C',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryRecoveryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  secondaryRecoveryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
    backgroundColor: '#0F1419',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4ECDC4',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
  },
  activeTabText: {
    color: '#4ECDC4',
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
