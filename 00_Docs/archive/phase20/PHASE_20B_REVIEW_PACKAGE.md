# HISTORICAL SNAPSHOT — DO NOT USE FOR CURRENT PHASE 21 SAFETY LOGIC.

Any `NOT TESTED` status in this snapshot reflects the time when this package was
created. Newer historical Phase 20B/20C runtime results are recorded in the Phase
20D review package and `00_Docs/PROJECT_STATUS_REPORT.md`. This file is not Phase
21 runtime evidence and its older safety logic must not be used for current control.

# PHASE 20B REVIEW PACKAGE

## 1. Implementation Summary

Phase 20B implemented three local-first prototype features:

- Main Pump Continuous ON/OFF Control
  - Added backend/API/dashboard support for continuous `set on/off` control of the main circulation pump only.
  - Added ESP32 MQTT command support for `action: "set"` only when `pump: "main"`.
  - Pump A, Pump B, and spare remain pulse-only.

- Nutrient Response Logging
  - Added MongoDB-backed `nutrient_response_tests`.
  - Added API and dashboard form/history/summary for logging experimental response tests.
  - This feature only logs test data; it does not run pumps or publish MQTT pump commands.

- Auto Dosing V2 Closed-loop Step Dosing
  - Upgraded Auto Dosing to one small Pump A + Pump B step, then `mixing_wait`, then finalizes after `mixingDelayMs` and the next valid sensor payload.
  - Added safety checks for water level, water temperature validity, optional `tdsStable`, main pump ON requirement, calibration presence, active/mixing runs, daily dose limit, and target range.
  - Preserved the dashboard form edit guard so auto-refresh does not overwrite unsaved settings.

- Documentation updates
  - Updated `README.md`.
  - Updated `PROJECT_STATUS_REPORT.md`.
  - Created this one review package file for ChatGPT inspection.

Intentionally NOT implemented:

- No MongoDB to SQLite/PostgreSQL migration.
- No Fleet Management Cloud.
- No Device Enrollment.
- No AI Model OTA.
- No Zalo OA.
- No pH.
- No pin map changes.

## 2. Files Changed

### ESP32 Firmware

- `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino`
  - Added `state` to MQTT pump command parsing.
  - Added main pump `action: "set"` handler.
  - Rejects `set` for Pump A/B/spare and preserves pulse commands.

- `02_ESP32_Main_Firmware/Hydroponic_Device001/PayloadBuilder.h`
  - Added `state` parameter to pump status payload builder.

- `02_ESP32_Main_Firmware/Hydroponic_Device001/PayloadBuilder.cpp`
  - Emits optional `"state": "on"` or `"state": "off"` in pump status payloads.

### Backend

- `03_Edge_Server/mqtt_backend/src/mongoClient.js`
  - Added indexes for `nutrient_response_tests`.

- `03_Edge_Server/mqtt_backend/src/mqttClient.js`
  - Logs Auto Dosing V2 `completed` and `mixing_wait_started` events.

- `03_Edge_Server/mqtt_backend/src/routes/deviceRoutes.js`
  - Added main pump state route.
  - Added nutrient response logging routes.
  - Existing auto dosing routes are reused.

- `03_Edge_Server/mqtt_backend/src/validators/pumpCommandValidator.js`
  - Added validation for main pump `state: on/off`.

- `03_Edge_Server/mqtt_backend/src/services/pumpCommandService.js`
  - Added main pump state command safety validation and MQTT publishing.

- `03_Edge_Server/mqtt_backend/src/services/pumpLogService.js`
  - Accepts `action: "set"` pump status payloads and stores `state`.

- `03_Edge_Server/mqtt_backend/src/validators/nutrientResponseTestValidator.js`
  - New validator for nutrient response logging payloads.

- `03_Edge_Server/mqtt_backend/src/services/nutrientResponseService.js`
  - New service for saving tests, calculating averages/deltas/response estimate, and summary/history.

- `03_Edge_Server/mqtt_backend/src/validators/autoDosingSettingsValidator.js`
  - Upgraded settings validation for Auto Dosing V2 closed-loop step fields.
  - Keeps backward compatibility with older `doseMlPerPump` / `cooldownMs` fields.

- `03_Edge_Server/mqtt_backend/src/services/autoDosingService.js`
  - Upgraded to closed-loop step dosing with `mixing_wait`, `tdsPpmAfterMixing`, `deltaTdsPpm`, and daily dose limits.

### Dashboard

- `03_Edge_Server/mqtt_backend/public/index.html`
  - Added Main Pump Continuous Control section.
  - Added Nutrient Response Tests section.
  - Updated Auto Dosing section to V2 fields and run table.

- `03_Edge_Server/mqtt_backend/public/styles.css`
  - Added layout styles for main pump control and nutrient response sections.

- `03_Edge_Server/mqtt_backend/public/app.js`
  - Added main pump ON/OFF actions.
  - Added nutrient response load/save/fill/display logic.
  - Updated Auto Dosing V2 render/save logic and preserved form edit guard.

