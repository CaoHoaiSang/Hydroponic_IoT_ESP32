const DEVICE_ID = 'device001';
const REFRESH_INTERVAL_MS = 5000;

let isLoading = false;
let hasLoadedOnce = false;
let latestDeviceStatus = null;
let isAutoDosingFormDirty = false;
let isAutoDosingFormFocused = false;
let hasAutoDosingSettingsLoadedOnce = false;
let lastSavedAutoDosingEnabled = false;
let latestAutoDosingRuns = [];
let latestAutoDosingEvents = [];
let selectedTdsCalibrationSetId = '';
let latestAutoDosingReadiness = null;

function byId(id) {
  return document.getElementById(id);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    const message = data.message || data.error || `Request failed: ${url}`;
    throw new Error(message);
  }

  return data;
}

function formatDate(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
}

function formatNumber(value, digits) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A';
  }

  return Number(value).toFixed(digits);
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  return String(value);
}

function formatYesNo(value) {
  if (value === true) {
    return 'Yes';
  }

  if (value === false) {
    return 'No';
  }

  return 'N/A';
}

function formatCalibrationWarning(value) {
  if (!value) {
    return 'None';
  }

  return String(value);
}

function formatNumberWithUnit(value, digits, unit) {
  const formatted = formatNumber(value, digits);

  if (formatted === 'N/A') {
    return formatted;
  }

  return `${formatted} ${unit}`;
}

function formatBoolOnOff(value) {
  if (typeof value !== 'boolean') {
    return 'N/A';
  }

  return value ? 'ON' : 'OFF';
}

