import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

const screenWidth = Dimensions.get('window').width;

interface Props {
  rmssd: number;
  history: { value: number }[];
  isSummary?: boolean;
}

export const HRVChart: React.FC<Props> = React.memo(({ rmssd, history, isSummary }) => {

  const chartSpacing = isSummary
    ? Math.max(2,(screenWidth - 80) / Math.max(1, history.length - 1))
    : 15;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Autonomic Tone (RMSSD)</Text>
        <Text style={styles.chartHeroValue}>{rmssd.toFixed(1)} <Text style={styles.chartUnit}>ms</Text></Text>
      </View>
      
      {history.length > 5 ? (
        <LineChart
          areaChart
          data={history}
          width={screenWidth - 80}
          height={180}
          spacing={chartSpacing}
          initialSpacing={0}
          color="#38bdf8"
          thickness={isSummary ? 2 : 3}
          startFillColor="rgba(56, 189, 248, 0.4)"
          endFillColor="rgba(56, 189, 248, 0.02)"
          startOpacity={0.9}
          endOpacity={0.2}
          hideRules
          hideDataPoints
          curved
          noOfSections={4}
        />
      ) : (
        <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#64748b', fontStyle: 'italic' }}>Establishing autonomic baseline...</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  chartContainer: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, overflow: 'hidden' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  chartTitle: { color: '#94a3b8', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6 },
  chartHeroValue: { color: '#38bdf8', fontSize: 36, fontWeight: 'bold' },
  chartUnit: { fontSize: 16, color: '#64748b' },
});