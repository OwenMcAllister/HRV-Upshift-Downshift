export interface HeartRateData {
    bpm: number;
    rrIntervals: number[]; // In milliseconds
    timestamp: number;
}

export interface IHeartRateDevice {
    id: string;
    name: string | null;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    startStreaming(onDataReceived: (data: HeartRateData) => void): void;
    stopStreaming(): void;
}