function formatUptime(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A';
  }

  const totalSeconds = Math.max(0, Math.floor(Number(value) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} s`;
  }

  return `${minutes}m ${seconds}s`;
}

function setBadge(elementId, isOk, text) {
  const element = byId(elementId);
  element.classList.remove('badge-ok', 'badge-error', 'badge-neutral', 'badge-warning');

  if (isOk === true) {
    element.classList.add('badge-ok');
  } else if (isOk === false) {
    element.classList.add('badge-error');
  } else {
    element.classList.add('badge-neutral');
  }

  element.textContent = text;
}

function setMessage(text, state) {
  const messageBar = byId('messageBar');
  messageBar.classList.remove('ok', 'error');

  if (state) {
    messageBar.classList.add(state);
  }

  messageBar.textContent = text;
}

function setPumpBadge(elementId, value) {
  const text = formatBoolOnOff(value);
  const isOn = value === true;
  const element = byId(elementId);

  element.classList.remove('badge-ok', 'badge-error', 'badge-neutral', 'badge-warning');
  element.classList.add(isOn ? 'badge-ok' : 'badge-neutral');
  element.textContent = text;
}

function renderHealth(data) {
  setBadge('healthBadge', data.ok === true, data.ok ? 'Backend OK' : 'Backend error');
  setBadge('mqttBadge', data.mqttConnected === true, data.mqttConnected ? 'MQTT online' : 'MQTT offline');
  setBadge('mongoBadge', data.mongoConnected === true, data.mongoConnected ? 'MongoDB online' : 'MongoDB offline');
}

function renderLatest(data) {
  const latest = data.latest || {};

  byId('deviceIdLabel').textContent = data.deviceId || DEVICE_ID;
  latestDeviceStatus = latest;
  byId('tdsRawValue').textContent = formatNumber(latest.tdsRaw, 0);
  byId('tdsVoltageValue').textContent = formatNumberWithUnit(latest.tdsVoltage, 3, 'V');
  byId('tdsPpmValue').textContent = formatNumberWithUnit(latest.tdsPpm, 2, 'ppm');
  byId('currentTdsRawVoltage').textContent = formatNumberWithUnit(latest.tdsVoltage, 3, 'V');
  byId('currentTdsVoltage25').textContent = formatNumberWithUnit(latest.tdsVoltage25, 3, 'V');
  byId('currentTdsTempComp').textContent = formatYesNo(latest.tdsTemperatureCompensated);
  byId('currentTdsTempCoeff').textContent = formatNumber(latest.tdsTemperatureAlphaPerC, 3);
  byId('currentTdsTempReference').textContent = formatNumberWithUnit(latest.tdsTemperatureReferenceC, 1, 'C');
  byId('currentTdsPpmValue').textContent = formatNumberWithUnit(latest.tdsPpm, 2, 'ppm');
  byId('currentTdsMode').textContent = formatValue(latest.tdsCalibrationMode);
  byId('currentTdsPointCount').textContent = formatNumber(latest.tdsCalibrationPointCount, 0);
  byId('currentTdsInRange').textContent = formatYesNo(latest.tdsCalibrationInRange);
  byId('currentTdsWarning').textContent = formatCalibrationWarning(latest.tdsCalibrationWarning);
  byId('qualityTdsRawVoltage').textContent = formatNumberWithUnit(latest.tdsVoltage, 3, 'V');
  byId('qualityTdsVoltage25').textContent = formatNumberWithUnit(latest.tdsVoltage25, 3, 'V');
  byId('qualityEcValue').textContent = formatNumberWithUnit(latest.ecUsCm, 2, 'uS/cm');
  byId('qualityTdsPpm').textContent = formatNumberWithUnit(latest.tdsPpm, 2, 'ppm');
  byId('qualityTempAlpha').textContent = formatNumberWithUnit(latest.tdsTemperatureAlphaPerC, 3, '/C');
  byId('qualityTempFactor').textContent = formatNumber(latest.tdsTemperatureFactorUsed, 4);
  byId('qualityWindowStable').textContent = formatYesNo(latest.tdsWindowStable);
  byId('qualityBackendStable').textContent = formatYesNo(latest.tdsStable);
  byId('qualityStabilitySpread').textContent = `${formatNumber(latest.tdsStabilitySpreadPpm, 2)} / ${formatNumber(latest.tdsStabilityThresholdPpm, 2)} ppm`;
  byId('qualityControlValid').textContent = formatYesNo(latest.tdsControlValid);
  byId('qualityCalibrationWarning').textContent = formatCalibrationWarning(latest.tdsCalibrationWarning);
  byId('qualityControlReasons').textContent = Array.isArray(latest.tdsControlInvalidReasons)
    && latest.tdsControlInvalidReasons.length > 0
    ? latest.tdsControlInvalidReasons.join(', ')
    : 'None';
  byId('waterTempValue').textContent = formatNumberWithUnit(latest.waterTemp, 2, 'C');
  byId('phValue').textContent = formatValue(latest.ph);
  byId('lastSeenMeta').textContent = `Last seen: ${formatDate(data.lastSeenAt)}`;
  byId('lastSeenValue').textContent = formatDate(data.lastSeenAt);

  const waterLevel = formatValue(latest.waterLevel);
  const waterLevelElement = byId('waterLevelBadge');
  waterLevelElement.classList.remove('badge-ok', 'badge-error', 'badge-neutral', 'badge-warning');

  if (latest.waterLevel === 'normal') {
    waterLevelElement.classList.add('badge-ok');
  } else if (latest.waterLevel === 'low' || latest.waterLevel === 'error') {
    waterLevelElement.classList.add('badge-error');
  } else {
    waterLevelElement.classList.add('badge-neutral');
  }

  waterLevelElement.textContent = waterLevel;

  setPumpBadge('pumpMainBadge', latest.pumpMain);
  setPumpBadge('pumpABadge', latest.pumpA);
  setPumpBadge('pumpBBadge', latest.pumpB);
  setPumpBadge('pumpSpareBadge', latest.pumpSpare);
  byId('mainPumpContinuousValue').textContent = formatBoolOnOff(latest.pumpMain);
}

function renderTelemetryIdentity(latestData, logsData) {
  const latest = latestData && latestData.latest ? latestData.latest : {};
  const logs = logsData && Array.isArray(logsData.data) ? logsData.data : [];
  const received = logs[0] || latest;
  const isLegacy = received.schemaVersion !== 2;
  const orderStatus = isLegacy
    ? (received.telemetryOrderStatus || 'LEGACY_NO_IDENTITY')
    : (received.telemetryOrderStatus || 'INVALID');

  byId('telemetrySchemaValue').textContent = isLegacy ? 'Legacy' : formatNumber(received.schemaVersion, 0);
  byId('telemetryMeasurementIdValue').textContent = formatValue(received.measurementId);
  byId('telemetryBootIdValue').textContent = formatValue(received.bootId);
  byId('telemetrySeqValue').textContent = formatNumber(received.measurementSeq, 0);
  byId('telemetrySampledUptimeValue').textContent = formatUptime(received.sampledAtUptimeMs);
  byId('telemetryOrderValue').textContent = orderStatus;
  byId('telemetryIdentityValue').textContent = formatYesNo(received.telemetryIdentityValid);
  byId('telemetryDuplicateValue').textContent = formatYesNo(received.telemetryDuplicate);
  byId('telemetryControlValue').textContent = formatYesNo(latest.controlEligible);
  byId('telemetryRawValue').textContent = `${formatNumber(latest.tdsRaw, 0)} / ${formatNumberWithUnit(latest.tdsVoltage, 3, 'V')}`;
  byId('telemetryEcValue').textContent = formatNumberWithUnit(latest.ecUsCm, 2, 'uS/cm');
  byId('telemetryPpmValue').textContent = formatNumberWithUnit(latest.tdsPpm, 2, 'ppm');
  byId('telemetrySetValue').textContent = formatValue(latest.tdsCalibrationSetId);
  byId('telemetrySampleCountValue').textContent = formatNumber(latest.tdsSampleCount, 0);
  byId('telemetryDistinctCountValue').textContent = formatNumber(latest.tdsStabilityDistinctMeasurementCount, 0);
  byId('telemetryStableValue').textContent = formatYesNo(latest.tdsStable);
  byId('telemetryLegacyStatus').textContent = isLegacy
    ? 'Latest received telemetry is legacy and remains excluded from stability, Shadow eligibility, and control.'
    : `Latest received classification: ${orderStatus}. devices.latest changes only for ACCEPTED V2 measurements.`;
}

function renderShadowGates(gates) {
  const body = byId('shadowGatesBody');
  body.textContent = '';
  const rows = Array.isArray(gates) ? gates : [];
  if (rows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No Shadow decision yet';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  for (const item of rows) {
    const row = document.createElement('tr');
    appendCell(row, formatValue(item.code));
    appendCell(row, formatValue(item.status));
    appendCell(row, formatValue(item.reasonCode));
    appendCell(row, formatValue(item.detail));
    body.appendChild(row);
  }
}

function formatHypotheticalDose(decision) {
  if (!decision || decision.hypotheticalDoseMlPerPump === null
    || decision.hypotheticalDoseMlPerPump === undefined) return 'N/A';
  return `${formatNumber(decision.hypotheticalDoseMlPerPump, 2)} ml each / A ${formatNumber(decision.hypotheticalPumpADurationMs, 0)} ms / B ${formatNumber(decision.hypotheticalPumpBDurationMs, 0)} ms`;
}

function renderShadowData(statusData, decisionsData) {
  const status = statusData.data || {};
  const decisions = Array.isArray(decisionsData.data) ? decisionsData.data : [];
  const latest = status.latestDecision || decisions[0] || null;
  byId('phase22AutoDosingValue').textContent = status.autoDosing || 'OFF';
  byId('shadowModeValue').textContent = status.enabled === true ? 'ON' : 'OFF';
  byId('shadowSectionStatus').textContent = status.enabled === true
    ? 'Shadow Mode ON - observation only'
    : 'Shadow Mode OFF - set SHADOW_MODE_ENABLED=true to observe';
  byId('shadowDecisionValue').textContent = latest ? formatValue(latest.decision) : 'N/A';
  byId('shadowPrimaryReasonValue').textContent = latest ? formatValue(latest.primaryReasonCode) : 'N/A';
  byId('shadowReasonsValue').textContent = latest && Array.isArray(latest.reasonCodes) && latest.reasonCodes.length
    ? latest.reasonCodes.join(', ') : 'None';
  byId('shadowActionValue').textContent = latest ? formatValue(latest.hypotheticalAction) : 'N/A';
  byId('shadowDoseValue').textContent = formatHypotheticalDose(latest);
  byId('shadowDecisionTimeValue').textContent = latest ? formatDate(latest.createdAt) : 'N/A';
  renderShadowGates(latest && latest.gates);

  const body = byId('shadowDecisionsBody');
  body.textContent = '';
  if (decisions.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'No Shadow decisions recorded';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  for (const decision of decisions) {
    const row = document.createElement('tr');
    appendCell(row, formatDate(decision.createdAt));
    appendCell(row, formatValue(decision.measurementId));
    appendCell(row, formatValue(decision.decision));
    appendCell(row, formatValue(decision.primaryReasonCode));
    appendCell(row, formatValue(decision.hypotheticalAction));
    appendCell(row, formatHypotheticalDose(decision));
    body.appendChild(row);
  }
}

async function loadShadowData() {
  const [status, decisions] = await Promise.all([
    fetchJson(`/api/devices/${DEVICE_ID}/shadow-mode/status`),
    fetchJson(`/api/devices/${DEVICE_ID}/shadow-mode/decisions?limit=20`),
  ]);
  renderShadowData(status, decisions);
}

function appendAlertCell(card, label, value) {
  const cell = document.createElement('div');
  cell.className = 'alert-cell';

  const labelElement = document.createElement('span');
  labelElement.className = 'alert-label';
  labelElement.textContent = label;

  const valueElement = document.createElement('span');
  valueElement.className = 'alert-value';
  valueElement.textContent = value;

  cell.appendChild(labelElement);
  cell.appendChild(valueElement);
  card.appendChild(cell);
}

function renderAlerts(data) {
  const alerts = Array.isArray(data.data) ? data.data : [];
  const panel = byId('alertsPanel');
  panel.textContent = '';

  byId('alertsStatus').textContent = `${alerts.length} active`;

  if (alerts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No active alerts';
    panel.appendChild(empty);
    return;
  }

  alerts.forEach((alert) => {
    const card = document.createElement('article');
    card.className = 'alert-card';

    appendAlertCell(card, 'Type', formatValue(alert.type));
    appendAlertCell(card, 'Level', formatValue(alert.level));
    appendAlertCell(card, 'Message', formatValue(alert.message));
    appendAlertCell(card, 'Status', formatValue(alert.status));
    appendAlertCell(card, 'Last Seen', formatDate(alert.lastSeenAt));
    appendAlertCell(card, 'Resolved At', formatDate(alert.resolvedAt));

    panel.appendChild(card);
  });
}

function appendCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.appendChild(cell);
}

function renderLogs(data) {
  const logs = Array.isArray(data.data) ? data.data : [];
  const tableBody = byId('logsTableBody');
  tableBody.textContent = '';

  byId('logsStatus').textContent = `Latest ${logs.length} logs`;

  if (logs.length === 0) {
    const row = document.createElement('tr');
    appendCell(row, 'No sensor logs yet');
    row.firstChild.colSpan = 10;
    tableBody.appendChild(row);
    return;
  }

  logs.forEach((log) => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(log.createdAt));
    appendCell(row, formatNumber(log.tdsRaw, 0));
    appendCell(row, formatNumber(log.tdsVoltage, 3));
    appendCell(row, formatNumber(log.tdsPpm, 2));
    appendCell(row, formatNumber(log.waterTemp, 2));
    appendCell(row, formatValue(log.waterLevel));
    appendCell(row, formatBoolOnOff(log.pumpMain));
    appendCell(row, formatBoolOnOff(log.pumpA));
    appendCell(row, formatBoolOnOff(log.pumpB));
    appendCell(row, formatUptime(log.uptimeMs));
    tableBody.appendChild(row);
  });
}

function renderLatestTdsCalibration(data) {
  const calibration = data.data || null;

  byId('latestTdsFactor').textContent = calibration
    ? formatNumberWithUnit(calibration.calibrationFactor, 3, 'ppm/V')
    : 'N/A';
  byId('latestTdsReferencePpm').textContent = calibration
    ? formatNumberWithUnit(calibration.referenceTdsPpm, 1, 'ppm')
    : 'N/A';
  byId('latestTdsMeasuredVoltage').textContent = calibration
    ? formatNumberWithUnit(calibration.measuredVoltage, 3, 'V')
    : 'N/A';
  byId('latestTdsMeasuredVoltage25').textContent = calibration
    ? formatNumberWithUnit(calibration.measuredVoltage25, 3, 'V')
    : 'N/A';
  byId('latestTdsWaterTemp').textContent = calibration
    ? formatNumberWithUnit(calibration.waterTemp, 2, 'C')
    : 'N/A';
  byId('latestTdsCalibratedAt').textContent = calibration
    ? formatDate(calibration.createdAt)
    : 'N/A';
}

function renderTdsCalibrationHistory(data) {
  const rows = Array.isArray(data.data) ? data.data : [];
  const tableBody = byId('tdsCalibrationHistoryBody');

  tableBody.textContent = '';
  byId('tdsCalibrationHistoryStatus').textContent = `Latest ${rows.length} TDS calibration rows`;

  if (rows.length === 0) {
    const row = document.createElement('tr');
    appendCell(row, 'No TDS calibration saved yet');
    row.firstChild.colSpan = 8;
    tableBody.appendChild(row);
    return;
  }

  rows.forEach((calibration) => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(calibration.createdAt));
    appendCell(row, formatNumber(calibration.measuredRaw, 0));
    appendCell(row, formatNumber(calibration.measuredVoltage, 3));
    appendCell(row, formatNumber(calibration.measuredVoltage25, 3));
    appendCell(row, formatNumber(calibration.referenceTdsPpm, 1));
    appendCell(row, formatNumber(calibration.calibrationFactor, 3));
    appendCell(row, formatNumber(calibration.waterTemp, 2));
    appendCell(row, formatValue(calibration.note));
    tableBody.appendChild(row);
  });
}

function renderLatestCalibrations(data) {
  const calibrations = data.data || {};
  const pumpA = calibrations.A || null;
  const pumpB = calibrations.B || null;

  byId('latestPumpAFlow').textContent = pumpA
    ? formatNumberWithUnit(pumpA.flowRateMlPerSec, 3, 'ml/s')
    : 'N/A';
  byId('latestPumpATime').textContent = `Last calibrated: ${formatDate(pumpA && pumpA.createdAt)}`;

  byId('latestPumpBFlow').textContent = pumpB
    ? formatNumberWithUnit(pumpB.flowRateMlPerSec, 3, 'ml/s')
    : 'N/A';
  byId('latestPumpBTime').textContent = `Last calibrated: ${formatDate(pumpB && pumpB.createdAt)}`;
}

function renderCalibrationHistory(pumpAData, pumpBData) {
  const pumpAHistory = Array.isArray(pumpAData.data) ? pumpAData.data : [];
  const pumpBHistory = Array.isArray(pumpBData.data) ? pumpBData.data : [];
  const rows = pumpAHistory
    .concat(pumpBHistory)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);
  const tableBody = byId('calibrationHistoryBody');

  tableBody.textContent = '';
  byId('calibrationHistoryStatus').textContent = `Latest ${rows.length} calibration rows`;

  if (rows.length === 0) {
    const row = document.createElement('tr');
    appendCell(row, 'No pump calibration saved yet');
    row.firstChild.colSpan = 6;
    tableBody.appendChild(row);
    return;
  }

  rows.forEach((calibration) => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(calibration.createdAt));
    appendCell(row, formatValue(calibration.pump));
    appendCell(row, formatNumber(calibration.durationMs, 0));
    appendCell(row, formatNumber(calibration.measuredMl, 2));
    appendCell(row, formatNumber(calibration.flowRateMlPerSec, 3));
    appendCell(row, formatValue(calibration.note));
    tableBody.appendChild(row);
  });
}

function getRange(values) {
  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  return { min, max };
}

function scaleY(value, range, top, height) {
  const ratio = (value - range.min) / (range.max - range.min);
  return top + height - ratio * height;
}

function buildPolyline(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

function renderTrend(data) {
  const logs = (Array.isArray(data.data) ? data.data : [])
    .slice()
    .reverse()
    .filter((log) => typeof log.tdsRaw === 'number' || typeof log.waterTemp === 'number');

  const svg = byId('trendSvg');
  svg.textContent = '';

  const width = 640;
  const height = 180;
  const padding = 24;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  if (logs.length < 2) {
    byId('trendSummary').textContent = 'Need at least 2 logs for trend preview';
    return;
  }

  const tdsValues = logs.map((log) => log.tdsRaw).filter((value) => typeof value === 'number');
  const tempValues = logs.map((log) => log.waterTemp).filter((value) => typeof value === 'number');
  const tdsRange = getRange(tdsValues);
  const tempRange = getRange(tempValues);

  const step = plotWidth / Math.max(1, logs.length - 1);
  const tdsPoints = [];
  const tempPoints = [];

  logs.forEach((log, index) => {
    const x = padding + step * index;

    if (typeof log.tdsRaw === 'number') {
      tdsPoints.push({
        x,
        y: scaleY(log.tdsRaw, tdsRange, padding, plotHeight),
      });
    }

    if (typeof log.waterTemp === 'number') {
      tempPoints.push({
        x,
        y: scaleY(log.waterTemp, tempRange, padding, plotHeight),
      });
    }
  });

  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  grid.setAttribute('d', `M ${padding} ${padding} H ${width - padding} M ${padding} ${height / 2} H ${width - padding} M ${padding} ${height - padding} H ${width - padding}`);
  grid.setAttribute('stroke', '#d8e0dc');
  grid.setAttribute('stroke-width', '1');
  svg.appendChild(grid);

  [
    { points: tdsPoints, color: '#2c7a5b' },
    { points: tempPoints, color: '#b65f2a' },
  ].forEach((series) => {
    if (series.points.length < 2) {
      return;
    }

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', buildPolyline(series.points));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', series.color);
    polyline.setAttribute('stroke-width', '3');
    polyline.setAttribute('stroke-linejoin', 'round');
    polyline.setAttribute('stroke-linecap', 'round');
    svg.appendChild(polyline);
  });

  const latest = logs[logs.length - 1];
  byId('trendSummary').textContent = `Recent ${logs.length} logs | TDS ${formatNumber(latest.tdsRaw, 0)} | Temp ${formatNumberWithUnit(latest.waterTemp, 2, 'C')}`;
}

function setMainPumpStateButtonsDisabled(disabled) {
  byId('mainPumpOnButton').disabled = disabled;
  byId('mainPumpOffButton').disabled = disabled;
}

async function sendMainPumpState(state) {
  setMainPumpStateButtonsDisabled(true);
  setMessage(`Sending main pump ${state.toUpperCase()} command...`);

  try {
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

    if (!response.ok || data.ok === false) {
      const errorText = Array.isArray(data.errors) ? data.errors.join('; ') : (data.message || data.error || 'request failed');
      throw new Error(errorText);
    }

    byId('mainPumpLastCommandValue').textContent = `${state.toUpperCase()} sent: ${data.command.commandId}`;
    byId('mainPumpContinuousStatus').textContent = `Last command: ${state.toUpperCase()}`;
    await loadDashboard();
    setMessage(`Main pump ${state.toUpperCase()} command sent.`, 'ok');
  } catch (error) {
    byId('mainPumpLastCommandValue').textContent = `Error: ${error.message}`;
    setMessage(`Main pump command error: ${error.message}`, 'error');
  } finally {
    setMainPumpStateButtonsDisabled(false);
  }
}

function bindMainPumpStateControls() {
  byId('mainPumpOnButton').addEventListener('click', () => {
    sendMainPumpState('on');
  });

  byId('mainPumpOffButton').addEventListener('click', () => {
    sendMainPumpState('off');
  });
}

function setManualButtonsDisabled(disabled) {
  byId('pulseMainButton').disabled = disabled;
  byId('pulseAButton').disabled = disabled;
  byId('pulseBButton').disabled = disabled;
}

async function sendPumpCommand(pump, durationMs) {
  const parsedDuration = Number.parseInt(durationMs, 10);

  if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
    setMessage('Pump command error: duration must be greater than 0 ms.', 'error');
    return;
  }

  setManualButtonsDisabled(true);
  setMessage(`Sending ${pump} pulse command...`);

  try {
    const response = await fetch(`/api/devices/${DEVICE_ID}/pump-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        pump,
        action: 'pulse',
        durationMs: parsedDuration,
        reason: 'manual_dashboard',
      }),
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      const errorText = Array.isArray(data.errors) ? data.errors.join('; ') : (data.message || data.error || 'request failed');
      throw new Error(errorText);
    }

    await loadDashboard();
    setMessage(`Pump command sent: ${data.command.commandId}`, 'ok');
  } catch (error) {
    setMessage(`Pump command error: ${error.message}`, 'error');
  } finally {
    setManualButtonsDisabled(false);
  }
}

