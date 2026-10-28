export interface EquipmentInfo {
  id: string;
  name: string;
  type: string;
  location?: string;
  targetUrl: string;
}

export interface ScanResult {
  id: string;
  serialNumber: string;
  timestamp: string;
  targetUrl?: string;
  textData?: string;
  rawRecords: Array<{
    recordType: string;
    mediaType?: string;
    data: string;
  }>;
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: unknown;
}

export interface NFCSupportStatus {
  isSupported: boolean;
  isSecureContext: boolean;
  reason?: string;
}
