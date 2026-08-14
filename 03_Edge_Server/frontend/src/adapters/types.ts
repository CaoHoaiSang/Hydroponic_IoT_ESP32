export type SystemCapabilities = {
  buildProfile: string | null;
  actuatorsLocked: boolean;
  pumpCommandsEnabled: boolean;
  pumpMainCanSet: boolean;
  nutrientPumpCanPulse: boolean;
  autoDosingCanEnable: boolean;
  autoDosingLockReason: string;
};

export type GatewayHealth = {
  connected: boolean;
  mongoConnected: boolean;
  mqttConnected: boolean;
  databaseLabel: string;
  databaseEngine: string | null;
  firmwareVersion: string | null;
  backendVersion: string | null;
  buildProfile: string | null;
};

export type DeviceSnapshot = {
  deviceId: string;
  connected: boolean;
  measurementAt: string | null;
  tdsRaw: number | null;
  tdsVoltage: number | null;
  tdsPpm: number | null;
  ecUsCm: number | null;
  tdsWindowStable: boolean;
  tdsCalibrationSetId: string | null;
  tdsCalibrationWarning: string | null;
  tdsControlInvalidReasons: string[];
  waterTemp: number | null;
  waterLevel: "normal" | "low" | "error" | null;
  pumpMain: boolean;
  tdsControlValid: boolean;
};

export type SensorLogRow = {
  id: string;
  measurementAt: string | null;
  tdsPpm: number | null;
  ecUsCm: number | null;
  waterTemp: number | null;
  waterLevel: "normal" | "low" | "error" | null;
  pumpMain: boolean;
  tdsControlValid: boolean;
};

export type CalibrationPointInput = {
  measuredRaw: number;
  measuredVoltage: number;
  waterTemp: number;
  referenceEcUsCm: number;
  note?: string;
  measurementId?: string;
  measurementAt?: string;
};

export type StableMeasurement = {
  measurementId: string;
  measurementAt: string;
  measuredRaw: number;
  measuredVoltage: number;
  waterTemp: number;
  stable: boolean;
};