function bindManualPumpControls() {
  byId('pulseMainButton').addEventListener('click', () => {
    sendPumpCommand('main', byId('mainDurationInput').value);
  });

  byId('pulseAButton').addEventListener('click', () => {
    sendPumpCommand('A', byId('pumpADurationInput').value);
  });

  byId('pulseBButton').addEventListener('click', () => {
    sendPumpCommand('B', byId('pumpBDurationInput').value);
  });
}

function setCalibrationFormDisabled(disabled) {
  byId('saveCalibrationButton').disabled = disabled;
}

async function loadCalibrationData() {
  const [latestCalibrations, pumpAHistory, pumpBHistory] = await Promise.all([
    fetchJson(`/api/devices/${DEVICE_ID}/pump-calibrations/latest`),
    fetchJson(`/api/devices/${DEVICE_ID}/pump-calibrations/A?limit=10`),
    fetchJson(`/api/devices/${DEVICE_ID}/pump-calibrations/B?limit=10`),
  ]);

  renderLatestCalibrations(latestCalibrations);
  renderCalibrationHistory(pumpAHistory, pumpBHistory);
  byId('calibrationStatus').textContent = 'Latest calibration loaded';
}

async function savePumpCalibration() {
  const pump = byId('calibrationPumpSelect').value;
  const durationMs = Number(byId('calibrationDurationInput').value);
  const measuredMl = Number(byId('calibrationMeasuredInput').value);
  const note = byId('calibrationNoteInput').value;

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    setMessage('Calibration error: duration must be greater than 0 ms.', 'error');
    return;
  }

  if (!Number.isFinite(measuredMl) || measuredMl <= 0) {
    setMessage('Calibration error: measured ml must be greater than 0.', 'error');
    return;
  }

  setCalibrationFormDisabled(true);
  setMessage(`Saving Pump ${pump} calibration...`);

  try {
    const response = await fetch(`/api/devices/${DEVICE_ID}/pump-calibration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        pump,
        durationMs,
        measuredMl,
        method: 'manual_graduated_cup',
        note,
      }),
    });
    const data = await response.json();

    if (!response.ok || data.ok === false) {
      const errorText = Array.isArray(data.errors) ? data.errors.join('; ') : (data.message || data.error || 'request failed');
      throw new Error(errorText);
    }

    await loadCalibrationData();
    byId('calibrationMeasuredInput').value = '';
    setMessage(`Pump ${pump} calibration saved: ${formatNumberWithUnit(data.data.flowRateMlPerSec, 3, 'ml/s')}`, 'ok');
  } catch (error) {
    setMessage(`Calibration error: ${error.message}`, 'error');
  } finally {
    setCalibrationFormDisabled(false);
  }
}

function bindCalibrationControls() {
  byId('calibrationForm').addEventListener('submit', (event) => {
    event.preventDefault();
    savePumpCalibration();
  });
}

function setTdsCalibrationFormDisabled(disabled) {
  ['createTdsSetButton', 'validateTdsSetButton', 'activateTdsSetButton', 'retireTdsSetButton',
    'ecUseLatestTdsButton', 'addTdsPointButton'].forEach((id) => {
    byId(id).disabled = disabled;
  });
}

function setNumberInputFromLatest(inputId, value, digits) {
  const element = byId(inputId);

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    element.value = '';
    return;
  }

  element.value = digits === 0 ? String(Math.round(value)) : value.toFixed(digits);
}

async function loadTdsCalibrationData() {
  const [setsResponse, activeResponse, legacyResponse] = await Promise.all([
    fetchJson(`/api/devices/${DEVICE_ID}/tds-calibration-sets?limit=100`),
    fetchJson(`/api/devices/${DEVICE_ID}/tds-calibration-sets/active`),
    fetchJson(`/api/devices/${DEVICE_ID}/tds-calibrations?limit=10`),
  ]);
  const sets = Array.isArray(setsResponse.data) ? setsResponse.data : [];
  if (selectedTdsCalibrationSetId && !sets.some((set) => set.setId === selectedTdsCalibrationSetId)) {
    selectedTdsCalibrationSetId = '';
  }
  renderTdsSetOptions(sets);
  renderTdsCalibrationSets(sets);
  renderActiveTdsSet(activeResponse.data || null);
  renderLegacyTdsHistory(legacyResponse.data || []);
  if (selectedTdsCalibrationSetId) {
    const selected = await fetchJson(`/api/devices/${DEVICE_ID}/tds-calibration-sets/${encodeURIComponent(selectedTdsCalibrationSetId)}`);
    renderSelectedTdsSet(selected.data);
  } else {
    renderSelectedTdsSet(null);
  }
  byId('ecTdsCalibrationStatus').textContent = `${sets.length} calibration sets loaded`;
}

function fillTdsCalibrationFromLatest() {
  if (!latestDeviceStatus) {
    setMessage('TDS calibration error: latest device status is not loaded yet.', 'error');
    return;
  }

  setNumberInputFromLatest('ecTdsMeasuredRawInput', latestDeviceStatus.tdsRaw, 0);
  setNumberInputFromLatest('ecTdsMeasuredVoltageInput', latestDeviceStatus.tdsVoltage, 3);
  setNumberInputFromLatest('ecTdsWaterTempInput', latestDeviceStatus.waterTemp, 2);
  setMessage('Latest TDS raw, voltage, and water temperature copied into calibration form.', 'ok');
}

async function requestTdsCalibration(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(Array.isArray(data.errors) ? data.errors.join('; ') : (data.message || data.error || 'request failed'));
  }
  return data;
}

function renderTdsSetOptions(sets) {
  const select = byId('tdsSetSelect');
  select.textContent = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Select a set explicitly';
  select.appendChild(empty);
  sets.forEach((set) => {
    const option = document.createElement('option');
    option.value = set.setId;
    option.textContent = `${set.setId} (${set.status}, ${set.pointCount || 0} points)`;
    select.appendChild(option);
  });
  select.value = selectedTdsCalibrationSetId;
}

function renderTdsCalibrationSets(sets) {
  const body = byId('tdsCalibrationSetsBody');
  body.textContent = '';
  if (sets.length === 0) {
    const row = document.createElement('tr'); appendCell(row, 'No calibration sets'); row.firstChild.colSpan = 7; body.appendChild(row); return;
  }
  sets.forEach((set) => {
    const row = document.createElement('tr');
    appendCell(row, set.setId); appendCell(row, set.status); appendCell(row, formatNumber(set.pointCount, 0));
    appendCell(row, set.validationStatus); appendCell(row, `${formatNumber(set.minVoltage25, 3)} - ${formatNumber(set.maxVoltage25, 3)} V`);
    appendCell(row, `${formatNumber(set.minReferenceEcUsCm, 1)} - ${formatNumber(set.maxReferenceEcUsCm, 1)}`);
    appendCell(row, formatDate(set.createdAt)); body.appendChild(row);
  });
}

function renderActiveTdsSet(set) {
  byId('activeTdsSetSummary').textContent = set
    ? `${set.setId} | ${set.pointCount} points | EC ${formatNumber(set.minReferenceEcUsCm, 1)}-${formatNumber(set.maxReferenceEcUsCm, 1)} uS/cm | TDS ${formatNumber(set.minReferenceTdsPpm, 1)}-${formatNumber(set.maxReferenceTdsPpm, 1)} ppm`
    : 'No active calibration set';
}

function renderSelectedTdsSet(set) {
  const body = byId('tdsSetPointsBody'); body.textContent = '';
  byId('selectedTdsSetSummary').textContent = set
    ? `${set.setId} | ${set.status} | ${set.validationStatus} | ${(set.validationErrors || []).join(', ') || 'no validation errors'}`
    : 'No set selected';
  if (!set || !Array.isArray(set.points) || set.points.length === 0) {
    const row = document.createElement('tr'); appendCell(row, set ? 'No points in this set' : 'Select a calibration set'); row.firstChild.colSpan = 8; body.appendChild(row);
  } else {
    set.points.forEach((point) => {
      const row = document.createElement('tr');
      appendCell(row, formatDate(point.createdAt)); appendCell(row, formatNumber(point.measuredRaw, 0));
      appendCell(row, formatNumber(point.measuredVoltage, 3)); appendCell(row, formatNumber(point.measuredVoltage25, 3));
      appendCell(row, formatNumber(point.referenceEcUsCm, 1)); appendCell(row, formatNumber(point.referenceTdsPpm, 1));
      appendCell(row, formatNumber(point.waterTemp, 2)); appendCell(row, formatValue(point.note)); body.appendChild(row);
    });
  }
  byId('addTdsPointButton').disabled = !set || set.status !== 'draft';
  byId('validateTdsSetButton').disabled = !set || set.status !== 'draft';
  byId('activateTdsSetButton').disabled = !set || set.status !== 'draft';
  byId('retireTdsSetButton').disabled = !set || set.status === 'retired';
}

function renderLegacyTdsHistory(rows) {
  const body = byId('legacyTdsCalibrationBody'); body.textContent = '';
  const legacyRows = rows.filter((row) => !row.calibrationSetId);
  if (legacyRows.length === 0) {
    const row = document.createElement('tr'); appendCell(row, 'No legacy calibration rows'); row.firstChild.colSpan = 6; body.appendChild(row); return;
  }
  legacyRows.forEach((item) => {
    const row = document.createElement('tr'); appendCell(row, formatDate(item.createdAt)); appendCell(row, formatNumber(item.measuredRaw, 0));
    appendCell(row, formatNumber(item.measuredVoltage, 3)); appendCell(row, formatNumber(item.referenceTdsPpm, 1));
    appendCell(row, formatNumber(item.waterTemp, 2)); appendCell(row, formatValue(item.note)); body.appendChild(row);
  });
}

async function createTdsCalibrationSet() {
  const data = await requestTdsCalibration(`/api/devices/${DEVICE_ID}/tds-calibration-sets`, {
    method: 'POST', body: JSON.stringify({ referenceMeter: byId('tdsReferenceMeterInput').value, note: byId('tdsSetNoteInput').value }),
  });
  selectedTdsCalibrationSetId = data.data.setId;
  await loadTdsCalibrationData();
  setMessage(`Draft calibration set created: ${selectedTdsCalibrationSetId}`, 'ok');
}

async function addTdsCalibrationPoint() {
  if (!selectedTdsCalibrationSetId) throw new Error('Select a draft calibration set first');
  const body = {
    measuredRaw: Number(byId('ecTdsMeasuredRawInput').value), measuredVoltage: Number(byId('ecTdsMeasuredVoltageInput').value),
    waterTemp: Number(byId('ecTdsWaterTempInput').value), referenceEcUsCm: Number(byId('tdsReferenceEcInput').value),
    referenceScale: '500', tdsFactor: 0.5, note: byId('ecTdsPointNoteInput').value,
  };
  await requestTdsCalibration(`/api/devices/${DEVICE_ID}/tds-calibration-sets/${encodeURIComponent(selectedTdsCalibrationSetId)}/points`, {
    method: 'POST', body: JSON.stringify(body),
  });
  await loadTdsCalibrationData();
  setMessage('EC calibration point added to the selected draft set.', 'ok');
}

async function runTdsSetAction(action) {
  if (!selectedTdsCalibrationSetId) throw new Error('Select a calibration set first');
  if ((action === 'activate' || action === 'retire') && !window.confirm(`${action} calibration set ${selectedTdsCalibrationSetId}?`)) return;
  await requestTdsCalibration(`/api/devices/${DEVICE_ID}/tds-calibration-sets/${encodeURIComponent(selectedTdsCalibrationSetId)}/${action}`, { method: 'POST', body: '{}' });
  await loadTdsCalibrationData();
  setMessage(`Calibration set ${action} completed. Auto Dosing was not enabled.`, 'ok');
}

function bindTdsCalibrationControls() {
  byId('tdsSetSelect').addEventListener('change', async (event) => { selectedTdsCalibrationSetId = event.target.value; await loadTdsCalibrationData(); });
  byId('tdsReferenceEcInput').addEventListener('input', (event) => {
    const ec = Number(event.target.value); byId('tdsDerivedPpmOutput').textContent = Number.isFinite(ec) && ec > 0 ? `${(ec * 0.5).toFixed(1)} ppm` : 'N/A';
  });
  byId('ecUseLatestTdsButton').addEventListener('click', fillTdsCalibrationFromLatest);
  byId('tdsSetCreateForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await createTdsCalibrationSet(); } catch (error) { setMessage(`Calibration set error: ${error.message}`, 'error'); } });
  byId('tdsPointForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await addTdsCalibrationPoint(); } catch (error) { setMessage(`Calibration point error: ${error.message}`, 'error'); } });
  byId('validateTdsSetButton').addEventListener('click', async () => { try { await runTdsSetAction('validate'); } catch (error) { setMessage(`Set validation: ${error.message}`, 'error'); } });
  byId('activateTdsSetButton').addEventListener('click', async () => { try { await runTdsSetAction('activate'); } catch (error) { setMessage(`Set activation: ${error.message}`, 'error'); } });
  byId('retireTdsSetButton').addEventListener('click', async () => { try { await runTdsSetAction('retire'); } catch (error) { setMessage(`Set retirement: ${error.message}`, 'error'); } });
}

function parseOptionalNumberInput(inputId) {
  const rawValue = byId(inputId).value;

  if (rawValue === '') {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvNumberInput(inputId) {
  const rawValue = byId(inputId).value.trim();

  if (rawValue.length === 0) {
    return [];
  }

  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map(Number);

  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return values;
}

function renderLatestNutrientResponse(data) {
  const test = data.data || null;

  byId('nutrientLatestDeltaDashboard').textContent = test
    ? formatNumberWithUnit(test.result && test.result.deltaDashboard, 2, 'ppm')
    : 'N/A';
  byId('nutrientLatestDeltaPenMain').textContent = test
    ? formatNumberWithUnit(test.result && test.result.deltaPenMain, 2, 'ppm')
    : 'N/A';
  byId('nutrientLatestDeltaPenSecondary').textContent = test
    ? formatNumberWithUnit(test.result && test.result.deltaPenSecondary, 2, 'ppm')
    : 'N/A';
  byId('nutrientLatestResponseEstimate').textContent = test
    ? formatNumberWithUnit(test.result && test.result.estimatedResponsePpmPerMl, 2, 'ppm/pair')
    : 'N/A';
}

function renderNutrientResponseSummary(data) {
  const summary = data.data || {};
  const range = summary.recommendedResponseEstimateRange || {};

  byId('nutrientSummaryDeltaDashboard').textContent = formatNumberWithUnit(summary.averageDeltaDashboard, 2, 'ppm');
  byId('nutrientSummaryDeltaPenMain').textContent = formatNumberWithUnit(summary.averageDeltaPenMain, 2, 'ppm');
  byId('nutrientSummaryDeltaPenSecondary').textContent = formatNumberWithUnit(summary.averageDeltaPenSecondary, 2, 'ppm');
  byId('nutrientSummaryRange').textContent = Number.isFinite(Number(range.min)) && Number.isFinite(Number(range.max))
    ? `${formatNumber(range.min, 1)}-${formatNumber(range.max, 1)} ppm/pair`
    : '20-40 ppm/pair';
}

function renderNutrientResponseHistory(data) {
  const rows = Array.isArray(data.data) ? data.data : [];
  const tableBody = byId('nutrientResponseHistoryBody');

  tableBody.textContent = '';
  byId('nutrientResponseHistoryStatus').textContent = `Latest ${rows.length} nutrient response tests`;

  if (rows.length === 0) {
    const row = document.createElement('tr');
    appendCell(row, 'No nutrient response tests saved yet');
    row.firstChild.colSpan = 8;
    tableBody.appendChild(row);
    return;
  }

  rows.forEach((test) => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(test.createdAt));
    appendCell(row, formatNumber(test.workingLevelLiters, 1));
    appendCell(row, formatNumber(test.before && test.before.dashboardAverage, 2));
    appendCell(row, formatNumber(test.after15min && test.after15min.dashboardAverage, 2));
    appendCell(row, formatNumber(test.result && test.result.deltaDashboard, 2));
    appendCell(row, formatNumber(test.result && test.result.deltaPenMain, 2));
    appendCell(row, formatNumber(test.result && test.result.estimatedResponsePpmPerMl, 2));
    appendCell(row, formatValue(test.note));
    tableBody.appendChild(row);
  });
}

async function loadNutrientResponseData() {
  const [latest, history, summary] = await Promise.all([
    fetchJson(`/api/devices/${DEVICE_ID}/nutrient-response-tests/latest`),
    fetchJson(`/api/devices/${DEVICE_ID}/nutrient-response-tests?limit=10`),
    fetchJson(`/api/devices/${DEVICE_ID}/nutrient-response-summary`),
  ]);

  renderLatestNutrientResponse(latest);
  renderNutrientResponseHistory(history);
  renderNutrientResponseSummary(summary);
  byId('nutrientResponseStatus').textContent = 'Nutrient response data loaded';
}

async function fillNutrientValuesFromLatestLogs(inputId) {
  const logs = await fetchJson(`/api/devices/${DEVICE_ID}/sensor-logs?limit=5`);
  const values = (Array.isArray(logs.data) ? logs.data : [])
    .map((log) => log.tdsPpm)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  byId(inputId).value = values.map((value) => formatNumber(value, 2)).join(', ');
  setMessage(`Copied ${values.length} latest dashboard TDS ppm values.`, 'ok');
}

function buildNutrientResponsePayload() {
  const beforeDashboardValues = parseCsvNumberInput('nutrientBeforeDashboardValuesInput');
  const after15DashboardValues = parseCsvNumberInput('nutrientAfter15DashboardValuesInput');

  if (beforeDashboardValues === null || after15DashboardValues === null) {
    throw new Error('dashboard value lists must contain only numbers separated by commas');
  }

  return {
    workingLevelLiters: Number(byId('nutrientWorkingLevelInput').value),
    tdsSensorSupply: byId('nutrientTdsSupplyInput').value,
    mainPumpOn: byId('nutrientMainPumpOnInput').checked,
    autoDosingEnabled: byId('nutrientAutoDosingEnabledInput').checked,
    before: {
      dashboardValues: beforeDashboardValues,
      penMainPpm: parseOptionalNumberInput('nutrientBeforePenMainInput'),
      penSecondaryPpm: parseOptionalNumberInput('nutrientBeforePenSecondaryInput'),
      waterTempMainPen: parseOptionalNumberInput('nutrientBeforeWaterTempMainInput'),
      waterTempSecondaryPen: parseOptionalNumberInput('nutrientBeforeWaterTempSecondaryInput'),
      waterTempSensor: parseOptionalNumberInput('nutrientBeforeWaterTempSensorInput'),
      waterLevel: byId('nutrientBeforeWaterLevelInput').value,
    },
    dose: {
      pumpAMl: Number(byId('nutrientPumpAMlInput').value),
      pumpBml: Number(byId('nutrientPumpBMlInput').value),
      pumpADurationMs: Number(byId('nutrientPumpADurationInput').value),
      pumpBDurationMs: Number(byId('nutrientPumpBDurationInput').value),
      pumpACompleted: byId('nutrientPumpACompletedInput').checked,
      pumpBCompleted: byId('nutrientPumpBCompletedInput').checked,
    },
    after5min: {
      dashboardTdsPpm: parseOptionalNumberInput('nutrientAfter5DashboardInput'),
      penMainPpm: parseOptionalNumberInput('nutrientAfter5PenMainInput'),
      penSecondaryPpm: parseOptionalNumberInput('nutrientAfter5PenSecondaryInput'),
    },
    after10min: {
      dashboardTdsPpm: parseOptionalNumberInput('nutrientAfter10DashboardInput'),
      penMainPpm: parseOptionalNumberInput('nutrientAfter10PenMainInput'),
      penSecondaryPpm: parseOptionalNumberInput('nutrientAfter10PenSecondaryInput'),
    },
    after15min: {
      dashboardValues: after15DashboardValues,
      penMainPpm: parseOptionalNumberInput('nutrientAfter15PenMainInput'),
      penSecondaryPpm: parseOptionalNumberInput('nutrientAfter15PenSecondaryInput'),
      waterTempMainPen: parseOptionalNumberInput('nutrientAfter15WaterTempMainInput'),
      waterTempSecondaryPen: parseOptionalNumberInput('nutrientAfter15WaterTempSecondaryInput'),
      waterTempSensor: parseOptionalNumberInput('nutrientAfter15WaterTempSensorInput'),
    },
    result: {
      mixingTimeUsedMin: Number(byId('nutrientMixingTimeInput').value),
    },
    note: byId('nutrientNoteInput').value,
  };
}

async function saveNutrientResponseTest() {
  let payload;

  try {
    payload = buildNutrientResponsePayload();
  } catch (error) {
    setMessage(`Nutrient response error: ${error.message}`, 'error');
    return;
  }

  setMessage('Saving nutrient response test...');
  byId('saveNutrientResponseButton').disabled = true;

  try {
    const response = await fetch(`/api/devices/${DEVICE_ID}/nutrient-response-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok || data.ok === false) {
      const errorText = Array.isArray(data.errors) ? data.errors.join('; ') : (data.message || data.error || 'request failed');
      throw new Error(errorText);
    }

    await loadNutrientResponseData();
    setMessage('Nutrient response test saved.', 'ok');
  } catch (error) {
    setMessage(`Nutrient response error: ${error.message}`, 'error');
  } finally {
    byId('saveNutrientResponseButton').disabled = false;
  }
}

