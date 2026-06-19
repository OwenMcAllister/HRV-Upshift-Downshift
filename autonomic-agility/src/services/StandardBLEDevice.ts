import {Device, BleManager} from 'react-native-ble-plx';
import {decode} from 'base-64';
import {IHeartRateDevice, HeartRateData} from '../types/deviceTypes';

const HR_SERVICE_UUID = '180d';
const HR_MEASUREMENT_CHARACTERISTIC = '2a37';

export class StandardBLEDevice implements IHeartRateDevice {
    public id: string;
    public name: string | null;
    private device: Device;
    private bleManager: BleManager;

    constructor(device: Device, bleManager: BleManager) {
        this.id = device.id;
        this.name = device.name;
        this.device = device;
        this.bleManager = bleManager;
    }

    async connect(): Promise<void> {
        const isConnected = await this.device.isConnected();
        if (!isConnected) {
            await this.device.connect();
        }
        await this.device.discoverAllServicesAndCharacteristics();
    }

    async disconnect(): Promise<void> {
        await this.device.cancelConnection();
    }

    startStreaming(onDataReceived: (data: HeartRateData) => void): void {
        this.device.monitorCharacteristicForService(
            HR_SERVICE_UUID,
            HR_MEASUREMENT_CHARACTERISTIC,
            (error, characteristic) => {
                if (error || !characteristic?.value) {
                    console.error('Error monitoring characteristic:', error);
                    return;
                }

                const data = this.parseHeartRatePayload(characteristic.value);
                if (data) onDataReceived(data);
            }
        );
    }

    stopStreaming(): void {
        this.bleManager.cancelTransaction(HR_MEASUREMENT_CHARACTERISTIC);
    }

    private parseHeartRatePayload(base64Str: string): HeartRateData | null {
        const binaryStr = decode(base64Str);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        
        if (bytes.length === 0) {
            return null;
        }
        // Process the bytes to extract heart rate data
        const flags = bytes[0];
        const is16BitBpm = (flags & 0x01) !== 0;
        const hasRRIntervals = (flags & 0x10) !== 0;

        let offset = 1;
        let bpm = 0;

        if (is16BitBpm) {
            bpm = bytes[offset] | (bytes[offset + 1] << 8);
            offset += 2;
        } else {
            bpm = bytes[offset];
            offset += 1;
        }

        // Energy Expanded flag (skip if present to get to RR intervals)
        if ((flags & 0x08) !== 0) {
            offset += 2;
        }

        // Parse RR intervals
        const rrIntervals: number[] = [];
        if (hasRRIntervals) {
            while (offset < bytes.length) {
                const rrRaw = bytes[offset] | (bytes[offset + 1] << 8);
                const rrMs = (rrRaw * 1000) / 1024;
                rrIntervals.push(Math.round(rrMs));
                offset += 2;;
            }
        }

        return {
            bpm,
            rrIntervals,
            timestamp: Date.now(),
        };
    }
}