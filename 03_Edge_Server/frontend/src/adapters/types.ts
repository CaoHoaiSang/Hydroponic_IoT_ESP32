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

export type AutoDosingSettings = {
  deviceId: string;
  mode: string;
  enabled: boolean;
  phase22LockedOff: boolean;
  cropCode: string;
  targetRangeConfirmed: boolean;
  targetMinPpm: number | null;
  targetMaxPpm: number | null;
  stepDoseMlPerPump: number | null;
  maxDoseMlPerPumpPerRun: number | null;
  maxDailyDoseMlPerPump: number | null;
  mixingDelayMs: number | null;
  requireMainPumpOn: boolean;
  lastEvaluationAt: string | null;
  lastEvaluationReason: string | null;
  lastEvaluationTdsPpm: number | null;
};

export type AutoDosingReadiness = {
  ready: boolean;
  reasons: string[];
};

export type DosingPumpStep = {
  commandId: string | null;
  durationMs: number | null;
  status: string;
};

export type AutoDosingRun = {
  runId: string;
  status: string;
  currentStep: string;
  tdsPpmAtStart: number | null;
  tdsPpmAfterMixing: number | null;
  deltaTdsPpm: number | null;
  stepDoseMlPerPump: number | null;
  mixingDelayMs: number | null;
  reason: string | null;
  createdAt: string | null;
  completedAt: string | null;
  pumpA: DosingPumpStep;
  pumpB: DosingPumpStep;
};

export type DailyDoseUsage = {
  localDate: string | null;
  dailyDoseUsedMlPerPump: number;
  maxDailyDoseMlPerPump: number;
  remainingDailyDoseMlPerPump: number;
  progressPercentage: number;
  isLimitReached: boolean;
  runsCounted: number;
};

export type AutoDosingEvent = {
  eventId: string;
  eventType: string;
  reason: string | null;
  message: string;
  tdsPpm: number | null;
  createdAt: string | null;
};

export type AutoDosingEventSummary = {
  windowHours: number;
  total: number;
  latest: AutoDosingEvent | null;
};

export type NutrientResponseTest = {
  testId: string;
  beforeDashboardPpm: number | null;
  afterDashboardPpm: number | null;
  deltaDashboardPpm: number | null;
  estimatedResponsePpmPerMl: number | null;
  createdAt: string | null;
};

export type AutoDosingMonitoringSnapshot = {
  settings: AutoDosingSettings;
  readiness: AutoDosingReadiness;
  activeRun: AutoDosingRun | null;
  runs: AutoDosingRun[];
  dailyUsage: DailyDoseUsage;
  events: AutoDosingEvent[];
  eventSummary: AutoDosingEventSummary;
  latestNutrientResponse: NutrientResponseTest | null;
  loadedAt: string;
};