function bindNutrientResponseControls() {
  byId('fillNutrientBeforeButton').addEventListener('click', () => {
    fillNutrientValuesFromLatestLogs('nutrientBeforeDashboardValuesInput');
  });

  byId('fillNutrientAfter15Button').addEventListener('click', () => {
    fillNutrientValuesFromLatestLogs('nutrientAfter15DashboardValuesInput');
  });

  byId('nutrientResponseForm').addEventListener('submit', (event) => {
    event.preventDefault();
    saveNutrientResponseTest();
  });
}

function formatPumpRunSummary(pump) {
  if (!pump) {
    return 'N/A';
  }

  return `${formatNumber(pump.durationMs, 0)} ms / ${formatValue(pump.status)}`;
}

function setAutoDosingFormDisabled(disabled) {
  byId('autoDosingEnabledInput').disabled = true;
  byId('autoTargetConfirmedInput').disabled = disabled;
  byId('autoTargetMinInput').disabled = disabled;
  byId('autoTargetMaxInput').disabled = disabled;
  byId('autoDoseMlInput').disabled = disabled;
  byId('autoMixingDelayMinutesInput').disabled = disabled;
  byId('autoMaxDoseMlInput').disabled = disabled;
  byId('autoMaxDailyDoseMlInput').disabled = disabled;
  byId('autoRequireMainPumpOnInput').disabled = disabled;
  byId('autoResponseEstimateInput').disabled = disabled;
  byId('autoResponseWorkingLevelInput').disabled = disabled;
  byId('saveAutoDosingSettingsButton').disabled = disabled;
  byId('autoPrototypePresetButton').disabled = disabled;
  byId('autoRealPresetButton').disabled = disabled;
}

