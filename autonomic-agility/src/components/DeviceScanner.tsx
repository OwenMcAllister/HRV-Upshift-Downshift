import React from 'react';
import { View, Button, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Device } from 'react-native-ble-plx';

interface Props {
  isScanning: boolean;
  devices: Device[];
  onStartScan: () => void;
  onConnect: (device: Device) => void;
}

export const DeviceScanner: React.FC<Props> = ({ isScanning, devices, onStartScan, onConnect }) => {
  return (
    <View style={{ flex: 1 }}>
      <Button title={isScanning ? "Scanning..." : "Scan for Devices"} onPress={onStartScan} disabled={isScanning} />
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.deviceItem} onPress={() => onConnect(item)}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceId}>{item.id}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  deviceItem: { backgroundColor: '#1e293b', padding: 16, borderRadius: 8, marginVertical: 8 },
  deviceName: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold' },
  deviceId: { color: '#64748b', fontSize: 12 },
});