### Docs

- `03_Edge_Server/mqtt_backend/README.md`
  - Documented Phase 20B API, safety rules, nutrient response logging, and Auto Dosing V2.

- `00_Docs/PROJECT_STATUS_REPORT.md`
  - Updated current phase, created/modified files, known issues, and runtime test checklist.

- `00_Docs/PHASE_20B_REVIEW_PACKAGE.md`
  - This review package.

## 3. ESP32 Pump Command Changes

### Current Pin Map Constants

```cpp
// Official sensor pins.
#define PIN_TDS_ADC 34
#define PIN_DS18B20_DATA 4
#define PIN_WATER_LEVEL 27

// Official MOSFET / pump pins.
#define PIN_PUMP_MAIN 25
#define PIN_PUMP_A 26
#define PIN_PUMP_B 14
#define PIN_PUMP_SPARE 33

// Safe MQTT/API pump pulse limits.
const unsigned long MQTT_PUMP_MAIN_MAX_DURATION_MS = 10000;
const unsigned long MQTT_PUMP_A_MAX_DURATION_MS = 5000;
const unsigned long MQTT_PUMP_B_MAX_DURATION_MS = 5000;
```

### MQTT Command Parser

```cpp
struct PumpCommand {
  String commandId;
  String deviceId;
  String pump;
  String action;
  String state;
  unsigned long durationMs;
  String reason;
  String source;
};

PumpCommand parsePumpCommandPayload(const String& payload) {
  PumpCommand command;
  command.commandId = "";
  command.deviceId = "";
  command.pump = "";
  command.action = "";
  command.state = "";
  command.durationMs = 0;

  readJsonString(payload, "commandId", command.commandId);
  readJsonString(payload, "deviceId", command.deviceId);
  readJsonString(payload, "pump", command.pump);
  readJsonString(payload, "action", command.action);
  readJsonString(payload, "state", command.state);
  readJsonUnsignedLong(payload, "durationMs", command.durationMs);
  readJsonString(payload, "reason", command.reason);
  readJsonString(payload, "source", command.source);

  command.pump = normalizePumpName(command.pump);
  command.action.trim();
  command.action.toLowerCase();
  command.state.trim();
  command.state.toLowerCase();

  return command;
}
```

### Rejection Handling

```cpp
void rejectPumpCommand(const PumpCommand& command, const String& message) {
  String commandId = command.commandId.length() > 0 ? command.commandId : "unknown";
  String pump = command.pump.length() > 0 ? command.pump : "unknown";
  String action = command.action.length() > 0 ? command.action : "unknown";

  publishPumpCommandStatus(
    commandId,
    pump,
    action,
    command.durationMs,
    false,
    false,
    "rejected",
    message,
    command.state
  );
}
```

### Main Pump `set_on` / `set_off`

```cpp
void handleMainPumpSetCommand(const PumpCommand& command) {
  if (command.pump != "main") {
    rejectPumpCommand(command, "Rejected: set action is only allowed for main pump");
    return;
  }

  if (command.state != "on" && command.state != "off") {
    rejectPumpCommand(command, "Rejected: state must be on or off");
    return;
  }

  if (command.state == "on") {
    readAndStoreSensors();

    if (String(latestSensorData.waterLevel) != "normal") {
      rejectPumpCommand(command, "Rejected: main pump can only turn on when water level is normal");
      return;
    }
  }

  if (activePulse == PULSE_MAIN) {
    cancelActivePulse(true, "Pump command cancelled by main set command");
  }

  bool turnOn = command.state == "on";
  setPumpMain(turnOn);
  printPumpState("pumpMain", turnOn);

  publishPumpCommandStatus(
    command.commandId,
    command.pump,
    command.action,
    0,
    true,
    true,
    turnOn ? "set_on" : "set_off",
    turnOn ? "Main pump turned on continuously" : "Main pump turned off",
    command.state
  );
}
```

### Pulse and Set Handler

```cpp
void handlePumpCommandPayload(const String& payload) {
  PumpCommand command = parsePumpCommandPayload(payload);

  if (command.deviceId != DEVICE_ID) {
    rejectPumpCommand(command, "Rejected: deviceId mismatch");
    return;
  }

  if (command.action == "set") {
    handleMainPumpSetCommand(command);
    return;
  }

  if (command.action != "pulse") {
    rejectPumpCommand(command, "Rejected: action must be pulse or set");
    return;
  }

  PulseTarget target = pumpToPulseTarget(command.pump);
  if (target == PULSE_NONE) {
    rejectPumpCommand(command, "Rejected: invalid pump");
    return;
  }

  // Existing pulse validation continues:
  // duration > 0, duration <= max, no active command,
  // A/B mutual exclusion, water level normal, water temp valid.
  startPulse(target, command.durationMs, true, command);
}
```

### Pump Status Payload for Set Commands