function shouldUpdateAutoDosingFormInputs() {
  return !hasAutoDosingSettingsLoadedOnce || (!isAutoDosingFormDirty && !isAutoDosingFormFocused);
}

function renderAutoDosingSettings(data) {
  const settings = data.data || {};
  const mixingDelayMinutes = Number(settings.mixingDelayMs || settings.cooldownMs) / 60000;

  lastSavedAutoDosingEnabled = settings.enabled === true;
  byId('autoModeValue').textContent = formatValue(settings.mode || 'closed_loop_step');
  byId('autoDosingEnabledValue').textContent = settings.enabled ? 'Enabled' : 'Disabled';
  byId('autoDosingReasonValue').textContent = formatValue(settings.lastEvaluationReason);
  byId('autoLastEvaluationAtValue').textContent = formatDate(settings.lastEvaluationAt);
  byId('autoDosingTdsValue').textContent = formatNumberWithUnit(settings.lastEvaluationTdsPpm, 2, 'ppm');
  byId('autoCropTargetValue').textContent = `${formatValue(settings.cropCode)} / ${settings.targetRangeConfirmed ? 'confirmed' : 'unconfirmed'}`;

  if (shouldUpdateAutoDosingFormInputs()) {
    byId('autoDosingEnabledInput').checked = false;
    byId('autoTargetConfirmedInput').checked = settings.targetRangeConfirmed === true;
    byId('autoTargetMinInput').value = formatNumber(settings.targetMinPpm, 0);
    byId('autoTargetMaxInput').value = formatNumber(settings.targetMaxPpm, 0);
    byId('autoDoseMlInput').value = formatNumber(settings.stepDoseMlPerPump || settings.doseMlPerPump, 2);
    byId('autoMixingDelayMinutesInput').value = Number.isFinite(mixingDelayMinutes) ? String(Math.round(mixingDelayMinutes)) : '15';
    byId('autoMaxDoseMlInput').value = formatNumber(settings.maxDoseMlPerPumpPerRun, 2);
    byId('autoMaxDailyDoseMlInput').value = formatNumber(settings.maxDailyDoseMlPerPump, 2);
    byId('autoRequireMainPumpOnInput').checked = settings.requireMainPumpOn !== false;
    byId('autoResponseEstimateInput').value = formatNumber(settings.responseEstimatePpmPerMl, 2);
    byId('autoResponseWorkingLevelInput').value = formatNumber(settings.responseEstimateWorkingLevelLiters, 1);
    hasAutoDosingSettingsLoadedOnce = true;
    updateMixingDelayWarning();
  }
}

