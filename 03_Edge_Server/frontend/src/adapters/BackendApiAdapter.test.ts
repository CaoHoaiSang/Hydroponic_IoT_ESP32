import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendApiAdapter, isSnapshotFresh, SNAPSHOT_FRESHNESS_MS } from "./BackendApiAdapter";

describe("snapshot freshness", () => {
  const now = Date.parse("2026-08-14T12:00:00.000Z");

  it("accepts recent data and rejects stale, future, missing, or invalid timestamps", () => {
    expect(isSnapshotFresh(new Date(now - SNAPSHOT_FRESHNESS_MS).toISOString(), now)).toBe(true);
    expect(isSnapshotFresh(new Date(now - SNAPSHOT_FRESHNESS_MS - 1).toISOString(), now)).toBe(false);
    expect(isSnapshotFresh(new Date(now + 1).toISOString(), now)).toBe(false);
    expect(isSnapshotFresh(null, now)).toBe(false);
    expect(isSnapshotFresh("not-a-date", now)).toBe(false);
  });
});

describe("BackendApiAdapter sensor logs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps only fields returned by the Backend sensor-log API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: [{
        _id: "log-1",
        measurementAt: "2026-08-13T10:00:00.000Z",
        tdsPpm: 420.5,
        ecUsCm: 841,
        waterTemp: 25.4,
        waterLevel: "normal",
        pumpMain: true,
        tdsControlValid: false,
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(new BackendApiAdapter().getSensorLogs("device001", 5000)).resolves.toEqual([{
      id: "log-1",
      measurementAt: "2026-08-13T10:00:00.000Z",
      tdsPpm: 420.5,
      ecUsCm: 841,
      waterTemp: 25.4,
      waterLevel: "normal",
      pumpMain: true,
      tdsControlValid: false,
    }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/devices/device001/sensor-logs?limit=1000", expect.any(Object));
  });

  it("preserves missing calibrated values and exposes raw TDS diagnostics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      deviceId: "device001",
      latest: {
        measurementAt: "2026-08-14T03:41:32.696Z",
        tdsRaw: 2536,
        tdsVoltage: 2.044,
        tdsPpm: null,
        ecUsCm: null,
        tdsWindowStable: true,
        tdsCalibrationSetId: null,
        tdsCalibrationWarning: "tds_calibration_set_missing",
        tdsControlInvalidReasons: ["tds_calibration_set_missing", "tds_value_invalid"],
        waterTemp: 30.31,
        waterLevel: "normal",
        pumpMain: false,
        tdsControlValid: false,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(new BackendApiAdapter().getDeviceSnapshot("device001")).resolves.toMatchObject({
      tdsRaw: 2536,
      tdsVoltage: 2.044,
      tdsPpm: null,
      ecUsCm: null,
      tdsWindowStable: true,
      tdsCalibrationSetId: null,
      tdsCalibrationWarning: "tds_calibration_set_missing",
      tdsControlInvalidReasons: ["tds_calibration_set_missing", "tds_value_invalid"],
    });
  });

  it("sends the EC-first calibration scale using the backend string contract", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { setId: "set-1" } }), { status: 201, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const adapter = new BackendApiAdapter();

    await adapter.createCalibrationSet("device001", "meter");
    await adapter.addCalibrationPoint("device001", "set-1", {
      measuredRaw: 2539,
      measuredVoltage: 2.046,
      waterTemp: 30.19,
      referenceEcUsCm: 1340,
    });

    const createBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const pointBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(createBody.referenceScale).toBe("500");
    expect(pointBody.referenceScale).toBe("500");
  });
});

describe("BackendApiAdapter Auto Dosing monitoring", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads and normalizes the read-only monitoring endpoints", async () => {
    const responses: Record<string, unknown> = {
      "/api/devices/device001/auto-dosing/settings": { ok: true, data: { deviceId: "device001", enabled: false, phase22LockedOff: true, cropCode: "cai_ngot", targetRangeConfirmed: true, targetMinPpm: 800, targetMaxPpm: 900, stepDoseMlPerPump: 1, maxDoseMlPerPumpPerRun: 1, maxDailyDoseMlPerPump: 2, mixingDelayMs: 900000, requireMainPumpOn: true, lastEvaluationReason: "disabled" } },
      "/api/devices/device001/auto-dosing/readiness": { ok: true, data: { ready: false, reasons: ["tds_control_invalid", "main_pump_not_running"] } },
      "/api/devices/device001/auto-dosing/active-run": { ok: true, data: null },
      "/api/devices/device001/auto-dosing/runs?limit=10": { ok: true, data: [{ runId: "dose-1", status: "completed", currentStep: "completed", tdsPpmAtStart: 700, tdsPpmAfterMixing: 730, deltaTdsPpm: 30, stepDoseMlPerPump: 1, pumpA: { durationMs: 500, status: "completed" }, pumpB: { durationMs: 556, status: "completed" }, createdAt: "2026-08-15T01:00:00.000Z" }] },
      "/api/devices/device001/auto-dosing/daily-usage": { ok: true, localDate: "2026-08-15", dailyDoseUsedMlPerPump: 1, maxDailyDoseMlPerPump: 2, remainingDailyDoseMlPerPump: 1, progressPercentage: 50, isLimitReached: false, runsCounted: 1 },
      "/api/devices/device001/auto-dosing/events?limit=10": { ok: true, data: [{ eventId: "event-1", eventType: "run_completed", reason: "completed", tdsPpm: 730, createdAt: "2026-08-15T01:15:00.000Z" }] },
      "/api/devices/device001/auto-dosing/events/summary": { ok: true, data: { windowHours: 24, total: 1, latest: { eventId: "event-1", eventType: "run_completed", reason: "completed" } } },
      "/api/devices/device001/nutrient-response-tests/latest": { ok: true, data: { testId: "response-1", before: { dashboardAverage: 700 }, after15min: { dashboardAverage: 730 }, result: { deltaDashboard: 30, estimatedResponsePpmPerMl: 30 }, createdAt: "2026-08-15T01:15:00.000Z" } },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = String(input);
      return new Response(JSON.stringify(responses[url]), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const result = await new BackendApiAdapter().getAutoDosingMonitoring("device001");

    expect(result.settings).toMatchObject({ enabled: false, cropCode: "cai_ngot", targetMinPpm: 800, targetMaxPpm: 900 });
    expect(result.readiness).toEqual({ ready: false, reasons: ["tds_control_invalid", "main_pump_not_running"] });
    expect(result.runs[0]).toMatchObject({ runId: "dose-1", deltaTdsPpm: 30, pumpA: { durationMs: 500, status: "completed" } });
    expect(result.dailyUsage).toMatchObject({ progressPercentage: 50, runsCounted: 1 });
    expect(result.latestNutrientResponse).toMatchObject({ beforeDashboardPpm: 700, afterDashboardPpm: 730, deltaDashboardPpm: 30 });
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });
});
