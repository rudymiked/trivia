import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const LAST_UPDATED = 'March 25, 2026';

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updatedAt}>Last updated: {LAST_UPDATED}</Text>

      <Section title="Overview">
        Trivia Globe collects only the information needed to run the game, save your progress, and improve reliability.
      </Section>

      <Section title="Data We Collect">
        We may collect account profile information from your sign-in provider (for example name, email address, and profile photo), gameplay data (scores, streaks, progress), and technical telemetry (for example error logs and performance metrics).
      </Section>

      <Section title="How We Use Data">
        We use this data to authenticate users, sync game progress across sessions, show leaderboards and profile stats, troubleshoot issues, and improve product quality.
      </Section>

      <Section title="Data Sharing">
        We do not sell personal data. We may share data with service providers that help us host the app, run authentication, and monitor reliability.
      </Section>

      <Section title="Data Retention">
        We keep data for as long as your account remains active or as needed to provide the service, resolve disputes, and comply with legal obligations.
      </Section>

      <Section title="Your Choices">
        You may stop using the app at any time. You can also contact us to request account-related data actions, subject to applicable law.
      </Section>

      <Section title="Children's Privacy">
        This app is not directed to children under 13. If you believe a child provided personal data, contact us so we can review and remove it when required.
      </Section>

      <Section title="Contact">
        For privacy questions, contact: privacy@triviaglobe.example
      </Section>
    </ScrollView>
  );
}

type SectionProps = {
  title: string;
  children: string;
};

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A202C',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  updatedAt: {
    color: '#A0AEC0',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 20,
  },
  section: {
    marginBottom: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionBody: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
});
