import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  sessionActive: boolean;
  sessionResults: any;
  currentPhaseIndex: number;
  phaseName: string;
  timeRemaining: number;
  onStart: () => void;
}

export const ProtocolPanel: React.FC<Props> = ({ 
  sessionActive, sessionResults, currentPhaseIndex, phaseName, timeRemaining, onStart 
}) => {
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={styles.protocolCard}>
      {!sessionActive && !sessionResults ? (
        <View style={{ width: '100%' }}>
          <Text style={styles.resultsTitle}>Performance Diagnostic</Text>
          <Text style={styles.resultSubTitle}>Complete the 4-stage protocol to measure your autonomic dynamic range and shift times.</Text>
          
          <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
            <Text style={styles.primaryButtonText}>Start Protocol</Text>
          </TouchableOpacity>
        </View>
      ) : sessionActive ? (
        <View style={styles.activeSession}>
          <Text style={styles.phaseTitle}>Phase {currentPhaseIndex + 1}/4: {phaseName}</Text>
          <Text style={styles.timer}>{formatTime(timeRemaining)}</Text>
        </View>
      ) : (
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Protocol Complete</Text>
          
          <View style={styles.heroBox}>
            <Text style={styles.heroLabel}>Dynamic Range</Text>
            <Text style={styles.resultHero}>{sessionResults.dynamicRange} <Text style={styles.unitText}>ms</Text></Text>
          </View>
          
          <View style={styles.breakdownContainer}>
            <Text style={styles.breakdownTitle}>Phase Analysis</Text>

            <View style={styles.phaseRow}>
              <View style={styles.phaseNameCol}>
                <Text style={styles.phaseLabel}>1. Baseline</Text>
              </View>
              <View style={styles.phaseStatsCol}>
                <Text style={styles.phaseStat}>Avg: <Text style={styles.phaseValue}>{sessionResults.averages[0]} ms</Text></Text>
                <Text style={styles.phaseStatEmpty}>Shift: --</Text>
              </View>
            </View>

            <View style={styles.phaseRow}>
              <View style={styles.phaseNameCol}>
                <Text style={styles.phaseLabel}>2. Meditation</Text>
              </View>
              <View style={styles.phaseStatsCol}>
                <Text style={styles.phaseStat}>Avg: <Text style={styles.phaseValue}>{sessionResults.averages[1]} ms</Text></Text>
                <Text style={styles.phaseStat}>Shift: <Text style={styles.phaseValue}>{sessionResults.shiftTimes[1]} s</Text></Text>
              </View>
            </View>

            <View style={styles.phaseRow}>
              <View style={styles.phaseNameCol}>
                <Text style={styles.phaseLabel}>3. Puzzle</Text>
              </View>
              <View style={styles.phaseStatsCol}>
                <Text style={styles.phaseStat}>Avg: <Text style={styles.phaseValue}>{sessionResults.averages[2]} ms</Text></Text>
                <Text style={styles.phaseStat}>Shift: <Text style={styles.phaseValue}>{sessionResults.shiftTimes[2]} s</Text></Text>
              </View>
            </View>

            <View style={[styles.phaseRow, { borderBottomWidth: 0 }]}>
              <View style={styles.phaseNameCol}>
                <Text style={styles.phaseLabel}>4. Breathwork</Text>
              </View>
              <View style={styles.phaseStatsCol}>
                <Text style={styles.phaseStat}>Avg: <Text style={styles.phaseValue}>{sessionResults.averages[3]} ms</Text></Text>
                <Text style={styles.phaseStat}>Shift: <Text style={styles.phaseValue}>{sessionResults.shiftTimes[3]} s</Text></Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={onStart}>
            <Text style={styles.secondaryButtonText}>Restart Protocol</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  protocolCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, marginBottom: 16, alignItems: 'center', width: '100%' },
  activeSession: { alignItems: 'center', width: '100%' },
  phaseTitle: { color: '#38bdf8', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  timer: { color: '#f8fafc', fontSize: 56, fontWeight: 'bold', fontVariant: ['tabular-nums'], letterSpacing: 2 },
  
  // Results Container
  resultsCard: { width: '100%' },
  resultsTitle: { color: '#f8fafc', fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  resultSubTitle: { color: '#94a3b8', fontSize: 14, marginBottom: 20, textAlign: 'center', lineHeight: 20 },
  
  // Hero Metric (Dynamic Range)
  heroBox: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  heroLabel: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  resultHero: { color: '#38bdf8', fontSize: 32, fontWeight: 'bold' },
  unitText: { fontSize: 16, color: '#64748b', fontWeight: 'normal' },

  // Detailed Grid
  breakdownContainer: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 20 },
  breakdownTitle: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  phaseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  phaseNameCol: { flex: 1, justifyContent: 'center' },
  phaseLabel: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
  
  phaseStatsCol: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  phaseStat: { color: '#94a3b8', fontSize: 13, marginBottom: 2 },
  phaseStatEmpty: { color: '#475569', fontSize: 13, marginBottom: 2 },
  phaseValue: { color: '#f8fafc', fontWeight: 'bold' },

  // Custom Buttons
  primaryButton: { backgroundColor: '#38bdf8', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  
  secondaryButton: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#38bdf8', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  secondaryButtonText: { color: '#38bdf8', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
});