```cpp
String buildPumpStatusPayload(
  const String& commandId,
  const String& pump,
  const String& action,
  const String& state,
  unsigned long durationMs,
  bool accepted,
  bool success,
  const String& status,
  const String& message
) {
  payload += "  \"action\": \"";
  payload += escapeJsonString(action);
  payload += "\",\n";

  if (state.length() > 0) {
    payload += "  \"state\": \"";
    payload += escapeJsonString(state);
    payload += "\",\n";
  }

  payload += "  \"durationMs\": ";
  payload += durationMs;
  payload += ",\n";
  // accepted, success, status, message, pumpMain/A/B/spare, uptimeMs follow.
}
```

Confirmation:

- Existing `action: "pulse"` commands still go through the previous pulse path.
- Main/A/B pulse limits remain unchanged.
- Pump A/B set commands are rejected by ESP32 because `handleMainPumpSetCommand()` only accepts `pump == "main"`.

## 4. Backend Pump API and Validation

### Route

```js
router.post('/api/devices/:deviceId/pumps/main/state', async (request, response) => {
  try {
    const result = await sendMainPumpStateCommand(request.params.deviceId, request.body);

    if (!result.ok) {
      response.status(400).json(result);
      return;
    }

    response.json(result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});
```

### State Validator

```js
function validateMainPumpStateCommand(deviceId, body) {
  const errors = [];
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const state = typeof payload.state === 'string' ? payload.state.trim().toLowerCase() : payload.state;

  if (!['on', 'off'].includes(state)) {
    errors.push('state must be one of: on, off');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      deviceId: normalizedDeviceId,
      pump: 'main',
      action: 'set',
      state,
      reason: typeof payload.reason === 'string' && payload.reason.trim().length > 0
        ? payload.reason.trim()
        : 'main_pump_dashboard',
    },
  };
}
```

### Main ON Safety / Main OFF Always Allowed

```js
async function validateMainPumpStateAgainstLatest(command) {
  const errors = [];

  if (command.state === 'off') {
    return errors;
  }

  const database = getDb();
  const device = await database.collection('devices').findOne({ deviceId: command.deviceId });
  const latest = device && device.latest ? device.latest : null;

  if (!latest) {
    errors.push('latest device status is unavailable');
    return errors;
  }

  if (latest.waterLevel !== 'normal') {
    errors.push('main pump can only be turned on when water level is normal');
  }

  return errors;
}
```

### MQTT Publish Payload

```js
const commandPayload = {
  commandId: createCommandId(),
  deviceId: command.deviceId,
  pump: 'main',
  action: 'set',
  state: command.state,
  reason: command.reason,
  source: 'dashboard',
  createdAt: new Date().toISOString(),
};

await publishPumpCommand(commandPayload);
```

### Pump Logs for Set Status

```js
if (!['pulse', 'set'].includes(payload.action)) {
  errors.push('action must be one of: pulse, set');
}

if (payload.action === 'set' && !['on', 'off'].includes(payload.state)) {
  errors.push('state must be one of: on, off for set action');
}

const pumpLog = {
  commandId: payload.commandId,
  deviceId: payload.deviceId,
  pump: payload.pump,
  action: payload.action,
  state: payload.state,
  durationMs: payload.durationMs,
  accepted: payload.accepted,
  success: payload.success,
  status: payload.status,
  message: payload.message,
  createdAt: now,
  rawPayload: payload,
};
```

## 5. Dashboard Main Pump Control

### HTML Section

```html
<section class="section-block" aria-labelledby="mainPumpControlTitle">
  <div class="section-heading">
    <h2 id="mainPumpControlTitle">Main Pump Continuous Control</h2>
    <span id="mainPumpContinuousStatus" class="meta-text">Continuous main pump control</span>
  </div>
  <div class="manual-panel">
    <div class="warning-list">
      <p>Main pump should be ON during mixing, nutrient response tests, and Auto Dosing.</p>
      <p>Continuous ON/OFF is only available for the main circulation pump.</p>
      <p>Pump A and Pump B remain pulse-only for safety.</p>
    </div>
    <strong id="mainPumpContinuousValue" class="metric-value">N/A</strong>
    <strong id="mainPumpLastCommandValue" class="metric-value compact-value">No command sent</strong>
    <button id="mainPumpOnButton" type="button">Turn Main Pump ON</button>
    <button id="mainPumpOffButton" class="secondary-button" type="button">Turn Main Pump OFF</button>
  </div>
</section>
```

### JS Button Actions

```js
async function sendMainPumpState(state) {
  setMainPumpStateButtonsDisabled(true);
  setMessage(`Sending main pump ${state.toUpperCase()} command...`);

  const response = await fetch(`/api/devices/${DEVICE_ID}/pumps/main/state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      state,
      reason: 'main_pump_dashboard',
    }),
  });

  const data = await response.json();
  byId('mainPumpLastCommandValue').textContent = `${state.toUpperCase()} sent: ${data.command.commandId}`;
  await loadDashboard();
}

