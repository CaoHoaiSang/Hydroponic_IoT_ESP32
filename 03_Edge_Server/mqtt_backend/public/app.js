const DEVICE_ID = 'device001';
const REFRESH_INTERVAL_MS = 5000;

let isLoading = false;
let hasLoadedOnce = false;
let latestDeviceStatus = null;

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
    row.firstChild.colSpan = 7;
    tableBody.appendChild(row);
    return;
  }

  rows.forEach((calibration) => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(calibration.createdAt));
    appendCell(row, formatNumber(calibration.measuredRaw, 0));
    appendCell(row, formatNumber(calibration.measuredVoltage, 3));
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
  byId('useLatestTdsButton').disabled = disabled;
  byId('saveTdsCalibrationButton').disabled = disabled;
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
  const [latestCalibration, calibrationHistory] = await Promise.all([
    fetchJson(`/api/devices/${DEVICE_ID}/tds-calibrations/latest`),
    fetchJson(`/api/devices/${DEVICE_ID}/tds-calibrations?limit=10`),
  ]);

  renderLatestTdsCalibration(latestCalibration);
  renderTdsCalibrationHistory(calibrationHistory);
  byId('tdsCalibrationStatus').textContent = 'Latest TDS calibration loaded';
}

function fillTdsCalibrationFromLatest() {
  if (!latestDeviceStatus) {
    setMessage('TDS calibration error: latest device status is not loaded yet.', 'error');
    return;
  }

  setNumberInputFromLatest('tdsMeasuredRawInput', latestDeviceStatus.tdsRaw, 0);
  setNumberInputFromLatest('tdsMeasuredVoltageInput', latestDeviceStatus.tdsVoltage, 3);
  setNumberInputFromLatest('tdsWaterTempInput', latestDeviceStatus.waterTemp, 2);
  setMessage('Latest TDS raw, voltage, and water temperature copied into calibration form.', 'ok');
}

async function saveTdsCalibration() {
  const measuredRaw = Number(byId('tdsMeasuredRawInput').value);
  const measuredVoltage = Number(byId('tdsMeasuredVoltageInput').value);
  const referenceTdsPpm = Number(byId('tdsReferencePpmInput').value);
  const waterTempInput = byId('tdsWaterTempInput').value;
  const note = byId('tdsNoteInput').value;
  const waterTemp = waterTempInput === '' ? null : Number(waterTempInput);

  if (!Number.isFinite(measuredRaw) || measuredRaw <= 0) {
    setMessage('TDS calibration error: measured raw must be greater than 0.', 'error');
    return;
  }

  if (!Number.isFinite(measuredVoltage) || measuredVoltage <= 0 || measuredVoltage > 3.3) {
    setMessage('TDS calibration error: measured voltage must be between 0 and 3.3 V.', 'error');
    return;
  }

  if (!Number.isFinite(referenceTdsPpm) || referenceTdsPpm <= 0) {
    setMessage('TDS calibration error: reference ppm must be greater than 0.', 'error');
    return;
  }

  if (waterTemp !== null && !Number.isFinite(waterTemp)) {
    setMessage('TDS calibration error: water temperature must be a number or blank.', 'error');
    return;
  }

  setTdsCalibrationFormDisabled(true);
  setMessage('Saving TDS calibration...');

  try {
    const response = await fetch(`/api/devices/${DEVICE_ID}/tds-calibration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        measuredRaw,
        measuredVoltage,
        referenceTdsPpm,
        waterTemp,
        method: 'one_point_voltage_factor',
        note,
      }),
    });
    const data = await response.json();

    if (!response.ok || data.ok === false) {
      const errorText = Array.isArray(data.errors) ? data.errors.join('; ') : (data.message || data.error || 'request failed');
      throw new Error(errorText);
    }

    await loadTdsCalibrationData();
    setMessage(`TDS calibration saved: ${formatNumberWithUnit(data.data.calibrationFactor, 3, 'ppm/V')}`, 'ok');
  } catch (error) {
    setMessage(`TDS calibration error: ${error.message}`, 'error');
  } finally {
    setTdsCalibrationFormDisabled(false);
  }
}

function bindTdsCalibrationControls() {
  byId('useLatestTdsButton').addEventListener('click', fillTdsCalibrationFromLatest);
  byId('tdsCalibrationForm').addEventListener('submit', (event) => {
    event.preventDefault();
    saveTdsCalibration();
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
    renderLogs(deviceLogs);
    renderTrend(latestLogs);
    await Promise.all([
      loadCalibrationData(),
      loadTdsCalibrationData(),
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
  bindManualPumpControls();
  bindCalibrationControls();
  bindTdsCalibrationControls();
  loadDashboard();
  window.setInterval(loadDashboard, REFRESH_INTERVAL_MS);
});
