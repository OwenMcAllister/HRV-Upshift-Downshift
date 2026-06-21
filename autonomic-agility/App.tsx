import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, SafeAreaView } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

// Services & Utils
import { StandardBLEDevice } from './src/services/StandardBLEDevice';
import { HeartRateData } from './src/types/deviceTypes';
import { AutonomicEngine } from './src/utils/AutonomicEngine'; 

// Components
import { DeviceScanner } from './src/components/DeviceScanner';
import { MetricsDashboard } from './src/components/MetricsDashboard';
import { ProtocolPanel } from './src/components/ProtocolPanel';
import { HRVChart } from './src/components/HRVChart';

const manager = new BleManager();

const PROTOCOL_PHASES = ['Baseline', 'Meditation', 'Puzzle Solving', 'Breathwork'];
const PHASE_DURATION_SEC = 30; // 5 mins

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [deviceConnected, setDeviceConnected] = useState<string | null>(null);
  
  const [currentBpm, setCurrentBpm] = useState<number>(0);
  const [latestRR, setLatestRR] = useState<number>(0);
  const [rmssd, setRmssd] = useState<number>(0);
  const [hrvHistory, setHrvHistory] = useState<{value: number}[]>([]);
  
  const [sessionActive, setSessionActive] = useState(false);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(PHASE_DURATION_SEC);
  const [sessionResults, setSessionResults] = useState<any>(null);

  const engineRef = useRef(new AutonomicEngine(30));
  const deviceRef = useRef<StandardBLEDevice | null>(null);
  const phaseDataRef = useRef<number[][]>([[], [], [], []]);
  
  const sessionActiveRef = useRef(sessionActive);
  const currentPhaseIndexRef = useRef(currentPhaseIndex);
  const timeRemainingRef = useRef(timeRemaining);

  useEffect(() => { sessionActiveRef.current = sessionActive; }, [sessionActive]);
  useEffect(() => { currentPhaseIndexRef.current = currentPhaseIndex; }, [currentPhaseIndex]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (sessionActive) {
      timer = setInterval(() => {
        if (timeRemainingRef.current > 0) {
          setTimeRemaining((prev) => prev - 1);
        } else {
          if (currentPhaseIndexRef.current < PROTOCOL_PHASES.length - 1) {
            setCurrentPhaseIndex((prev) => prev + 1);
            setTimeRemaining(PHASE_DURATION_SEC);
          } else {
            setSessionActive(false);
            calculateResults();
          }
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionActive]);

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
    
    const phaseAverages = data.map(phaseArr => getAvg(phaseArr.slice(-60)));
    const dynamicRange = Math.max(...phaseAverages) - Math.min(...phaseAverages);

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
      shiftTimes.push(stableIndex !== -1 ? stableIndex : PHASE_DURATION_SEC); 
    }

    setSessionResults({
      dynamicRange: dynamicRange.toFixed(1),
      averages: phaseAverages.map(a => a.toFixed(1)),
      shiftTimes: shiftTimes
    });
  };

  const startScan = () => {
    setIsScanning(true);
    setScannedDevices([]); 
    manager.startDeviceScan(['180d'], null, (error, device) => {
      if (error) return;
      if (device && device.name) {
        setScannedDevices(prev => prev.find(d => d.id === device.id) ? prev : [...prev, device]);
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
              
              // PERFORMANCE FIX: Cap the UI Graph to a rolling window of 100 points
              setHrvHistory(prev => {
                const newHistory = [...prev, { value: currentHrv }];
                if (newHistory.length > 100) return newHistory.slice(-100);
                return newHistory;
              });

              // The math arrays store everything for final calculations
              if (sessionActiveRef.current) {
                phaseDataRef.current[currentPhaseIndexRef.current].push(currentHrv);
              }
            }
          });
        }
      });
    } catch (err) {
      setDeviceConnected(null);
    }
  };

  const disconnect = async () => {
    if (deviceRef.current) {
      await deviceRef.current.disconnect();
      deviceRef.current = null;
      setDeviceConnected(null);
      setCurrentBpm(0); setLatestRR(0); setRmssd(0); setHrvHistory([]);
      setSessionActive(false); setSessionResults(null);
      engineRef.current.reset();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Agility</Text>
        <Text style={styles.status}>
          {deviceConnected ? `Connected to: ${deviceConnected}` : isScanning ? 'Scanning...' : 'Disconnected'}
        </Text>
      </View>

      {!deviceConnected ? (
        <DeviceScanner 
          isScanning={isScanning} 
          devices={scannedDevices} 
          onStartScan={startScan} 
          onConnect={connectToDevice} 
        />
      ) : (
        <View style={{ flex: 1 }}>
          <MetricsDashboard bpm={currentBpm} latestRR={latestRR} />
          
          <ProtocolPanel 
            sessionActive={sessionActive}
            sessionResults={sessionResults}
            currentPhaseIndex={currentPhaseIndex}
            phaseName={PROTOCOL_PHASES[currentPhaseIndex]}
            timeRemaining={timeRemaining}
            onStart={startProtocol}
          />
          
          <HRVChart rmssd={rmssd} history={hrvHistory} />

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
  controls: { marginTop: 'auto', marginBottom: 20 }
});