function bindMainPumpStateControls() {
  byId('mainPumpOnButton').addEventListener('click', () => {
    sendMainPumpState('on');
  });

  byId('mainPumpOffButton').addEventListener('click', () => {
    sendMainPumpState('off');
  });
}
```

### UI Refresh for Pump State

```js
setPumpBadge('pumpMainBadge', latest.pumpMain);
byId('mainPumpContinuousValue').textContent = formatBoolOnOff(latest.pumpMain);
```

Safety disabling logic:

- Dashboard button disabling is used while a request is in flight.
- Backend enforces water-level safety for turning main pump ON.
- Main pump OFF remains available through the backend even when water is low.

## 6. Nutrient Response Logging

### MongoDB Indexes

```js
await database.collection('nutrient_response_tests').createIndex({ deviceId: 1, createdAt: -1 });
await database.collection('nutrient_response_tests').createIndex({ testId: 1 }, { unique: true });
```

### Validator Highlights

```js
if (workingLevelLiters === null) {
  errors.push('workingLevelLiters must be a positive number');
}

if (pumpAMl === null) {
  errors.push('dose.pumpAMl must be a positive number');
}

if (pumpBml === null) {
  errors.push('dose.pumpBml must be a positive number');
}

const before = buildBeforeStage(errors, payload.before);
const after15min = buildAfterStage(payload.after15min, true);

if (
  !Array.isArray(after15min.dashboardValues)
  || after15min.dashboardValues.some((item) => item === null)
) {
  errors.push('after15min.dashboardValues must be a numeric array');
}
```

### Service Calculations

```js
function average(values) {
  const numericValues = Array.isArray(values)
    ? values.filter((value) => typeof value === 'number' && Number.isFinite(value))
    : [];

  if (numericValues.length === 0) {
    return null;
  }

  const sum = numericValues.reduce((total, value) => total + value, 0);
  return Number((sum / numericValues.length).toFixed(2));
}

function calculateDerivedFields(test) {
  const beforeDashboardAverage = average(test.before.dashboardValues);
  const after15DashboardAverage = average(test.after15min.dashboardValues);
  const result = {
    ...test.result,
    deltaDashboard: subtractNullable(after15DashboardAverage, beforeDashboardAverage),
    deltaPenMain: subtractNullable(test.after15min.penMainPpm, test.before.penMainPpm),
    deltaPenSecondary: subtractNullable(test.after15min.penSecondaryPpm, test.before.penSecondaryPpm),
  };

  result.estimatedResponsePpmPerMl = calculateResponseEstimate(result, test.dose);

  return {
    ...test,
    before: { ...test.before, dashboardAverage: beforeDashboardAverage },
    after15min: { ...test.after15min, dashboardAverage: after15DashboardAverage },
    result,
  };
}
```

### Response Estimate Definition

```js
function calculateResponseEstimate(result, dose) {
  const pairDoseMl = (dose.pumpAMl + dose.pumpBml) / 2;
  const delta = [result.deltaDashboard, result.deltaPenMain, result.deltaPenSecondary]
    .find((value) => typeof value === 'number' && Number.isFinite(value));

  if (typeof delta !== 'number') {
    return null;
  }

  return Number((delta / pairDoseMl).toFixed(2));
}
```

### API Routes

```js
router.post('/api/devices/:deviceId/nutrient-response-tests', async (request, response) => {
  const result = await saveNutrientResponseTest(request.params.deviceId, request.body);
  response.json(result);
});

router.get('/api/devices/:deviceId/nutrient-response-tests', async (request, response) => {
  const tests = await getNutrientResponseTests(request.params.deviceId, request.query.limit);
  response.json({ ok: true, count: tests.length, data: tests });
});

router.get('/api/devices/:deviceId/nutrient-response-tests/latest', async (request, response) => {
  const test = await getLatestNutrientResponseTest(request.params.deviceId);
  response.json({ ok: true, data: test || null });
});

router.get('/api/devices/:deviceId/nutrient-response-summary', async (request, response) => {
  const summary = await getNutrientResponseSummary(request.params.deviceId);
  response.json({ ok: true, data: summary });
});
```

### Dashboard HTML/JS

```html
<section class="section-block" aria-labelledby="nutrientResponseTitle">
  <h2 id="nutrientResponseTitle">Nutrient Response Tests</h2>
  <form id="nutrientResponseForm" class="calibration-form nutrient-form">
    <input id="nutrientWorkingLevelInput" type="number" value="16">
    <input id="nutrientTdsSupplyInput" type="text" value="5V">
    <input id="nutrientBeforeDashboardValuesInput" type="text">
    <button id="fillNutrientBeforeButton" type="button">Fill Before From Latest 5 Logs</button>
    <input id="nutrientPumpAMlInput" type="number" value="1">
    <input id="nutrientPumpBMlInput" type="number" value="1">
    <input id="nutrientPumpADurationInput" type="number" value="500">
    <input id="nutrientPumpBDurationInput" type="number" value="556">
    <input id="nutrientAfter15DashboardValuesInput" type="text">
    <button id="saveNutrientResponseButton" type="submit">Save Nutrient Response Test</button>
  </form>
  <tbody id="nutrientResponseHistoryBody"></tbody>