function renderAutoDosingReadiness(data, settingsData) {
  const readiness = data.data || { ready: false, reasons: ['readiness_unavailable'] };
  const settings = settingsData.data || {};
  latestAutoDosingReadiness = readiness;
  byId('autoReadinessReasonsValue').textContent = readiness.ready
    ? 'Ready'
    : (readiness.reasons || []).join(', ');
  byId('autoDosingEnabledInput').disabled = true;
}

function formatMixingCountdown(mixingUntil) {
  if (!mixingUntil) {
    return 'N/A';
  }

  const target = new Date(mixingUntil);

  if (Number.isNaN(target.getTime())) {
    return 'N/A';
  }

  const remainingMs = target.getTime() - Date.now();

  if (remainingMs <= 0) {
    return 'ready on next sensor payload';
  }

  const remainingSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;

  return `${formatDate(mixingUntil)} (${minutes}m ${seconds}s)`;
}

function getRunVersionLabel(run) {
  return run && run.mode === 'closed_loop_step'
    ? 'V2 closed_loop_step'
    : 'V1 legacy';
}

function getRunResultLabel(run) {
  if (!run || run.mode !== 'closed_loop_step') {
    return 'legacy_run';
  }

  if (run.status !== 'completed' || !Number.isFinite(Number(run.deltaTdsPpm))) {
    return 'pending';
  }

  const delta = Number(run.deltaTdsPpm);

  if (delta > 0) {
    return 'positive_response';
  }

  return delta >= -5 ? 'no_clear_change' : 'negative_or_unstable_response';
}

function getAutoDosingState(settings, activeRun, dailyUsage) {
  if (!settings.enabled) {
    return 'disabled';
  }

  if (activeRun && activeRun.status === 'mixing_wait') {
    return 'mixing_wait';
  }

  if (activeRun && activeRun.status === 'in_progress') {
    return 'dosing';
  }

  if (!latestAutoDosingReadiness || latestAutoDosingReadiness.ready !== true) {
    return 'blocked';
  }

  const lastEvaluationTime = new Date(settings.lastEvaluationAt).getTime();
  const dailyWindowStart = new Date(dailyUsage.calculationWindowStartedAt).getTime();
  const hasCurrentDailyLimitReason = settings.lastEvaluationReason === 'daily_dose_limit_reached'
    && Number.isFinite(lastEvaluationTime)
    && Number.isFinite(dailyWindowStart)
    && lastEvaluationTime >= dailyWindowStart;

  if (dailyUsage.isLimitReached || hasCurrentDailyLimitReason) {
    return 'daily_limit_reached';
  }

  if (settings.lastEvaluationReason === 'within_target_range') {
    return 'within_target_range';
  }

  const blockedReasons = new Set([
    'main_pump_not_running',
    'water_level_low',
    'water_temp_invalid',
    'tds_ppm_missing',
    'tds_unstable',
    'pump_calibration_missing',
    'duration_invalid',
    'duration_exceeds_limit',
    'above_target_range',
    'tds_calibration_set_missing',
    'tds_calibration_set_inactive',
    'tds_calibration_insufficient_points',
    'tds_outside_calibration_range',
    'tds_calibration_warning',
    'tds_temperature_not_compensated',
    'tds_control_invalid',
    'tds_target_outside_calibrated_range',
    'tds_target_range_unconfirmed',
  ]);

  return blockedReasons.has(settings.lastEvaluationReason) ? 'blocked' : 'ready';
}

function renderAutoDosingSafety(settingsData, activeRunData, dailyUsage, latestData, calibrationData) {
  const settings = settingsData.data || {};
  const activeRun = activeRunData.data || null;
  const latest = latestData.latest || {};
  const calibrations = calibrationData.data || {};
  const pumpAReady = Boolean(calibrations.A && Number(calibrations.A.flowRateMlPerSec) > 0);
  const pumpBReady = Boolean(calibrations.B && Number(calibrations.B.flowRateMlPerSec) > 0);

  byId('autoSafetyStateValue').textContent = getAutoDosingState(settings, activeRun, dailyUsage);
  byId('autoCurrentTdsValue').textContent = formatNumberWithUnit(latest.tdsPpm, 2, 'ppm');
  byId('autoTargetRangeValue').textContent = `${formatNumber(settings.targetMinPpm, 0)} - ${formatNumber(settings.targetMaxPpm, 0)} ppm`;
  byId('autoMainPumpValue').textContent = formatBoolOnOff(latest.pumpMain);
  byId('autoWaterLevelValue').textContent = formatValue(latest.waterLevel);
  byId('autoRequireMainPumpValue').textContent = settings.requireMainPumpOn ? 'Required' : 'Not required';
  byId('autoPumpCalibrationValue').textContent = `A: ${pumpAReady ? 'Ready' : 'Missing'} | B: ${pumpBReady ? 'Ready' : 'Missing'}`;
  byId('autoDailyLimitWarning').hidden = getAutoDosingState(settings, activeRun, dailyUsage)
    !== 'daily_limit_reached';
}

function renderDailyDoseUsage(data) {
  const usage = data.data || data;
  const progress = Number.isFinite(Number(usage.progressPercentage))
    ? Math.min(100, Math.max(0, Number(usage.progressPercentage)))
    : 0;

  byId('autoDailyDoseValue').textContent = formatNumberWithUnit(usage.dailyDoseUsedMlPerPump, 2, 'ml');
  byId('autoDailyDoseMaxValue').textContent = formatNumberWithUnit(usage.maxDailyDoseMlPerPump, 2, 'ml');
  byId('autoDailyDoseRemainingValue').textContent = formatNumberWithUnit(usage.remainingDailyDoseMlPerPump, 2, 'ml');
  byId('autoDailyWindowValue').textContent = formatDate(usage.calculationWindowStartedAt);
  byId('autoDailyResetValue').textContent = formatDate(usage.lastDailyResetAt);
  byId('autoDailyRunsCountedValue').textContent = formatValue(usage.runsCounted);
  byId('autoDailyDoseProgress').style.width = `${progress}%`;
  byId('autoDailyDoseProgressText').textContent = `${formatNumber(progress, 1)}% used on ${formatValue(usage.localDate)}`;
}

function renderActiveDosingRun(data) {
  const run = data.data || null;

  byId('autoActiveRunIdValue').textContent = run ? formatValue(run.runId) : 'None';
  byId('autoActiveRunStatusValue').textContent = run ? formatValue(run.status) : 'N/A';
  byId('autoActiveRunStepValue').textContent = run ? formatValue(run.currentStep) : 'N/A';
  byId('autoActiveRunTdsValue').textContent = run ? formatNumberWithUnit(run.tdsPpmAtStart, 2, 'ppm') : 'N/A';
  byId('autoActiveRunDoseValue').textContent = run
    ? formatNumberWithUnit(run.stepDoseMlPerPump || run.doseMlPerPump, 2, 'ml')
    : 'N/A';
  byId('autoActivePumpAValue').textContent = run ? formatPumpRunSummary(run.pumpA) : 'N/A';
  byId('autoActivePumpBValue').textContent = run ? formatPumpRunSummary(run.pumpB) : 'N/A';
  byId('autoActiveMixingStartedValue').textContent = run ? formatDate(run.mixingStartedAt) : 'N/A';
  byId('autoActiveMixingUntilValue').textContent = run ? formatDate(run.mixingUntil) : 'N/A';
  byId('autoActiveCountdownValue').textContent = run && run.status === 'mixing_wait'
    ? formatMixingCountdown(run.mixingUntil)
    : 'N/A';
  byId('autoActiveCompletedValue').textContent = run ? formatDate(run.completedAt) : 'N/A';
}

