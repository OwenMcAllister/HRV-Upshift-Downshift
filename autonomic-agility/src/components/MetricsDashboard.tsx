import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  bpm: number;
  latestRR: number;
}

export const MetricsDashboard: React.FC<Props> = React.memo(({ bpm, latestRR }) => {
  return (
    <View style={styles.dashboard}>
      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Heart Rate</Text>
          <Text style={styles.metricValue}>{bpm} <Text style={styles.unit}>bpm</Text></Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>RR-Interval</Text>
          <Text style={styles.metricValue}>{latestRR} <Text style={styles.unit}>ms</Text></Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dashboard: { gap: 16, marginBottom: 16 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  metricCard: { flex: 1, backgroundColor: '#1e293b', padding: 16, borderRadius: 16, alignItems: 'flex-start' },
  metricLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  metricValue: { color: '#f8fafc', fontSize: 28, fontWeight: 'bold' },
  unit: { fontSize: 14, color: '#64748b' },
});