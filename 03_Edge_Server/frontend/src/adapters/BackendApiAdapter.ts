import type {
  AutoDosingEvent,
  AutoDosingEventSummary,
  AutoDosingMonitoringSnapshot,
  AutoDosingReadiness,
  AutoDosingRun,
  AutoDosingSettings,
  CalibrationPointInput,
  DailyDoseUsage,
  DeviceSnapshot,
  GatewayHealth,
  NutrientResponseTest,
  SensorLogRow,
  StableMeasurement,
  SystemCapabilities,
} from "./types";

const lockedCapabilities: SystemCapabilities = {
  buildProfile: null, actuatorsLocked: true, pumpCommandsEnabled: false,
  pumpMainCanSet: false, nutrientPumpCanPulse: false, autoDosingCanEnable: false,
  autoDosingLockReason: "Backend chưa công bố capability metadata; khóa fail-closed",
};

export const SNAPSHOT_FRESHNESS_MS = 120_000;

export function isSnapshotFresh(measurementAt: string | null, nowMs = Date.now()): boolean {
  if (!measurementAt) return false;
  const measurementMs = Date.parse(measurementAt);
  if (!Number.isFinite(measurementMs)) return false;
  const ageMs = nowMs - measurementMs;
  return ageMs >= 0 && ageMs <= SNAPSHOT_FRESHNESS_MS;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.errors?.join("; ") || body.message || `HTTP ${response.status}`);
  return body as T;
}

const recordOrEmpty = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" ? value as Record<string, unknown> : {}
);
const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const stringOrNull = (value: unknown): string | null => (
  typeof value === "string" && value ? value : null
);
const normalizePumpStep = (value: unknown) => {
  const row = recordOrEmpty(value);
  return {
    commandId: stringOrNull(row.commandId),
    durationMs: numberOrNull(row.durationMs),
    status: String(row.status || "pending"),
  };
};
const normalizeDosingRun = (value: unknown): AutoDosingRun => {
  const row = recordOrEmpty(value);
  return {
    runId: String(row.runId || row._id || "unknown-run"),
    status: String(row.status || "unknown"),
    currentStep: String(row.currentStep || "unknown"),
    tdsPpmAtStart: numberOrNull(row.tdsPpmAtStart),
    tdsPpmAfterMixing: numberOrNull(row.tdsPpmAfterMixing),
    deltaTdsPpm: numberOrNull(row.deltaTdsPpm),
    stepDoseMlPerPump: numberOrNull(row.stepDoseMlPerPump ?? row.doseMlPerPump),
    mixingDelayMs: numberOrNull(row.mixingDelayMs),
    reason: stringOrNull(row.reason),
    createdAt: stringOrNull(row.createdAt),
    completedAt: stringOrNull(row.completedAt),
    pumpA: normalizePumpStep(row.pumpA),
    pumpB: normalizePumpStep(row.pumpB),
  };
};
const normalizeAutoDosingEvent = (value: unknown): AutoDosingEvent => {
  const row = recordOrEmpty(value);
  return {
    eventId: String(row.eventId || row._id || "unknown-event"),
    eventType: String(row.eventType || "unknown"),
    reason: stringOrNull(row.reason),
    message: String(row.message || ""),
    tdsPpm: numberOrNull(row.tdsPpm),
    createdAt: stringOrNull(row.createdAt),
  };
};