function renderLatestCompletedRun(runs) {
  const run = runs.find((item) => item.mode === 'closed_loop_step' && item.status === 'completed');

  byId('autoLatestTdsBeforeValue').textContent = run ? formatNumberWithUnit(run.tdsPpmAtStart, 2, 'ppm') : 'N/A';
  byId('autoLatestTdsAfterValue').textContent = run ? formatNumberWithUnit(run.tdsPpmAfterMixing, 2, 'ppm') : 'N/A';
  byId('autoLatestDeltaValue').textContent = run ? formatNumberWithUnit(run.deltaTdsPpm, 2, 'ppm') : 'N/A';
  byId('autoLatestStepDoseValue').textContent = run
    ? formatNumberWithUnit(run.stepDoseMlPerPump || run.doseMlPerPump, 2, 'ml')
    : 'N/A';
  byId('autoLatestMixingDelayValue').textContent = run
    ? formatNumberWithUnit(Number(run.mixingDelayMs) / 60000, 1, 'min')
    : 'N/A';
  byId('autoLatestCompletedValue').textContent = run ? formatDate(run.completedAt) : 'N/A';
  byId('autoLatestResultValue').textContent = run ? getRunResultLabel(run) : 'N/A';

  if (!run) {
    byId('autoLatestResultNote').textContent = 'No completed V2 run yet.';
    return;
  }

  const delta = Number(run.deltaTdsPpm);
  byId('autoLatestResultNote').textContent = delta >= 20 && delta <= 40
    ? 'Delta is within the expected +20 to +40 ppm prototype range.'
    : 'Note: delta is outside the expected +20 to +40 ppm prototype range.';
}

function filterDosingRuns(runs, filter) {
  if (filter === 'v2') {
    return runs.filter((run) => run.mode === 'closed_loop_step');
  }

  if (filter === 'v1') {
    return runs.filter((run) => run.mode !== 'closed_loop_step');
  }

  if (filter === 'active') {
    return runs.filter((run) => ['in_progress', 'mixing_wait'].includes(run.status));
  }

  if (filter === 'completed') {
    return runs.filter((run) => run.status === 'completed');
  }

  return runs;
}

function renderDosingRuns(data) {
  if (data) {
    latestAutoDosingRuns = Array.isArray(data.data) ? data.data : [];
  }

  const filter = byId('autoDosingRunsFilter').value;
  const runs = filterDosingRuns(latestAutoDosingRuns, filter);
  const tableBody = byId('autoDosingRunsBody');

  tableBody.textContent = '';
  byId('autoDosingRunsStatus').textContent = `Showing ${runs.length} of ${latestAutoDosingRuns.length} dosing runs`;

  if (runs.length === 0) {
    const row = document.createElement('tr');
    appendCell(row, 'No dosing runs yet');
    row.firstChild.colSpan = 15;
    tableBody.appendChild(row);
    return;
  }

  runs.forEach((run) => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(run.createdAt));
    appendCell(row, getRunVersionLabel(run));
    appendCell(row, formatValue(run.status));
    appendCell(row, formatValue(run.currentStep));
    appendCell(row, formatNumber(run.tdsPpmAtStart, 2));
    appendCell(row, formatNumber(run.tdsPpmAfterMixing, 2));
    appendCell(row, formatNumber(run.deltaTdsPpm, 2));
    appendCell(row, formatNumber(run.stepDoseMlPerPump || run.doseMlPerPump, 2));
    appendCell(row, formatNumberWithUnit(Number(run.mixingDelayMs) / 60000, 1, 'min'));
    appendCell(row, run.mixingUntil ? formatDate(run.mixingUntil) : 'N/A');
    appendCell(row, formatDate(run.completedAt));
    appendCell(row, formatPumpRunSummary(run.pumpA));
    appendCell(row, formatPumpRunSummary(run.pumpB));
    appendCell(row, formatNumber(run.dailyDoseUsedBefore, 2));
    appendCell(row, getRunResultLabel(run));
    tableBody.appendChild(row);
  });
}

function getEventCategory(event) {
  const runTypes = new Set([
    'run_started',
    'pump_a_completed',
    'pump_b_completed',
    'mixing_wait_started',
    'run_completed',
  ]);

  if (event.eventType === 'settings_updated') {
    return 'settings';
  }

  if (runTypes.has(event.eventType)) {
    return 'run';
  }

  if (['skip', 'daily_limit_reached', 'manual_daily_reset'].includes(event.eventType)) {
    return 'safety';
  }

  return 'all';
}

function renderAutoDosingEvents(data) {
  if (data) {
    latestAutoDosingEvents = Array.isArray(data.data) ? data.data : [];
  }

  const filter = byId('autoDosingEventsFilter').value;
  const events = latestAutoDosingEvents.filter((event) => {
    if (filter === 'all') {
      return true;
    }

    if (filter === 'skip') {
      return event.eventType === 'skip' || event.eventType === 'daily_limit_reached';
    }

    return getEventCategory(event) === filter;
  });
  const tableBody = byId('autoDosingEventsBody');

  tableBody.textContent = '';
  byId('autoDosingEventsStatus').textContent = `Showing ${events.length} of ${latestAutoDosingEvents.length} events`;

  if (events.length === 0) {
    const row = document.createElement('tr');
    appendCell(row, 'No matching auto dosing events');
    row.firstChild.colSpan = 8;
    tableBody.appendChild(row);
    return;
  }

  events.forEach((event) => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(event.createdAt));
    appendCell(row, formatValue(event.eventType));
    appendCell(row, formatValue(event.reason));
    appendCell(row, formatNumber(event.tdsPpm, 2));
    appendCell(row, formatBoolOnOff(event.mainPumpOn));
    appendCell(row, formatValue(event.waterLevel));
    appendCell(row, formatNumber(event.dailyDoseUsedMlPerPump, 2));
    appendCell(row, formatValue(event.message));
    tableBody.appendChild(row);
  });
}

function renderAutoDosingEventSummary(data) {
  const summary = data.data || {};
  const latest = summary.latest;

  byId('autoDosingEventsSummary').textContent = latest
    ? `${formatValue(summary.total)} events in ${formatValue(summary.windowHours)}h | Latest: ${formatValue(latest.eventType)} / ${formatValue(latest.reason)} at ${formatDate(latest.createdAt)}`
    : 'No Auto Dosing events recorded yet.';
}

async function loadAutoDosingData() {
  const [settings, readiness, activeRun, runs, events, eventSummary, dailyUsage, latest, calibrations] = await Promise.all([
    fetchJson(`/api/devices/${DEVICE_ID}/auto-dosing/settings`),
    fetchJson(`/api/devices/${DEVICE_ID}/auto-dosing/readiness`),
    fetchJson(`/api/devices/${DEVICE_ID}/auto-dosing/active-run`),
    fetchJson(`/api/devices/${DEVICE_ID}/auto-dosing/runs?limit=50`),
    fetchJson(`/api/devices/${DEVICE_ID}/auto-dosing/events?limit=50`),
    fetchJson(`/api/devices/${DEVICE_ID}/auto-dosing/events/summary`),
    fetchJson(`/api/devices/${DEVICE_ID}/auto-dosing/daily-usage`),
    fetchJson(`/api/devices/${DEVICE_ID}/latest`),
    fetchJson(`/api/devices/${DEVICE_ID}/pump-calibrations/latest`),
  ]);

  renderAutoDosingSettings(settings);
  renderAutoDosingReadiness(readiness, settings);
  renderDailyDoseUsage(dailyUsage);
  renderAutoDosingSafety(settings, activeRun, dailyUsage, latest, calibrations);
  renderActiveDosingRun(activeRun);
  renderDosingRuns(runs);
  renderLatestCompletedRun(latestAutoDosingRuns);
  renderAutoDosingEvents(events);
  renderAutoDosingEventSummary(eventSummary);
  byId('autoDosingStatus').textContent = 'Auto dosing data loaded';
}

function updateMixingDelayWarning() {
  const mixingDelayMinutes = Number(byId('autoMixingDelayMinutesInput').value);
  byId('autoMixingDelayWarning').hidden = !Number.isFinite(mixingDelayMinutes)
    || mixingDelayMinutes >= 15;
}

function applyAutoDosingPreset(type) {
  byId('autoDosingEnabledInput').checked = false;
  byId('autoTargetConfirmedInput').checked = false;
  byId('autoDoseMlInput').value = '1';
  byId('autoMaxDoseMlInput').value = '1';
  byId('autoMaxDailyDoseMlInput').value = type === 'prototype' ? '1' : '2';
  byId('autoMixingDelayMinutesInput').value = type === 'prototype' ? '1' : '15';
  byId('autoRequireMainPumpOnInput').checked = true;
  isAutoDosingFormDirty = true;
  updateMixingDelayWarning();
  setMessage(
    type === 'prototype'
      ? 'Prototype Safe Test Preset applied. Press Save Settings to apply.'
      : 'Real Nutrient Conservative Preset applied. Press Save Settings to apply.',
    'ok',
  );
}