</section>
```

```js
async function saveNutrientResponseTest() {
  const payload = buildNutrientResponsePayload();

  const response = await fetch(`/api/devices/${DEVICE_ID}/nutrient-response-tests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  await loadNutrientResponseData();
}
```

## 7. Auto Dosing V2 Closed-loop Step Dosing

### Default Settings

```js
const DEFAULT_SETTINGS = {
  mode: 'closed_loop_step',
  enabled: false,
  targetMinPpm: 800,
  targetMaxPpm: 1200,
  stepDoseMlPerPump: 1.0,
  doseMlPerPump: 1.0,
  mixingDelayMs: 900000,
  cooldownMs: 900000,
  maxDoseMlPerPumpPerRun: 1.0,
  maxDailyDoseMlPerPump: 10.0,
  requireMainPumpOn: true,
  responseEstimatePpmPerMl: 30,
  responseEstimateWorkingLevelLiters: 16,
};
```

### Settings Validator

```js
const mode = typeof payload.mode === 'string' && payload.mode.trim().length > 0
  ? payload.mode.trim()
  : DEFAULT_MODE;
const stepDoseMlPerPump = pickPositiveNumber(payload.stepDoseMlPerPump, payload.doseMlPerPump);
const mixingDelayMs = pickPositiveNumber(payload.mixingDelayMs, payload.cooldownMs);

if (mode !== DEFAULT_MODE) {
  errors.push('mode must be closed_loop_step');
}

if (typeof enabled !== 'boolean') {
  errors.push('enabled must be boolean');
}

if (stepDoseMlPerPump > maxDoseMlPerPumpPerRun) {
  errors.push('stepDoseMlPerPump must be less than or equal to maxDoseMlPerPumpPerRun');
}

if (stepDoseMlPerPump > maxDailyDoseMlPerPump) {
  errors.push('stepDoseMlPerPump must be less than or equal to maxDailyDoseMlPerPump');
}
```

### Evaluation on Sensor Payload and Skip Reasons

```js
async function evaluateAutoDosing(sensorPayload, publishPumpCommandFn) {
  const deviceId = sensorPayload && sensorPayload.deviceId;
  const settings = await getAutoDosingSettings(deviceId);
  const device = await database.collection('devices').findOne({ deviceId });
  const latest = device && device.latest ? device.latest : {};
  const tdsPpm = latest.tdsPpm;
  const activeRun = await getActiveDosingRun(deviceId);

  if (activeRun && activeRun.status === 'mixing_wait') {
    if (!mixingUntil || now < mixingUntil) {
      await updateLastEvaluation(deviceId, 'mixing_wait_active', tdsPpm);
      return buildSkipResult('mixing_wait_active', tdsPpm);
    }
    return finalizeMixingRun(activeRun, latest, tdsPpm);
  }

  if (!settings.enabled) return buildSkipResult('disabled');
  if (!isFiniteNumber(tdsPpm)) return buildSkipResult('tds_ppm_missing');
  if (latest.waterLevel !== 'normal') return buildSkipResult('water_level_low', tdsPpm);
  if (latest.waterTempValid !== true) return buildSkipResult('water_temp_invalid', tdsPpm);
  if (latest.tdsStable === false) return buildSkipResult('tds_unstable', tdsPpm);
  if (settings.requireMainPumpOn && latest.pumpMain !== true) {
    return buildSkipResult('main_pump_not_running', tdsPpm);
  }
  if (!pumpAFlowRateMlPerSec || !pumpBFlowRateMlPerSec) {
    return buildSkipResult('pump_calibration_missing', tdsPpm);
  }
  if (activeRun) return buildSkipResult('dosing_run_active', tdsPpm);
  if (dailyDoseUsed + settings.stepDoseMlPerPump > settings.maxDailyDoseMlPerPump) {
    return buildSkipResult('daily_dose_limit_reached', tdsPpm);
  }
  if (tdsPpm > settings.targetMaxPpm) return buildSkipResult('above_target_range', tdsPpm);
  if (tdsPpm >= settings.targetMinPpm) return buildSkipResult('within_target_range', tdsPpm);

  // If still below target, start one small step only.
}
```

Implemented skip reasons:

- `disabled`
- `water_level_low`
- `water_temp_invalid`
- `tds_ppm_missing`
- `tds_unstable`
- `main_pump_not_running`
- `pump_calibration_missing`
- `dosing_run_active`
- `mixing_wait_active`
- `daily_dose_limit_reached`
- `within_target_range`
- `above_target_range`

### Start One Small Step

```js
const durationMsA = calculatePumpDurationMs(settings.stepDoseMlPerPump, pumpAFlowRateMlPerSec);
const durationMsB = calculatePumpDurationMs(settings.stepDoseMlPerPump, pumpBFlowRateMlPerSec);

const dosingRun = {
  runId,
  deviceId,
  mode: 'closed_loop_step',
  status: 'in_progress',
  tdsPpmAtStart: tdsPpm,
  stepDoseMlPerPump: settings.stepDoseMlPerPump,
  mixingDelayMs: settings.mixingDelayMs,
  dailyDoseUsedBefore: Number(dailyDoseUsed.toFixed(2)),
  pumpA: { commandId: pumpACommandId, durationMs: durationMsA, status: 'pending' },
  pumpB: { commandId: null, durationMs: durationMsB, status: 'pending' },
  currentStep: 'pumpA',
  mixingStartedAt: null,
  mixingUntil: null,
  tdsPpmAfterMixing: null,
  deltaTdsPpm: null,
  completedAt: null,
};

await database.collection('dosing_runs').insertOne(dosingRun);
await publishPumpCommandFn(buildPumpCommand(pumpACommandId, deviceId, 'A', durationMsA));
```

### Pump A then Pump B Sequencing

```js
if (commandId === run.pumpA.commandId && isCompletedPumpStatus(pumpStatusPayload)) {
  pumpBCommandId = await publishPumpBForRun(run, publishPumpCommandFn);
  return { action: 'pumpB_published', runId: run.runId, pumpBCommandId };
}

async function publishPumpBForRun(run, publishPumpCommandFn) {
  const pumpBCommandId = createCommandId();
  await publishPumpCommandFn(buildPumpCommand(pumpBCommandId, run.deviceId, 'B', run.pumpB.durationMs));

  await database.collection('dosing_runs').updateOne(
    { runId: run.runId, status: 'in_progress' },
    {
      $set: {
        'pumpA.status': 'completed',
        'pumpB.commandId': pumpBCommandId,
        'pumpB.status': 'published',
        currentStep: 'pumpB',
      },
    },
  );
}
```

### Transition to Mixing Wait

```js
async function startMixingWait(run) {
  const mixingStartedAt = new Date();
  const mixingDelayMs = pickPositive(run.mixingDelayMs, DEFAULT_SETTINGS.mixingDelayMs);
  const mixingUntil = new Date(mixingStartedAt.getTime() + mixingDelayMs);

  await database.collection('dosing_runs').updateOne(
    { runId: run.runId, status: 'in_progress' },
    {
      $set: {
        status: 'mixing_wait',
        currentStep: 'mixing_wait',
        'pumpB.status': 'completed',
        mixingStartedAt,
        mixingUntil,
      },
    },
  );

  return mixingUntil;
}
```

### Finalize After Mixing Delay and Next Sensor Payload

```js
async function finalizeMixingRun(run, latest, tdsPpm) {
  const now = new Date();
  const deltaTdsPpm = isFiniteNumber(run.tdsPpmAtStart)
    ? Number((tdsPpm - run.tdsPpmAtStart).toFixed(2))
    : null;

  await database.collection('dosing_runs').updateOne(
    { runId: run.runId, status: 'mixing_wait' },
    {
      $set: {
        status: 'completed',
        currentStep: 'completed',
        tdsPpmAfterMixing: tdsPpm,
        deltaTdsPpm,
        waterLevelAfterMixing: latest.waterLevel,
        completedAt: now,
      },
    },
  );
}
```

### Daily Dose Calculation

```js
async function getDailyDoseUsedMlPerPump(deviceId, now) {
  const runs = await database.collection('dosing_runs')
    .find({
      deviceId,
      createdAt: { $gte: getStartOfLocalDay(now) },
      status: { $in: ['in_progress', 'mixing_wait', 'completed'] },
    })
    .toArray();

  return runs.reduce((total, run) => {
    const dose = pickPositive(run.stepDoseMlPerPump, pickPositive(run.doseMlPerPump, 0));
    return total + dose;
  }, 0);
}
```

## 8. Dashboard Auto Dosing V2 Changes

### Settings Fields

```html
<p class="form-subheading">Mode: Closed-loop Step Dosing V2</p>
<input id="autoDosingEnabledInput" type="checkbox">
<input id="autoTargetMinInput" type="number" value="800">
<input id="autoTargetMaxInput" type="number" value="1200">
<input id="autoDoseMlInput" type="number" value="1">
<input id="autoMixingDelayMinutesInput" type="number" value="15">
<input id="autoMaxDoseMlInput" type="number" value="1">
<input id="autoMaxDailyDoseMlInput" type="number" value="10">
<input id="autoRequireMainPumpOnInput" type="checkbox" checked>
<input id="autoResponseEstimateInput" type="number" value="30">
<input id="autoResponseWorkingLevelInput" type="number" value="16">
```

### Render Active Run, Mixing Countdown, Reason, Daily Dose

```js
byId('autoModeValue').textContent = formatValue(settings.mode || 'closed_loop_step');
byId('autoDosingEnabledValue').textContent = settings.enabled ? 'Enabled' : 'Disabled';
byId('autoDosingReasonValue').textContent = formatValue(settings.lastEvaluationReason);
byId('autoDosingTdsValue').textContent = formatNumberWithUnit(settings.lastEvaluationTdsPpm, 2, 'ppm');
byId('autoDailyDoseValue').textContent = formatNumberWithUnit(settings.lastDailyDoseUsedMlPerPump, 2, 'ml');

byId('autoDosingActiveRunValue').textContent = run
  ? `${formatValue(run.status)} | ${formatValue(run.currentStep)} | ${formatValue(run.runId)}`
  : 'None';

byId('autoMixingUntilValue').textContent = run && run.currentStep === 'mixing_wait'
  ? formatMixingCountdown(run.mixingUntil)
  : 'N/A';
```

### Save Payload

```js
body: JSON.stringify({
  mode: 'closed_loop_step',
  enabled,
  targetMinPpm,
  targetMaxPpm,
  stepDoseMlPerPump,
  doseMlPerPump: stepDoseMlPerPump,
  mixingDelayMs: Math.round(mixingDelayMinutes * 60000),
  cooldownMs: Math.round(mixingDelayMinutes * 60000),
  maxDoseMlPerPumpPerRun,
  maxDailyDoseMlPerPump,
  requireMainPumpOn,
  responseEstimatePpmPerMl,
  responseEstimateWorkingLevelLiters,
})
```

### Form Edit Guard Preserved

```js
let isAutoDosingFormDirty = false;
let isAutoDosingFormFocused = false;
let hasAutoDosingSettingsLoadedOnce = false;

function shouldUpdateAutoDosingFormInputs() {
  return !hasAutoDosingSettingsLoadedOnce || (!isAutoDosingFormDirty && !isAutoDosingFormFocused);
}

if (shouldUpdateAutoDosingFormInputs()) {
  byId('autoDosingEnabledInput').checked = settings.enabled === true;
  byId('autoDoseMlInput').value = formatNumber(settings.stepDoseMlPerPump || settings.doseMlPerPump, 2);
  byId('autoMixingDelayMinutesInput').value = Number.isFinite(mixingDelayMinutes) ? String(Math.round(mixingDelayMinutes)) : '15';
  hasAutoDosingSettingsLoadedOnce = true;
}
```

## 9. MongoDB Collections and Indexes

Collections used or added:

- `sensor_logs`
- `devices`
- `alerts`
- `pump_logs`
- `pump_calibrations`
- `tds_calibrations`
- `auto_dosing_settings`
- `dosing_runs`
- `nutrient_response_tests`

Index creation snippets:

```js
await database.collection('pump_logs').createIndex({ deviceId: 1, createdAt: -1 });
await database.collection('pump_logs').createIndex({ commandId: 1 });
await database.collection('auto_dosing_settings').createIndex({ deviceId: 1 }, { unique: true });
await database.collection('dosing_runs').createIndex({ deviceId: 1, createdAt: -1 });
await database.collection('dosing_runs').createIndex({ runId: 1 }, { unique: true });
await database.collection('dosing_runs').createIndex({ status: 1, deviceId: 1 });
await database.collection('nutrient_response_tests').createIndex({ deviceId: 1, createdAt: -1 });
await database.collection('nutrient_response_tests').createIndex({ testId: 1 }, { unique: true });
```

## 10. Manual Runtime Test Checklist and Results

Runtime hardware/MQTT/MongoDB tests have not been performed by Codex for this package.

### Test 1 - Sensor publish still works

Status: NOT TESTED

Evidence:

Paste latest sensor payload or MongoDB document.

### Test 2 - Existing pump pulse still works

Status: NOT TESTED

Evidence:

- main pulse:
- Pump A pulse:
- Pump B pulse:

### Test 3 - Main pump continuous ON/OFF

Status: NOT TESTED

Evidence:

Paste:

- Serial Monitor lines
- pump/status payload for set_on
- pump/status payload for set_off
- MongoDB pump_logs query result

### Test 4 - Reject invalid continuous control for Pump A/B

Status: NOT TESTED

Evidence:

Paste rejected payload/API response.

### Test 5 - Nutrient Response Logging

Status: NOT TESTED

Evidence:

Paste MongoDB document:

```javascript
db.nutrient_response_tests.find().sort({ createdAt: -1 }).limit(1)
```

### Test 6 - Auto Dosing V2 disabled

Status: NOT TESTED

Evidence:

Paste:

```javascript
db.auto_dosing_settings.findOne({ deviceId: "device001" })
db.dosing_runs.find().sort({ createdAt: -1 }).limit(3)
```

### Test 7 - Auto Dosing V2 main pump OFF safety

Status: NOT TESTED

Evidence:

Expected reason: `main_pump_not_running`

### Test 8 - Auto Dosing V2 clean-water one-step test

Status: NOT TESTED

Evidence:

Expected:

- Pump A runs first
- Pump B runs after Pump A completed
- run enters `mixing_wait`
- no second run during `mixing_wait`
- run completes after `mixingDelay` and next sensor payload

Paste:

```javascript
db.dosing_runs.find().sort({ createdAt: -1 }).limit(3)
db.pump_logs.find().sort({ createdAt: -1 }).limit(10)
```

## 11. Known Issues / Questions

- Runtime test not performed yet.
- Arduino firmware was not compiled by Codex because `arduino-cli` was not available in PATH.
- UI has not been visually browser-tested in this pass.
- Backend JS syntax checks passed, but no integration test server was run in this pass.
- Main pump ON is blocked by backend if latest device state is missing or water level is not `normal`.
- ESP32 also checks water level before accepting main pump `set on`.
- Direct manual MQTT publish of invalid Pump A/B `action: "set"` should be used to verify rejection.
- `tdsStable` is optional; Auto Dosing V2 only skips `tds_unstable` if `latest.tdsStable === false`.
- Auto Dosing V2 does not auto-start main pump.
- Nutrient response endpoint logs data only and does not publish pump commands.
- No authentication is implemented yet.

## 12. Exact Commands Used for Testing

Static/syntax commands run by Codex:

```powershell
node --check "public\app.js"
node --check "src\index.js"
node --check "src\httpServer.js"
node --check "src\mongoClient.js"
node --check "src\mqttClient.js"
node --check "src\routes\deviceRoutes.js"
node --check "src\services\autoDosingService.js"
node --check "src\services\nutrientResponseService.js"
node --check "src\services\pumpCommandService.js"
node --check "src\services\pumpLogService.js"
node --check "src\validators\autoDosingSettingsValidator.js"
node --check "src\validators\nutrientResponseTestValidator.js"
node --check "src\validators\pumpCommandValidator.js"
git diff --check
```

Dashboard ID reference check run by Codex:

```powershell
$app = Get-Content -Raw -Path "public\app.js"
$html = Get-Content -Raw -Path "public\index.html"
$ids = [System.Collections.Generic.HashSet[string]]::new()
[regex]::Matches($html, 'id="([^"]+)"') | ForEach-Object { [void]$ids.Add($_.Groups[1].Value) }
$refs = [regex]::Matches($app, "byId\('([^']+)'\)") | ForEach-Object { $_.Groups[1].Value }
$missing = $refs | Where-Object { -not $ids.Contains($_) } | Sort-Object -Unique
if ($missing) { Write-Error ("Missing IDs: " + ($missing -join ', ')); exit 1 }
Write-Output ("All byId refs found: " + (($refs | Sort-Object -Unique).Count))
```

Manual runtime commands to run later:

```powershell
npm start
mosquitto_sub -h localhost -t hydroponic/device001/pump/status -v
mosquitto_sub -h localhost -t hydroponic/device001/pump/cmd -v
curl http://localhost:3001/health
curl http://localhost:3001/api/devices/device001/latest
curl -X POST http://localhost:3001/api/devices/device001/pumps/main/state -H "Content-Type: application/json" -d "{\"state\":\"on\"}"
curl -X POST http://localhost:3001/api/devices/device001/pumps/main/state -H "Content-Type: application/json" -d "{\"state\":\"off\"}"
```

Manual MQTT rejection tests to run later:

```powershell
mosquitto_pub -h localhost -t hydroponic/device001/pump/cmd -m "{\"commandId\":\"cmd_test_set_a\",\"deviceId\":\"device001\",\"pump\":\"A\",\"action\":\"set\",\"state\":\"on\",\"source\":\"manual_test\"}"
mosquitto_pub -h localhost -t hydroponic/device001/pump/cmd -m "{\"commandId\":\"cmd_test_set_b\",\"deviceId\":\"device001\",\"pump\":\"B\",\"action\":\"set\",\"state\":\"on\",\"source\":\"manual_test\"}"
```

MongoDB queries to run later:

```javascript
use hydroponic_iot
db.sensor_logs.find().sort({ createdAt: -1 }).limit(1)
db.pump_logs.find().sort({ createdAt: -1 }).limit(10)
db.nutrient_response_tests.find().sort({ createdAt: -1 }).limit(1)
db.auto_dosing_settings.findOne({ deviceId: "device001" })
db.dosing_runs.find().sort({ createdAt: -1 }).limit(3)
db.devices.findOne({ deviceId: "device001" })
```

## 13. Final Notes for Reviewer

- Phase 20B keeps the current MongoDB prototype.
- Local dosing logic remains on the Hydroponic Edge AI Gateway / Local Control Server, represented by the local Node.js backend + MQTT broker + dashboard.
- Main pump continuous control is intentionally narrow: main pump only.
- Pump A/B stay pulse-only and sequential.
- Nutrient Response Logging is for experimental data capture only.
- Auto Dosing V2 avoids large one-shot dosing by using small closed-loop steps and waiting for mixing before re-evaluating TDS.
