import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const LAST_UPDATED = 'March 25, 2026';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Terms of Use</Text>
      <Text style={styles.updatedAt}>Last updated: {LAST_UPDATED}</Text>

      <Section title="Acceptance of Terms">
        By using Trivia Globe, you agree to these terms. If you do not agree, do not use the app.
      </Section>

      <Section title="Use of the Service">
        You agree to use the app lawfully and not attempt to interfere with gameplay systems, authentication, or service availability.
      </Section>

      <Section title="Accounts">
        You are responsible for activity performed using your account and for keeping your sign-in methods secure.
      </Section>

      <Section title="Content and Gameplay">
        Game content is provided for personal, non-commercial use. We may update, remove, or adjust puzzles, scoring, and features at any time.
      </Section>

      <Section title="Intellectual Property">
        The app, branding, code, and curated content are owned by Trivia Globe and its licensors, unless otherwise stated.
      </Section>

      <Section title="Disclaimers">
        The service is provided on an as-is basis without warranties of any kind, to the extent permitted by law.
      </Section>

      <Section title="Limitation of Liability">
        To the extent permitted by law, Trivia Globe is not liable for indirect, incidental, or consequential damages resulting from use of the app.
      </Section>

      <Section title="Changes to Terms">
        We may update these terms from time to time. Continued use after updates means you accept the revised terms.
      </Section>

      <Section title="Contact">
        For legal questions, contact: legal@triviaglobe.example
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