export class BackendApiAdapter {
  async getCapabilities(): Promise<SystemCapabilities> {
    try {
      const result = await json<{ data: SystemCapabilities }>("/api/system/capabilities");
      const value = result.data;
      if (!value || typeof value.actuatorsLocked !== "boolean" || typeof value.pumpCommandsEnabled !== "boolean") return lockedCapabilities;
      return value;
    } catch { return lockedCapabilities; }
  }
  async getHealth(): Promise<GatewayHealth> {
    try {
      const result = await json<{ ok: boolean; mongoConnected?: boolean; mqttConnected?: boolean }>("/health");
      return { connected: true, mongoConnected: result.mongoConnected === true, mqttConnected: result.mqttConnected === true, databaseLabel: "Local Database", databaseEngine: result.mongoConnected ? "MongoDB" : null, firmwareVersion: null, backendVersion: "hydroponic-mqtt-backend", buildProfile: null };
    } catch { return { connected: false, mongoConnected: false, mqttConnected: false, databaseLabel: "Local Database", databaseEngine: null, firmwareVersion: null, backendVersion: null, buildProfile: null }; }
  }
  async getActiveCalibration(deviceId: string) { return json<{ data: unknown | null }>(`/api/devices/${encodeURIComponent(deviceId)}/tds-calibration-sets/active`); }
  async getDeviceSnapshot(deviceId: string): Promise<DeviceSnapshot> {
    const result = await json<{ deviceId: string; lastSeenAt?: string; updatedAt?: string; latest?: Record<string, unknown> }>(`/api/devices/${encodeURIComponent(deviceId)}/latest`);
    const row = result.latest || {};
    const numberOrNull = (value: unknown) => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const waterLevel = ["normal", "low", "error"].includes(String(row.waterLevel))
      ? String(row.waterLevel) as DeviceSnapshot["waterLevel"]
      : null;

    return {
      deviceId: result.deviceId || deviceId,
      connected: true,
      measurementAt: String(row.measurementAt || result.lastSeenAt || result.updatedAt || "") || null,
      tdsRaw: numberOrNull(row.tdsRaw),
      tdsVoltage: numberOrNull(row.tdsVoltage),
      tdsPpm: numberOrNull(row.tdsPpm),
      ecUsCm: numberOrNull(row.ecUsCm),
      tdsWindowStable: row.tdsWindowStable === true,
      tdsCalibrationSetId: typeof row.tdsCalibrationSetId === "string" && row.tdsCalibrationSetId ? row.tdsCalibrationSetId : null,
      tdsCalibrationWarning: typeof row.tdsCalibrationWarning === "string" && row.tdsCalibrationWarning ? row.tdsCalibrationWarning : null,
      tdsControlInvalidReasons: Array.isArray(row.tdsControlInvalidReasons)
        ? row.tdsControlInvalidReasons.filter((reason): reason is string => typeof reason === "string")
        : [],
      waterTemp: numberOrNull(row.waterTemp),
      waterLevel,
      pumpMain: row.pumpMain === true,
      tdsControlValid: row.tdsControlValid === true,
    };
  }
  async getSensorLogs(deviceId: string, limit = 100): Promise<SensorLogRow[]> {
    const safeLimit = Math.min(1000, Math.max(1, Math.trunc(limit)));
    const result = await json<{ data?: Record<string, unknown>[] }>(`/api/devices/${encodeURIComponent(deviceId)}/sensor-logs?limit=${safeLimit}`);
    const numberOrNull = (value: unknown) => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return (result.data || []).map((row, index) => {
      const waterLevel = ["normal", "low", "error"].includes(String(row.waterLevel))
        ? String(row.waterLevel) as SensorLogRow["waterLevel"]
        : null;
      const measurementAt = String(row.measurementAt || row.createdAt || "") || null;
      return {
        id: String(row._id || row.measurementId || `${measurementAt || "sensor-log"}-${index}`),
        measurementAt,
        tdsPpm: numberOrNull(row.tdsPpm),
        ecUsCm: numberOrNull(row.ecUsCm),
        waterTemp: numberOrNull(row.waterTemp),
        waterLevel,
        pumpMain: row.pumpMain === true,
        tdsControlValid: row.tdsControlValid === true,
      };
    });
  }
  async getAutoDosingMonitoring(deviceId: string): Promise<AutoDosingMonitoringSnapshot> {
    const encodedDeviceId = encodeURIComponent(deviceId);
    const [settingsResult, readinessResult, activeRunResult, runsResult, dailyUsageResult, eventsResult, eventSummaryResult, nutrientResult] = await Promise.all([
      json<{ data?: unknown }>(`/api/devices/${encodedDeviceId}/auto-dosing/settings`),
      json<{ data?: unknown }>(`/api/devices/${encodedDeviceId}/auto-dosing/readiness`),
      json<{ data?: unknown }>(`/api/devices/${encodedDeviceId}/auto-dosing/active-run`),
      json<{ data?: unknown[] }>(`/api/devices/${encodedDeviceId}/auto-dosing/runs?limit=10`),
      json<Record<string, unknown>>(`/api/devices/${encodedDeviceId}/auto-dosing/daily-usage`),
      json<{ data?: unknown[] }>(`/api/devices/${encodedDeviceId}/auto-dosing/events?limit=10`),
      json<{ data?: unknown }>(`/api/devices/${encodedDeviceId}/auto-dosing/events/summary`),
      json<{ data?: unknown }>(`/api/devices/${encodedDeviceId}/nutrient-response-tests/latest`),
    ]);

    const settingsRow = recordOrEmpty(settingsResult.data);
    const readinessRow = recordOrEmpty(readinessResult.data);
    const dailyRow = recordOrEmpty(dailyUsageResult);
    const summaryRow = recordOrEmpty(eventSummaryResult.data);
    const nutrientRow = nutrientResult.data ? recordOrEmpty(nutrientResult.data) : null;
    const nutrientBefore = nutrientRow ? recordOrEmpty(nutrientRow.before) : {};
    const nutrientAfter = nutrientRow ? recordOrEmpty(nutrientRow.after15min) : {};
    const nutrientOutcome = nutrientRow ? recordOrEmpty(nutrientRow.result) : {};
    const settings: AutoDosingSettings = {
      deviceId: String(settingsRow.deviceId || deviceId),
      mode: String(settingsRow.mode || "closed_loop_step"),
      enabled: settingsRow.enabled === true,
      phase22LockedOff: settingsRow.phase22LockedOff === true,
      cropCode: String(settingsRow.cropCode || ""),
      targetRangeConfirmed: settingsRow.targetRangeConfirmed === true,
      targetMinPpm: numberOrNull(settingsRow.targetMinPpm),
      targetMaxPpm: numberOrNull(settingsRow.targetMaxPpm),
      stepDoseMlPerPump: numberOrNull(settingsRow.stepDoseMlPerPump ?? settingsRow.doseMlPerPump),
      maxDoseMlPerPumpPerRun: numberOrNull(settingsRow.maxDoseMlPerPumpPerRun),
      maxDailyDoseMlPerPump: numberOrNull(settingsRow.maxDailyDoseMlPerPump),
      mixingDelayMs: numberOrNull(settingsRow.mixingDelayMs ?? settingsRow.cooldownMs),
      requireMainPumpOn: settingsRow.requireMainPumpOn === true,
      lastEvaluationAt: stringOrNull(settingsRow.lastEvaluationAt),
      lastEvaluationReason: stringOrNull(settingsRow.lastEvaluationReason),
      lastEvaluationTdsPpm: numberOrNull(settingsRow.lastEvaluationTdsPpm),
    };
    const latestSummaryEvent = summaryRow.latest ? normalizeAutoDosingEvent(summaryRow.latest) : null;
    const eventSummary: AutoDosingEventSummary = {
      windowHours: numberOrNull(summaryRow.windowHours) ?? 24,
      total: numberOrNull(summaryRow.total) ?? 0,
      latest: latestSummaryEvent,
    };
    const latestNutrientResponse: NutrientResponseTest | null = nutrientRow ? {
      testId: String(nutrientRow.testId || nutrientRow._id || "unknown-test"),
      beforeDashboardPpm: numberOrNull(nutrientBefore.dashboardAverage),
      afterDashboardPpm: numberOrNull(nutrientAfter.dashboardAverage),
      deltaDashboardPpm: numberOrNull(nutrientOutcome.deltaDashboard),
      estimatedResponsePpmPerMl: numberOrNull(nutrientOutcome.estimatedResponsePpmPerMl),
      createdAt: stringOrNull(nutrientRow.createdAt),
    } : null;

    return {
      settings,
      readiness: {
        ready: readinessRow.ready === true,
        reasons: Array.isArray(readinessRow.reasons)
          ? readinessRow.reasons.filter((reason): reason is string => typeof reason === "string")
          : [],
      } satisfies AutoDosingReadiness,
      activeRun: activeRunResult.data ? normalizeDosingRun(activeRunResult.data) : null,
      runs: (runsResult.data || []).map(normalizeDosingRun),
      dailyUsage: {
        localDate: stringOrNull(dailyRow.localDate),
        dailyDoseUsedMlPerPump: numberOrNull(dailyRow.dailyDoseUsedMlPerPump) ?? 0,
        maxDailyDoseMlPerPump: numberOrNull(dailyRow.maxDailyDoseMlPerPump) ?? 0,
        remainingDailyDoseMlPerPump: numberOrNull(dailyRow.remainingDailyDoseMlPerPump) ?? 0,
        progressPercentage: numberOrNull(dailyRow.progressPercentage) ?? 0,
        isLimitReached: dailyRow.isLimitReached === true,
        runsCounted: numberOrNull(dailyRow.runsCounted) ?? 0,
      } satisfies DailyDoseUsage,
      events: (eventsResult.data || []).map(normalizeAutoDosingEvent),
      eventSummary,
      latestNutrientResponse,
      loadedAt: new Date().toISOString(),
    };
  }
  async setMainPump(deviceId: string, on: boolean) {
    return json(`/api/devices/${encodeURIComponent(deviceId)}/pumps/main/state`, {
      method: "POST",
      body: JSON.stringify({ state: on ? "on" : "off", reason: "hydroflow_dashboard" }),
    });
  }
  async pulsePump(deviceId: string, pump: "A" | "B", durationMs: number) {
    return json(`/api/devices/${encodeURIComponent(deviceId)}/pump-command`, {
      method: "POST",
      body: JSON.stringify({ pump, action: "pulse", durationMs, reason: "hydroflow_dashboard" }),
    });
  }
  async createCalibrationSet(deviceId: string, note: string) { return json<{ data: { setId: string } }>(`/api/devices/${encodeURIComponent(deviceId)}/tds-calibration-sets`, { method: "POST", body: JSON.stringify({ note, method: "piecewise_linear_ec", referenceScale: "500", tdsFactor: 0.5 }) }); }
  async captureLatest(deviceId: string): Promise<StableMeasurement> {
    const result = await json<{ latest: Record<string, unknown>; updatedAt?: string }>(`/api/devices/${encodeURIComponent(deviceId)}/latest`);
    const row = result.latest || {};
    const raw = Number(row.tdsRaw ?? row.raw ?? row.measuredRaw);
    const voltage = Number(row.tdsVoltage ?? row.voltage ?? row.measuredVoltage);
    const temp = Number(row.waterTemp ?? row.temperature);
    if (![raw, voltage, temp].every(Number.isFinite)) throw new Error("Backend chưa có phép đo ổn định đầy đủ raw/voltage/waterTemp");
    return {
      measurementId: String(row.measurementId ?? "latest"),
      measurementAt: String(row.measurementAt ?? result.updatedAt ?? new Date().toISOString()),
      measuredRaw: raw,
      measuredVoltage: voltage,
      waterTemp: temp,
      stable: row.tdsWindowStable === true && row.tdsStable === true && row.tdsControlValid === true,
    };
  }
  async addCalibrationPoint(deviceId: string, setId: string, point: CalibrationPointInput) { return json(`/api/devices/${encodeURIComponent(deviceId)}/tds-calibration-sets/${encodeURIComponent(setId)}/points`, { method: "POST", body: JSON.stringify({ ...point, referenceScale: "500", tdsFactor: 0.5 }) }); }
  async validateCalibration(deviceId: string, setId: string) { return json(`/api/devices/${encodeURIComponent(deviceId)}/tds-calibration-sets/${encodeURIComponent(setId)}/validate`, { method: "POST" }); }
  async activateCalibration(deviceId: string, setId: string) { return json(`/api/devices/${encodeURIComponent(deviceId)}/tds-calibration-sets/${encodeURIComponent(setId)}/activate`, { method: "POST" }); }
  async downloadCsv(deviceId: string, dataset: string) {
    const endpoints: Record<string, string> = { dosing_runs: "dosing-runs", nutrient_response_tests: "nutrient-response-tests", auto_dosing_events: "auto-dosing-events" };
    if (endpoints[dataset]) {
      const response = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/export/${endpoints[dataset]}.csv`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { blob: await response.blob(), filename: response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] || `${deviceId}-${dataset}.csv` };
    }
    if (dataset !== "sensor_logs") throw new Error("Backend chưa có endpoint CSV cho dataset này");
    const result = await json<{ data: unknown[] }>(`/api/devices/${encodeURIComponent(deviceId)}/sensor-logs?limit=1000`);
    const rows = result.data || []; const keys = [...new Set(rows.flatMap(row => Object.keys(row as object)))];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    return { blob: new Blob(["\uFEFF" + [keys.join(","), ...rows.map(row => keys.map(k => escape((row as Record<string, unknown>)[k])).join(","))].join("\n")], { type: "text/csv;charset=utf-8" }), filename: `${deviceId}-sensor-logs.csv` };
  }
}

export const backendApiAdapter = new BackendApiAdapter();
