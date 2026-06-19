import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, FlatList, SafeAreaView, TouchableOpacity, Dimensions } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { LineChart } from 'react-native-gifted-charts';
import { StandardBLEDevice } from './src/services/StandardBLEDevice';
import { HeartRateData } from './src/types/deviceTypes';
import { AutonomicEngine } from './src/utils/AutonomicEngine'; 

const manager = new BleManager();
const screenWidth = Dimensions.get('window').width;

const PROTOCOL_PHASES = ['Baseline', 'Meditation', 'Puzzle Solving', 'Breathwork'];
const PHASE_DURATION_SEC = 300; // 5 minutes per phase (Change to 30 for quick testing)

export default function App() {
  // --- BLE State ---
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [deviceConnected, setDeviceConnected] = useState<string | null>(null);
  
  // --- Real-time Metrics ---
  const [currentBpm, setCurrentBpm] = useState<number>(0);
  const [latestRR, setLatestRR] = useState<number>(0);
  const [rmssd, setRmssd] = useState<number>(0);
  const [hrvHistory, setHrvHistory] = useState<{value: number}[]>([]);
  
  // --- Protocol State ---
  const [sessionActive, setSessionActive] = useState(false);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(PHASE_DURATION_SEC);
  const [sessionResults, setSessionResults] = useState<any>(null);

  // --- Engine & Data Refs ---
  const engineRef = useRef(new AutonomicEngine(30));
  const deviceRef = useRef<StandardBLEDevice | null>(null);
  const phaseDataRef = useRef<number[][]>([[], [], [], []]);
  
  // CRITICAL: Refs to keep BLE callbacks perfectly synced with React State
  const sessionActiveRef = useRef(sessionActive);
  const currentPhaseIndexRef = useRef(currentPhaseIndex);

  // Keep refs updated
  useEffect(() => { sessionActiveRef.current = sessionActive; }, [sessionActive]);
  useEffect(() => { currentPhaseIndexRef.current = currentPhaseIndex; }, [currentPhaseIndex]);

  // --- Master Protocol Clock ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sessionActive && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (sessionActive && timeRemaining === 0) {
      if (currentPhaseIndex < PROTOCOL_PHASES.length - 1) {
        // Shift to next phase
        setCurrentPhaseIndex((prev) => prev + 1);
        setTimeRemaining(PHASE_DURATION_SEC);
      } else {
        // End of Protocol
        setSessionActive(false);
        calculateResults();
      }
    }
    return () => clearInterval(timer);
  }, [sessionActive, timeRemaining, currentPhaseIndex]);

  const startProtocol = () => {
    phaseDataRef.current = [[], [], [], []];
    setCurrentPhaseIndex(0);
    setTimeRemaining(PHASE_DURATION_SEC);
    setSessionResults(null);
    setSessionActive(true);
  };

  const calculateResults = () => {
    const data = phaseDataRef.current;
    const getAvg = (arr: number[]) => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0;
    
    // 1. Calculate settled Baseline per phase (average of the last 60 beats recorded)
    const phaseAverages = data.map(phaseArr => {
      const settledData = phaseArr.slice(-60); 
      return getAvg(settledData);
    });

    // 2. Dynamic Range
    const maxHrv = Math.max(...phaseAverages);
    const minHrv = Math.min(...phaseAverages);
    const dynamicRange = maxHrv - minHrv;

    // 3. Shift Times (Calculates how fast they hit 85% of the delta to the new target)
    const shiftTimes = [0]; 
    for(let i = 1; i < 4; i++) {
      const prevAvg = phaseAverages[i-1];
      const targetAvg = phaseAverages[i];
      const currentPhaseStream = data[i];
      
      let stableIndex = -1;
      const targetThreshold = prevAvg + ((targetAvg - prevAvg) * 0.85); 
      
      for(let beat = 0; beat < currentPhaseStream.length; beat++) {
        const isUpShift = targetAvg > prevAvg;
        if (isUpShift && currentPhaseStream[beat] >= targetThreshold) { stableIndex = beat; break; }
        if (!isUpShift && currentPhaseStream[beat] <= targetThreshold) { stableIndex = beat; break; }
      }
      // Rough conversion: 1 beat ≈ 1 second of transition time
      shiftTimes.push(stableIndex !== -1 ? stableIndex : PHASE_DURATION_SEC); 
    }

    setSessionResults({
      dynamicRange: dynamicRange.toFixed(1),
      averages: phaseAverages.map(a => a.toFixed(1)),
      shiftTimes: shiftTimes
    });
  };

  // --- Bluetooth Logic ---
  const startScan = () => {
    setIsScanning(true);
    setScannedDevices([]); 
    
    manager.startDeviceScan(['180d'], null, (error, device) => {
      if (error) { console.warn(error); return; }
      if (device && device.name) {
        setScannedDevices(prev => {
          if (!prev.find(d => d.id === device.id)) return [...prev, device];
          return prev;
        });
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  const connectToDevice = async (device: Device) => {
    manager.stopDeviceScan();
    setIsScanning(false);
    setDeviceConnected(device.name || device.id);

    try {
      const standardDevice = new StandardBLEDevice(device, manager);
      await standardDevice.connect();
      deviceRef.current = standardDevice;

      standardDevice.startStreaming((data: HeartRateData) => {
        setCurrentBpm(data.bpm);
        
        if (data.rrIntervals.length > 0) {
          const newestRR = data.rrIntervals[data.rrIntervals.length - 1];
          setLatestRR(newestRR);

          data.rrIntervals.forEach(rr => {
            const currentHrv = engineRef.current.addBeat(rr);
            if (currentHrv !== null) {
              setRmssd(currentHrv);
              
              // 1. Send data to the UI Graph
              setHrvHistory(prev => {
                const newHistory = [...prev, { value: currentHrv }];
                if (newHistory.length > 2000) return newHistory.slice(-2000);
                return newHistory;
              });

              // 2. If protocol is running, route data into the correct math bucket
              if (sessionActiveRef.current) {
                phaseDataRef.current[currentPhaseIndexRef.current].push(currentHrv);
              }
            }
          });
        }
      });
    } catch (err) {
      console.error("Connection failed", err);
      setDeviceConnected(null);
    }
  };

  const disconnect = async () => {
    if (deviceRef.current) {
      await deviceRef.current.disconnect();
      deviceRef.current = null;
      setDeviceConnected(null);
      setCurrentBpm(0);
      setLatestRR(0);
      setRmssd(0);
      setHrvHistory([]);
      setSessionActive(false);
      setSessionResults(null);
      engineRef.current.reset();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Autonomic Agility</Text>
        <Text style={styles.status}>
          {deviceConnected ? `Connected to: ${deviceConnected}` : isScanning ? 'Scanning...' : 'Disconnected'}
        </Text>
      </View>

      {!deviceConnected ? (
        <View style={{ flex: 1 }}>
          <Button title={isScanning ? "Scanning..." : "Scan for Devices"} onPress={startScan} disabled={isScanning} />
          <FlatList
            data={scannedDevices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.deviceItem} onPress={() => connectToDevice(item)}>
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceId}>{item.id}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          
          {/* Top Metrics Row */}
          <View style={styles.dashboard}>
            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Heart Rate</Text>
                <Text style={styles.metricValue}>{currentBpm} <Text style={styles.unit}>bpm</Text></Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>RR-Interval</Text>
                <Text style={styles.metricValue}>{latestRR} <Text style={styles.unit}>ms</Text></Text>
              </View>
            </View>
          </View>

          {/* Session Controller Panel */}
          <View style={styles.protocolCard}>
            {!sessionActive && !sessionResults ? (
              <View style={{ width: '100%' }}>
                <Text style={styles.resultsTitle}>Performance Diagnostic</Text>
                <Text style={styles.resultSubTitle}>Complete the 4-stage protocol to measure your autonomic dynamic range and shift times.</Text>
                <Button title="Start Protocol" onPress={startProtocol} color="#38bdf8" />
              </View>
            ) : sessionActive ? (
              <View style={styles.activeSession}>
                <Text style={styles.phaseTitle}>Phase {currentPhaseIndex + 1}/4: {PROTOCOL_PHASES[currentPhaseIndex]}</Text>
                <Text style={styles.timer}>{formatTime(timeRemaining)}</Text>
              </View>
            ) : (
              <View style={styles.resultsCard}>
                <Text style={styles.resultsTitle}>Protocol Complete</Text>
                <Text style={styles.resultHero}>Dynamic Range: {sessionResults.dynamicRange} ms</Text>
                
                <Text style={styles.resultSubTitle}>Shift Times:</Text>
                <Text style={styles.resultMetric}>Meditate (Parasympathetic): {sessionResults.shiftTimes[1]} sec</Text>
                <Text style={styles.resultMetric}>Puzzle (Sympathetic): {sessionResults.shiftTimes[2]} sec</Text>
                <Text style={styles.resultMetric}>Breathwork (Parasympathetic): {sessionResults.shiftTimes[3]} sec</Text>
                
                <View style={{ marginTop: 15 }}>
                  <Button title="Restart Protocol" onPress={startProtocol} />
                </View>
              </View>
            )}
          </View>

          {/* Real-Time HRV Chart (Bulletproof Configuration) */}
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Autonomic Tone (RMSSD)</Text>
              <Text style={styles.chartHeroValue}>{rmssd.toFixed(1)} <Text style={styles.chartUnit}>ms</Text></Text>
            </View>
            
            {hrvHistory.length > 5 ? (
              <LineChart
                areaChart
                data={hrvHistory}
                width={screenWidth - 80}
                height={180}
                spacing={15}
                initialSpacing={0}
                color="#38bdf8"
                thickness={3}
                startFillColor="rgba(56, 189, 248, 0.4)"
                endFillColor="rgba(56, 189, 248, 0.02)"
                startOpacity={0.9}
                endOpacity={0.2}
                hideRules
                hideDataPoints
                curved
                noOfSections={4}
                animateOnDataChange={true}
                animationDuration={300}
              />
            ) : (
              <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#64748b', fontStyle: 'italic' }}>Establishing autonomic baseline...</Text>
              </View>
            )}
          </View>

          <View style={styles.controls}>
            <Button title="Disconnect" onPress={disconnect} color="#ef4444" />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  header: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  title: { fontSize: 28, color: '#f8fafc', fontWeight: 'bold' },
  status: { fontSize: 16, color: '#94a3b8', marginTop: 8 },
  deviceItem: { backgroundColor: '#1e293b', padding: 16, borderRadius: 8, marginVertical: 8 },
  deviceName: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold' },
  deviceId: { color: '#64748b', fontSize: 12 },
  
  // Dashboard Metrics
  dashboard: { gap: 16, marginBottom: 16 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  metricCard: { flex: 1, backgroundColor: '#1e293b', padding: 16, borderRadius: 16, alignItems: 'flex-start' },
  metricLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  metricValue: { color: '#f8fafc', fontSize: 28, fontWeight: 'bold' },
  unit: { fontSize: 14, color: '#64748b' },
  
  // Protocol / Diagnostics Panel
  protocolCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, marginBottom: 16, alignItems: 'center', width: '100%' },
  activeSession: { alignItems: 'center', width: '100%' },
  phaseTitle: { color: '#38bdf8', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  timer: { color: '#f8fafc', fontSize: 48, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  resultsCard: { width: '100%' },
  resultsTitle: { color: '#f8fafc', fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  resultHero: { color: '#38bdf8', fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  resultSubTitle: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
  resultMetric: { color: '#f8fafc', fontSize: 16, marginBottom: 6 },
  
  // Chart Styles
  chartContainer: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, overflow: 'hidden' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  chartTitle: { color: '#94a3b8', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6 },
  chartHeroValue: { color: '#38bdf8', fontSize: 36, fontWeight: 'bold' },
  chartUnit: { fontSize: 16, color: '#64748b' },
  
  controls: { marginTop: 'auto', marginBottom: 20 }
});