async function resetDailyDoseCounter() {
  const confirmation = window.prompt(
    'Type RESET DAILY DOSE to reset the prototype daily counter. This does not remove nutrient already added.',
    '',
  );

  if (confirmation === null) {
    return;
  }

  if (confirmation !== 'RESET DAILY DOSE') {
    setMessage('Daily dose reset cancelled: confirmation text did not match.', 'error');
    return;
  }

  byId('resetDailyDoseButton').disabled = true;
  setMessage('Resetting daily dose counter...');

  try {
    const response = await fetch(`/api/devices/${DEVICE_ID}/auto-dosing/daily-usage/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        confirmText: confirmation,
        reason: 'prototype_test_session',
      }),
    });
    const data = await response.json();

    if (!response.ok || data.ok === false) {
      const errorText = Array.isArray(data.errors) ? data.errors.join('; ') : (data.message || data.error || 'request failed');
      throw new Error(errorText);
    }

    await loadAutoDosingData();
    setMessage('Daily dose counter reset. Physical nutrient was not removed.', 'ok');
  } catch (error) {
    setMessage(`Daily dose reset error: ${error.message}`, 'error');
  } finally {
    byId('resetDailyDoseButton').disabled = false;
  }
}

async function saveAutoDosingSettings() {
  const enabled = byId('autoDosingEnabledInput').checked;
  const targetRangeConfirmed = byId('autoTargetConfirmedInput').checked;
  const targetMinPpm = Number(byId('autoTargetMinInput').value);
  const targetMaxPpm = Number(byId('autoTargetMaxInput').value);
  const stepDoseMlPerPump = Number(byId('autoDoseMlInput').value);
  const mixingDelayMinutes = Number(byId('autoMixingDelayMinutesInput').value);
  const maxDoseMlPerPumpPerRun = Number(byId('autoMaxDoseMlInput').value);
  const maxDailyDoseMlPerPump = Number(byId('autoMaxDailyDoseMlInput').value);
  const requireMainPumpOn = byId('autoRequireMainPumpOnInput').checked;
  const responseEstimatePpmPerMl = Number(byId('autoResponseEstimateInput').value);
  const responseEstimateWorkingLevelLiters = Number(byId('autoResponseWorkingLevelInput').value);

  if (!Number.isFinite(targetMinPpm) || targetMinPpm <= 0) {
    setMessage('Auto dosing error: target min ppm must be greater than 0.', 'error');
    return;
  }

  if (!Number.isFinite(targetMaxPpm) || targetMaxPpm <= targetMinPpm) {
    setMessage('Auto dosing error: target max ppm must be greater than target min ppm.', 'error');
    return;
  }

  if (!Number.isFinite(stepDoseMlPerPump) || stepDoseMlPerPump <= 0) {
    setMessage('Auto dosing error: step dose ml per pump must be greater than 0.', 'error');
    return;
  }

  if (!Number.isFinite(mixingDelayMinutes) || mixingDelayMinutes < 1) {
    setMessage('Auto dosing error: mixing delay must be at least 1 minute.', 'error');
    return;
  }

  if (!Number.isFinite(maxDoseMlPerPumpPerRun) || maxDoseMlPerPumpPerRun <= 0 || maxDoseMlPerPumpPerRun > 10) {
    setMessage('Auto dosing error: max dose must be between 0 and 10 ml.', 'error');
    return;
  }

  if (!Number.isFinite(maxDailyDoseMlPerPump) || maxDailyDoseMlPerPump <= 0 || maxDailyDoseMlPerPump > 100) {
    setMessage('Auto dosing error: max daily dose must be between 0 and 100 ml.', 'error');
    return;
  }

  if (
    stepDoseMlPerPump > maxDoseMlPerPumpPerRun
    || stepDoseMlPerPump > maxDailyDoseMlPerPump
    || maxDoseMlPerPumpPerRun > maxDailyDoseMlPerPump
  ) {
    setMessage('Auto dosing error: step dose must fit within per-run and daily limits.', 'error');
    return;
  }

  if (!Number.isFinite(responseEstimatePpmPerMl) || responseEstimatePpmPerMl <= 0) {
    setMessage('Auto dosing error: response estimate must be greater than 0.', 'error');
    return;
  }

  if (!Number.isFinite(responseEstimateWorkingLevelLiters) || responseEstimateWorkingLevelLiters <= 0) {
    setMessage('Auto dosing error: response working level must be greater than 0.', 'error');
    return;
  }

  if (
    enabled
    && !lastSavedAutoDosingEnabled
    && !window.confirm('Auto Dosing will be able to run Pump A and Pump B automatically. Use only when pump outputs are connected correctly and reservoir level is normal.')
  ) {
    setMessage('Auto Dosing enable cancelled.', 'error');
    return;
  }

  if (
    mixingDelayMinutes < 15
    && !window.confirm('Short mixing delay is for testing only. Continue saving this test setting?')
  ) {
    setMessage('Auto Dosing settings save cancelled.', 'error');
    return;
  }

  setAutoDosingFormDisabled(true);
  setMessage('Saving auto dosing settings...');

  try {
    const response = await fetch(`/api/devices/${DEVICE_ID}/auto-dosing/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        mode: 'closed_loop_step',
        cropCode: 'cai_ngot',
        targetRangeConfirmed,
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
      }),
    });
    const data = await response.json();

    if (!response.ok || data.ok === false) {
      const errorText = Array.isArray(data.errors) ? data.errors.join('; ') : (data.message || data.error || 'request failed');
      throw new Error(errorText);
    }

    isAutoDosingFormDirty = false;
    isAutoDosingFormFocused = false;
    hasAutoDosingSettingsLoadedOnce = false;
    await loadAutoDosingData();
    setMessage('Auto dosing settings saved.', 'ok');
  } catch (error) {
    setMessage(`Auto dosing error: ${error.message}`, 'error');
  } finally {
    setAutoDosingFormDisabled(false);
  }
}

function bindAutoDosingControls() {
  const form = byId('autoDosingSettingsForm');
  const inputs = [
    byId('autoDosingEnabledInput'),
    byId('autoTargetConfirmedInput'),
    byId('autoTargetMinInput'),
    byId('autoTargetMaxInput'),
    byId('autoDoseMlInput'),
    byId('autoMixingDelayMinutesInput'),
    byId('autoMaxDoseMlInput'),
    byId('autoMaxDailyDoseMlInput'),
    byId('autoRequireMainPumpOnInput'),
    byId('autoResponseEstimateInput'),
    byId('autoResponseWorkingLevelInput'),
  ];

  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      isAutoDosingFormDirty = true;
    });
    input.addEventListener('change', () => {
      isAutoDosingFormDirty = true;
    });
  });

  [byId('autoTargetMinInput'), byId('autoTargetMaxInput')].forEach((input) => {
    input.addEventListener('input', () => {
      byId('autoTargetConfirmedInput').checked = false;
    });
  });

  byId('autoMixingDelayMinutesInput').addEventListener('input', updateMixingDelayWarning);
  byId('autoPrototypePresetButton').addEventListener('click', () => {
    applyAutoDosingPreset('prototype');
  });
  byId('autoRealPresetButton').addEventListener('click', () => {
    applyAutoDosingPreset('real');
  });
  byId('resetDailyDoseButton').addEventListener('click', resetDailyDoseCounter);
  byId('autoDosingRunsFilter').addEventListener('change', () => {
    renderDosingRuns();
  });
  byId('autoDosingEventsFilter').addEventListener('change', () => {
    renderAutoDosingEvents();
  });

  form.addEventListener('focusin', () => {
    isAutoDosingFormFocused = true;
  });

  form.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!form.contains(document.activeElement)) {
        isAutoDosingFormFocused = false;
      }
    }, 100);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveAutoDosingSettings();
  });
}

async function loadDashboard() {
  if (isLoading) {
    return;
  }

  isLoading = true;
  setMessage(hasLoadedOnce ? 'Refreshing dashboard data...' : 'Loading dashboard data...');

  try {
    const [health, activeAlerts, latest, deviceLogs, latestLogs] = await Promise.all([
      fetchJson('/health'),
      fetchJson('/api/alerts/active'),
      fetchJson(`/api/devices/${DEVICE_ID}/latest`),
      fetchJson(`/api/devices/${DEVICE_ID}/sensor-logs?limit=20`),
      fetchJson('/api/sensor-logs/latest?limit=20'),
    ]);

    renderHealth(health);
    renderAlerts(activeAlerts);
    renderLatest(latest);
    renderTelemetryIdentity(latest, deviceLogs);
    renderLogs(deviceLogs);
    renderTrend(latestLogs);
    await Promise.all([
      loadCalibrationData(),
      loadTdsCalibrationData(),
      loadNutrientResponseData(),
      loadAutoDosingData(),
      loadShadowData(),
    ]);

    byId('lastRefreshTime').textContent = new Date().toLocaleString();
    setMessage('Dashboard data updated.', 'ok');
    hasLoadedOnce = true;
  } catch (error) {
    setBadge('healthBadge', false, 'Backend error');
    setBadge('mqttBadge', null, 'MQTT unknown');
    setBadge('mongoBadge', null, 'MongoDB unknown');
    byId('alertsStatus').textContent = 'Alert fetch failed';
    setMessage(`Dashboard error: ${error.message}`, 'error');
  } finally {
    isLoading = false;
  }
}

window.addEventListener('load', () => {
  bindMainPumpStateControls();
  bindManualPumpControls();
  bindCalibrationControls();
  bindTdsCalibrationControls();
  bindNutrientResponseControls();
  bindAutoDosingControls();
  loadDashboard();
  window.setInterval(loadDashboard, REFRESH_INTERVAL_MS);
});
