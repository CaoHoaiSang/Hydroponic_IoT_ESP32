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
