"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  BookOpen,
  CalendarDays,
  Check,
  CircleCheck,
  ChevronDown,
  Cloud,
  Cpu,
  Database,
  Download,
  Droplets,
  FileDown,
  Filter,
  FlaskConical,
  Gauge,
  History,
  LayoutDashboard,
  Leaf,
  KeyRound,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  Network,
  Radio,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  SlidersHorizontal,
  Sun,
  Thermometer,
  UserRound,
  WifiOff,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { backendApiAdapter, CapabilityAdapter, HealthAdapter, type DeviceSnapshot, type SensorLogRow } from "./adapters";
import { CalibrationWizard } from "./components/CalibrationWizard";

type View = "overview" | "zones" | "garden" | "monitoring" | "pumps" | "dosing" | "assistant" | "calibration" | "data" | "settings" | "system";

type CropProfile = {
  name: string;
  variety: string;
  sowDate: string;
  harvestDate: string;
  targetTds: number;
  isolationDays: number;
  isolationTds: number;
};

type RackProfile = {
  id: string;
  name: string;
  location: string;
  crop: CropProfile | null;
};

type GrowingZone = {
  id: string;
  name: string;
  racks: string;
  rackList: RackProfile[];
  tank: string;
  deviceId: string;
  espIp: string;
  status: "online" | "warning" | "offline";
  crop: CropProfile;
  tds: number | null;
  ec: number | null;
  temperature: number | null;
  waterLevel: "Bình thường" | "Thấp";
  targetTdsMin: number;
  targetTdsMax: number;
};

type SystemCapabilities = {
  buildProfile: string | null;
  actuatorsLocked: boolean;
  pumpCommandsEnabled: boolean;
  autoDosingCanEnable: boolean;
  autoDosingLockReason: string;
};
type GatewayHealth = {
  connected: boolean;
  mongoConnected: boolean;
  mqttConnected: boolean;
  databaseLabel: string;
  databaseEngine: string | null;
  firmwareVersion: string | null;
  backendVersion: string | null;
  buildProfile: string | null;
};
type GatewayAdapter = { capabilities: SystemCapabilities; health: GatewayHealth };
type SettingsTab="gateway"|"device"|"ai"|"cloud"|"modules";

const lockedGatewayAdapter: GatewayAdapter = {
  capabilities: {
    buildProfile: null,
    actuatorsLocked: true,
    pumpCommandsEnabled: false,
    autoDosingCanEnable: false,
    autoDosingLockReason: "Backend chưa cấp quyền điều khiển thiết bị chấp hành",
  },
  health: {
    connected: false,
    mongoConnected: false,
    mqttConnected: false,
    databaseLabel: "Local Database",
    databaseEngine: null,
    firmwareVersion: null,
    backendVersion: null,
    buildProfile: null,
  },
};
const settingsTabFromPath=(pathname:string):SettingsTab=>{if(pathname.includes("/zones/"))return"device";const candidate=pathname.split("/").pop();return (["gateway","ai","cloud","modules"] as SettingsTab[]).includes(candidate as SettingsTab)?candidate as SettingsTab:"gateway";};

type AiActionKind = "nutrient" | "harvest" | "health";

type AiActionResult = {
  kind: AiActionKind;
  title: string;
  status: string;
  summary: string;
  fields: { label: string; value: string }[];
  targetTds?: number;
  isolationDays?: number;
  isolationTds?: number;
};

const navItems = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "zones", label: "Vùng & giàn", icon: Network },
  { id: "garden", label: "Mùa vụ của giàn", icon: Sprout },
  { id: "monitoring", label: "Giám sát", icon: Activity },
  { id: "pumps", label: "Điều khiển bơm", icon: SlidersHorizontal },
  { id: "dosing", label: "Auto Dosing", icon: FlaskConical },
  { id: "assistant", label: "Trợ lý AI", icon: Bot },
  { id: "calibration", label: "Hiệu chuẩn thiết bị vùng", icon: Gauge },
  { id: "data", label: "Dữ liệu & báo cáo", icon: BarChart3 },
  { id: "settings", label: "Cài đặt", icon: Settings },
] as const;

const initialZones: GrowingZone[] = [
  {
    id: "zone-nft-01", name: "Vùng Xà lách", racks: "Giàn NFT-01, NFT-02", tank: "Bồn XL-01",
    rackList: [
      { id:"rack-01", name:"Giàn NFT-01", location:"Dãy phía Đông", crop:{ name:"Xà lách", variety:"Romaine xanh", sowDate:"2026-07-23", harvestDate:"2026-08-27", targetTds:370, isolationDays:3, isolationTds:180 } },
      { id:"rack-02", name:"Giàn NFT-02", location:"Dãy phía Đông", crop:{ name:"Xà lách", variety:"Lollo xanh", sowDate:"2026-07-26", harvestDate:"2026-08-30", targetTds:390, isolationDays:3, isolationTds:180 } },
    ],
    deviceId: "device001", espIp: "192.168.1.92", status: "online",
    crop: { name:"Xà lách", variety:"Romaine xanh", sowDate:"2026-07-23", harvestDate:"2026-08-27", targetTds:370, isolationDays:3, isolationTds:180 },
    tds: 348.88, ec: 697.76, temperature: 26.4, waterLevel: "Bình thường", targetTdsMin: 340, targetTdsMax: 420,
  },
  {
    id: "zone-nft-02", name: "Vùng Rau cải", racks: "Giàn NFT-03", tank: "Bồn RC-01",
    rackList: [{ id:"rack-03", name:"Giàn NFT-03", location:"Dãy trung tâm", crop:{ name:"Cải kale", variety:"Kale xoăn xanh", sowDate:"2026-07-17", harvestDate:"2026-08-24", targetTds:620, isolationDays:4, isolationTds:240 } }],
    deviceId: "device002", espIp: "192.168.1.93", status: "online",
    crop: { name:"Cải kale", variety:"Kale xoăn xanh", sowDate:"2026-07-17", harvestDate:"2026-08-24", targetTds:620, isolationDays:4, isolationTds:240 },
    tds: 606.24, ec: 1212.48, temperature: 25.9, waterLevel: "Bình thường", targetTdsMin: 570, targetTdsMax: 670,
  },
  {
    id: "zone-nft-03", name: "Vùng Rau thơm", racks: "Giàn NFT-04, NFT-05", tank: "Bồn RT-01",
    rackList: [
      { id:"rack-04", name:"Giàn NFT-04", location:"Dãy phía Tây", crop:{ name:"Húng quế", variety:"Húng quế Ý", sowDate:"2026-07-28", harvestDate:"2026-09-02", targetTds:520, isolationDays:3, isolationTds:220 } },
      { id:"rack-05", name:"Giàn NFT-05", location:"Dãy phía Tây", crop:{ name:"Húng quế", variety:"Húng chanh", sowDate:"2026-08-01", harvestDate:"2026-09-06", targetTds:500, isolationDays:3, isolationTds:210 } },
    ],
    deviceId: "device003", espIp: "192.168.1.94", status: "warning",
    crop: { name:"Húng quế", variety:"Húng quế Ý", sowDate:"2026-07-28", harvestDate:"2026-09-02", targetTds:520, isolationDays:3, isolationTds:220 },
    tds: 488.72, ec: 977.44, temperature: 27.1, waterLevel: "Thấp", targetTdsMin: 470, targetTdsMax: 550,
  },
];

const TODAY_UTC = Date.UTC(2026, 7, 10);
const dateToUtc = (value: string) => { const [year, month, day] = value.split("-").map(Number); return Date.UTC(year, month - 1, day); };
const cropAgeDays = (value: string) => Math.max(0, Math.floor((TODAY_UTC - dateToUtc(value)) / 86400000));
const daysUntil = (value: string) => Math.max(0, Math.ceil((dateToUtc(value) - TODAY_UTC) / 86400000));
const shiftDate = (value: string, days: number) => new Date(dateToUtc(value) + days * 86400000).toISOString().slice(0, 10);
const formatViDate = (value: string) => { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; };

const trendPoints = [
  [0, 75], [8, 68], [16, 70], [24, 60], [32, 64], [40, 48], [48, 52], [56, 45], [64, 50], [72, 35], [80, 39], [88, 27], [96, 31], [104, 18],
];

function TrendChart({ targetMin, targetMax }: { targetMin:number; targetMax:number }) {
  const points = trendPoints.map(([x, y]) => `${x * 6.2 + 18},${y * 1.8 + 24}`).join(" ");
  const area = `18,190 ${points} 663,190`;
  return (
    <div className="chart-wrap" aria-label={`Bản xem trước biểu đồ TDS, vùng mục tiêu ${targetMin} đến ${targetMax} ppm`}>
      <svg viewBox="0 0 680 215" role="img">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f9f6e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0f9f6e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 90, 140, 190].map((y) => <line key={y} x1="18" y1={y} x2="663" y2={y} className="chart-grid" />)}
        <polygon points={area} fill="url(#areaFill)" />
        <polyline points={points} className="chart-line" />
        <circle cx="663" cy="56" r="5" className="chart-dot" />
        <line x1="663" y1="56" x2="663" y2="190" className="chart-guide" />
        <g className="chart-labels">
          <text x="18" y="210">00:00</text><text x="176" y="210">06:00</text><text x="334" y="210">12:00</text><text x="492" y="210">18:00</text><text x="630" y="210">Bây giờ</text>
        </g>
      </svg>
      <div className="chart-tooltip"><b>Minh họa</b><span>Chưa có time-series</span></div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, unit, note, tone = "green", spark }: {
  icon: typeof Droplets; label: string; value: string; unit?: string; note: string; tone?: "green" | "blue" | "amber" | "violet"; spark: number[];
}) {
  const max = Math.max(...spark);
  const min = Math.min(...spark);
  const points = spark.map((v, i) => `${i * 18},${36 - ((v - min) / Math.max(1, max - min)) * 25}`).join(" ");
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top"><span className="metric-icon"><Icon size={19} /></span><span className="metric-note">{note}</span></div>
      <p>{label}</p>
      <div className="metric-reading"><strong>{value}</strong>{unit && <span>{unit}</span>}</div>
      <svg className="sparkline" viewBox="0 0 126 42" aria-hidden="true"><polyline points={points} /></svg>
    </article>
  );
}

function StatusDot({ status = "online" }: { status?: "online" | "warning" | "offline" }) {
  return <span className={`status-dot ${status}`} aria-hidden="true" />;
}

const rackSummary = (zone: GrowingZone) => zone.rackList.map((rack) => rack.name).join(", ");
const primaryCrop = (zone: GrowingZone) => zone.rackList.find((rack) => rack.crop)?.crop ?? zone.crop;
const activeSeasonCount = (zone: GrowingZone) => zone.rackList.filter((rack) => rack.crop).length;
const formatOptionalNumber = (value: number | null, digits = 0) => value === null ? "—" : value.toFixed(digits);

function Overview({ onNavigate, mainPump, notify, zone, capabilities, health, runtimeDataAvailable, snapshot }: {
  onNavigate: (view: View) => void; mainPump: boolean; notify: (text: string) => void; zone: GrowingZone; capabilities:SystemCapabilities; health:GatewayHealth; runtimeDataAvailable:boolean; snapshot:DeviceSnapshot|null;
}) {
  const [range, setRange] = useState("24 giờ");
  const actuatorAvailable = !capabilities.actuatorsLocked && capabilities.pumpCommandsEnabled;
  const requestActuator = async (kind:"main"|"A"|"B", label:string) => {
    try {
      if (kind === "main") await backendApiAdapter.setMainPump(zone.deviceId, !mainPump);
      else await backendApiAdapter.pulsePump(zone.deviceId, kind, 500);
      notify(`Đã chuyển yêu cầu ${label} tới Backend; giao diện chờ trạng thái xác nhận`);
    } catch (error) { notify(error instanceof Error ? error.message : "Backend từ chối yêu cầu điều khiển"); }
  };
  return (
    <div className="view-stack">
      <section className="overview-hero">
        <div className="hero-copy">
          <div className="eyebrow"><StatusDot status={health.connected ? "online" : "offline"}/> Bảng điều khiển Local-first</div>
          <h1>Chào buổi tối, <span>Người vận hành</span></h1>
          <p>{health.connected ? `${zone.name} đang đọc trạng thái qua Backend cục bộ.` : "Giao diện đang chạy độc lập; dữ liệu điều khiển không được thay bằng mock khi Backend ngắt kết nối."}</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onNavigate("monitoring")}><Activity size={17} /> Xem dữ liệu trực tiếp</button>
            <button className="secondary-button" onClick={() => onNavigate("pumps")}><SlidersHorizontal size={17} /> Điều khiển nhanh</button>
          </div>
        </div>
        <div className="hero-system-card">
          <div className="system-ring"><span>{health.connected ? "API" : "OFF"}</span></div>
          <div><span className="mini-label">Trạng thái tích hợp</span><strong>{health.connected ? "Backend cục bộ đã phản hồi" : "Chưa kết nối Backend"}</strong><p>{runtimeDataAvailable ? "Đã nhận snapshot device001" : "Chưa có dữ liệu runtime"}</p></div>
          <div className="service-pills"><span><Wifi size={14} /> REST {health.connected ? "OK" : "--"}</span><span><Network size={14} /> MQTT {health.mqttConnected ? "OK" : "--"}</span><span><Database size={14} /> DB {health.mongoConnected ? "OK" : "--"}</span></div>
        </div>
      </section>

      <section className="crop-now-strip season-summary-strip">
        <div className="crop-now-icon"><Sprout size={24} /></div>
        <div className="crop-now-main"><span>{activeSeasonCount(zone)} MÙA VỤ ĐANG HOẠT ĐỘNG TRONG VÙNG</span><strong>Mùa vụ theo từng giàn</strong><div className="overview-season-list">{zone.rackList.map((rack) => <p key={rack.id}><b>{rack.name.replace("Giàn ", "")}</b><span>{rack.crop ? `${rack.crop.variety} — ${cropAgeDays(rack.crop.sowDate) < 14 ? "Mới gieo" : "Đang phát triển"}` : "Chưa thiết lập mùa vụ"}</span></p>)}</div></div>
        <div className="crop-now-target"><small>Mục tiêu TDS của vùng</small><b>{zone.targetTdsMin}–{zone.targetTdsMax} ppm</b><em>Áp dụng cho {zone.tank}</em></div>
        <button onClick={() => onNavigate("garden")}>Xem tất cả mùa vụ <span>→</span></button>
      </section>

      <section className="metric-grid">
        <MetricCard icon={Droplets} label="TDS hiện tại" value={runtimeDataAvailable ? formatOptionalNumber(snapshot?.tdsPpm ?? null, 0) : "—"} unit={snapshot?.tdsPpm === null ? undefined : "ppm"} note={runtimeDataAvailable ? (snapshot?.tdsPpm === null ? "Chưa có active calibration" : snapshot?.tdsControlValid ? "Đã hiệu chuẩn · control valid" : "Chỉ đọc · chưa ổn định") : "Chưa có snapshot"} spark={[22, 24, 23, 27, 26, 31, 30, 34]} />
        <MetricCard icon={Zap} label="Độ dẫn điện EC" value={runtimeDataAvailable ? formatOptionalNumber(snapshot?.ecUsCm ?? null, 0) : "—"} unit={snapshot?.ecUsCm === null ? undefined : "µS/cm"} note={runtimeDataAvailable ? (snapshot?.ecUsCm === null ? "Chưa thể quy đổi EC" : "Dữ liệu Backend") : "Chưa có snapshot"} tone="blue" spark={[30, 31, 29, 32, 34, 33, 36, 37]} />
        <MetricCard icon={Thermometer} label="Nhiệt độ nước" value={runtimeDataAvailable ? formatOptionalNumber(snapshot?.waterTemp ?? null, 1) : "—"} unit={snapshot?.waterTemp === null ? undefined : "°C"} note={runtimeDataAvailable ? "Dữ liệu Backend" : "Chưa có snapshot"} tone="amber" spark={[23, 25, 25, 27, 26, 25, 26, 26]} />
        <MetricCard icon={Gauge} label="Mực nước" value={runtimeDataAvailable ? zone.waterLevel : "—"} note={runtimeDataAvailable ? (zone.waterLevel === "Bình thường" ? "Phao an toàn OK" : "Khóa dosing") : "Chưa có snapshot"} tone="violet" spark={[30, 30, 29, 30, 30, 30, 30, 30]} />
      </section>
      {runtimeDataAvailable && snapshot?.tdsPpm === null && <div className="calibration-tip wide-tip" role="status"><AlertTriangle size={17}/><p>ESP32 vẫn đang đo: ADC <b>{formatOptionalNumber(snapshot.tdsRaw,0)}</b>, điện áp <b>{formatOptionalNumber(snapshot.tdsVoltage,3)} V</b>. Backend chưa có active EC/TDS calibration set nên cố ý không tạo giá trị ppm.</p></div>}
      {runtimeDataAvailable && snapshot?.tdsPpm !== null && !snapshot?.tdsControlValid && <div className="calibration-tip wide-tip" role="status"><AlertTriangle size={17}/><p>TDS <b>{formatOptionalNumber(snapshot?.tdsPpm??null,2)} ppm</b> đang hiển thị để quan sát, nhưng chưa hợp lệ cho điều khiển vì cửa sổ/stability chưa đạt. Auto Dosing vẫn bị khóa.</p></div>}

      <section className="dashboard-grid two-one">
        <article className="panel trend-panel">
          <div className="panel-head">
            <div><span className="panel-kicker">Bản xem trước chỉ đọc</span><h2>Xu hướng TDS</h2></div>
            <div className="segmented" aria-label="Khoảng thời gian">{["6 giờ", "24 giờ", "7 ngày"].map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div>
          </div>
          <div className="chart-legend"><span><i className="legend-line" /> Đường biểu đồ minh họa</span><span data-testid="overview-target"><i className="legend-zone" /> Vùng mục tiêu {zone.targetTdsMin}–{zone.targetTdsMax} ppm</span></div>
          <TrendChart targetMin={zone.targetTdsMin} targetMax={zone.targetTdsMax} />
          <div className="chart-summary"><span><small>Thấp nhất</small><b>—</b></span><span><small>Trung bình</small><b>—</b></span><span><small>Cao nhất</small><b>—</b></span><span><small>Biến động</small><b>—</b></span></div>
        </article>

        <article className="panel safety-panel">
          <div className="panel-head"><div><span className="panel-kicker">Auto Dosing V2</span><h2>Trạng thái an toàn</h2></div><span className="status-chip muted">Đang tắt</span></div>
          <div className="readiness-score"><div className="score-icon"><ShieldCheck size={25} /></div><div><strong>{runtimeDataAvailable ? "Chưa xác minh đủ điều kiện" : "Chưa có dữ liệu để đánh giá"}</strong><p>Auto Dosing bị khóa OFF ở Backend</p></div><span>OFF</span></div>
          <ul className="check-list">
            {["TDS hợp lệ và ổn định", "Mực nước bình thường", "Bơm A/B đã hiệu chuẩn", "Không có dosing run đang chạy", "Bơm hồi lưu đang hoạt động"].map((item) => <li key={item}><span><X size={13} /></span>{item}: chưa xác minh</li>)}
          </ul>
          <button className="full-button" onClick={() => onNavigate("dosing")}>Xem cấu hình Auto Dosing <span>→</span></button>
        </article>
      </section>

      <section className="dashboard-grid equal">
        <article className="panel pump-panel">
          <div className="panel-head"><div><span className="panel-kicker">Thiết bị chấp hành</span><h2>Điều khiển bơm nhanh</h2></div><button className="icon-text-button" onClick={() => onNavigate("pumps")}>Chi tiết <span>→</span></button></div>
          {!actuatorAvailable && <div className="actuator-lock-inline" data-testid="actuator-lock-reason"><LockKeyhole size={14}/><span>{capabilities.autoDosingLockReason}</span></div>}
          <div className="pump-list">
            <div className="pump-row"><span className={`pump-avatar ${mainPump ? "running" : ""}`}><Power size={18} /></span><div><strong>Bơm hồi lưu vùng</strong><p>{mainPump ? "Backend báo đang chạy" : "Backend báo đang tắt"}</p></div><button className={`switch ${mainPump ? "on" : ""}`} role="switch" aria-checked={mainPump} aria-label="Yêu cầu Backend bật hoặc tắt bơm hồi lưu vùng" disabled={!actuatorAvailable} onClick={() => void requestActuator("main", mainPump ? "tắt bơm hồi lưu" : "bật bơm hồi lưu")}><span /></button></div>
            <div className="pump-row"><span className="pump-avatar nutrient-a">A</span><div><strong>Bơm dinh dưỡng A</strong><p>{actuatorAvailable ? "Backend sẵn sàng · 2.0 ml/s" : "Đang bị khóa"}</p></div><button className="pulse-button" disabled={!actuatorAvailable} onClick={() => void requestActuator("A", "pulse thử 500 ms tới bơm A")}>Pulse 500 ms</button></div>
            <div className="pump-row"><span className="pump-avatar nutrient-b">B</span><div><strong>Bơm dinh dưỡng B</strong><p>{actuatorAvailable ? "Backend sẵn sàng · 1.8 ml/s" : "Đang bị khóa"}</p></div><button className="pulse-button" disabled={!actuatorAvailable} onClick={() => void requestActuator("B", "pulse thử 500 ms tới bơm B")}>Pulse 500 ms</button></div>
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-head"><div><span className="panel-kicker">Trạng thái tích hợp</span><h2>Nguồn dữ liệu hiện tại</h2></div><button className="icon-text-button" onClick={() => onNavigate("data")}>Xem dữ liệu <span>→</span></button></div>
          <div className="timeline">
            <div className={`timeline-item ${runtimeDataAvailable ? "good" : "neutral"}`}><span>{runtimeDataAvailable ? <Check size={14} /> : <X size={14} />}</span><div><strong>Snapshot cảm biến</strong><p>{runtimeDataAvailable ? `Đã nhận dữ liệu ${zone.deviceId} từ Backend` : "Chưa nhận dữ liệu runtime"}</p></div><time>{runtimeDataAvailable ? "Backend" : "—"}</time></div>
            <div className={`timeline-item ${health.mongoConnected ? "info" : "neutral"}`}><span><Database size={14} /></span><div><strong>Local Database</strong><p>{health.mongoConnected ? "MongoDB đã kết nối" : "Chưa xác nhận kết nối MongoDB"}</p></div><time>{health.mongoConnected ? "OK" : "—"}</time></div>
            <div className="timeline-item neutral"><span><Play size={14} /></span><div><strong>Lịch sử dosing</strong><p>Xem và xuất từ trang Dữ liệu; không tạo lệnh từ khối này</p></div><time>Chỉ đọc</time></div>
            <div className="timeline-item neutral"><span><Cloud size={14} /></span><div><strong>Cloud backup</strong><p>Chưa tích hợp Backend</p></div><time>—</time></div>
          </div>
        </article>
      </section>
    </div>
  );
}

function ViewHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="view-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="view-header-action">{action}</div>}</div>;
}

function TinyTrend({ color = "green" }: { color?: "green" | "blue" | "amber" }) {
  return <svg className={`tiny-trend ${color}`} viewBox="0 0 250 54" aria-hidden="true"><path d="M2 43 C20 38,26 40,42 33 S68 28,82 31 S109 20,124 25 S152 12,168 18 S194 8,208 13 S230 5,248 7" /></svg>;
}

function ZonesView({ zones, selectedZoneId, onSelect, onAddZone, onUpdateZone, notify, health }: {
  zones: GrowingZone[];
  selectedZoneId: string;
  onSelect: (id: string, navigate?: boolean) => void;
  onAddZone: (zone: GrowingZone) => void;
  onUpdateZone: (zone: GrowingZone) => void;
  notify: (text: string) => void;
  health: GatewayHealth;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("Vùng dinh dưỡng mới");
  const [newCrop, setNewCrop] = useState("Rau muống");
  const [editingZone, setEditingZone] = useState<GrowingZone | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", tank: "", deviceId: "", espIp: "" });
  const warningCount = zones.filter((zone) => zone.status === "warning").length;

  const addZone = () => {
    const index = zones.length + 1;
    const zone: GrowingZone = {
      id: `zone-nft-${String(index).padStart(2, "0")}`,
      name: newName.trim() || `Vùng dinh dưỡng ${index}`,
      racks: `Giàn NFT ${String(index + 3).padStart(2, "0")}`,
      rackList: [{ id:`rack-${Date.now()}`, name:`Giàn NFT-${String(index + 3).padStart(2, "0")}`, location:"Chưa nhập vị trí", crop:null }],
      tank: `Bồn V${String(index).padStart(2, "0")}-01`,
      deviceId: `device${String(index).padStart(3, "0")}`,
      espIp: `192.168.1.${91 + index}`,
      status: "offline",
      crop: { name: newCrop.trim() || "Chưa chọn", variety: "Chưa thiết lập", sowDate: "2026-08-10", harvestDate: "2026-09-10", targetTds: 450, isolationDays: 3, isolationTds: 200 },
      tds: 0, ec: 0, temperature: 0, waterLevel: "Bình thường", targetTdsMin: 400, targetTdsMax: 500,
    };
    onAddZone(zone);
    setShowAdd(false);
    notify("Đã tạo bản nháp vùng trong phiên trình duyệt; chưa lưu Backend.");
  };

  const openEdit = (zone: GrowingZone) => {
    setEditingZone(zone);
    setEditDraft({ name: zone.name, tank: zone.tank, deviceId: zone.deviceId, espIp: zone.espIp });
  };

  const saveEdit = () => {
    if (!editingZone) return;
    const name = editDraft.name.trim();
    if (!name) {
      notify("Tên vùng trồng không được để trống");
      return;
    }
    onUpdateZone({
      ...editingZone,
      name,
      tank: editDraft.tank.trim() || editingZone.tank,
      deviceId: editDraft.deviceId.trim() || editingZone.deviceId,
      espIp: editDraft.espIp.trim() || editingZone.espIp,
    });
    setEditingZone(null);
    notify(`Đã cập nhật bản nháp ${name}; chưa lưu Backend`);
  };

  const addRack = (zone: GrowingZone) => {
    const number = zones.reduce((total, item) => total + item.rackList.length, 0) + 1;
    const rack: RackProfile = { id:`rack-${Date.now()}`, name:`Giàn NFT-${String(number).padStart(2,"0")}`, location:"Chưa nhập vị trí", crop:null };
    const rackList = [...zone.rackList, rack];
    onUpdateZone({...zone, rackList, racks:rackList.map(item=>item.name).join(", ")});
    notify(`Đã thêm bản nháp ${rack.name} trong phiên trình duyệt.`);
  };

  return <div className="view-stack zones-view">
    <ViewHeader eyebrow="Một Gateway · Nhiều vùng độc lập" title="Vườn sân thượng" description="Mỗi vùng dinh dưỡng có bồn, ESP32, cảm biến và bơm riêng; nhiều giàn cùng công thức có thể dùng chung một vùng." action={<button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={16}/> Thêm vùng</button>} />

    <section className="station-overview-card">
      <div className="station-gateway"><span><Server size={24}/></span><div><small>GATEWAY TRUNG TÂM</small><strong>HydroFlow Backend</strong><p><StatusDot status={health.connected?"online":"offline"}/> {health.connected?"API cục bộ đang phản hồi":"Chưa kết nối API cục bộ"}</p></div></div>
      <div className="station-kpis"><span><small>Vùng mô hình UI</small><b>{zones.length}</b></span><span><small>ESP32 đang kết nối</small><b>—</b></span><span><small>Snapshot cần chú ý</small><b className={warningCount ? "warning-text" : ""}>{warningCount}</b></span></div>
      <div className="station-route"><Cpu size={17}/><span>Source hiện tại định danh dữ liệu chủ yếu theo <b>deviceId</b>; mô hình nhiều vùng và nhiều giàn bên dưới là kiến trúc frontend mở rộng dự kiến.</span></div>
    </section>

    <section className="zone-card-grid">
      {zones.map((zone) => {
        const selected = zone.id === selectedZoneId;
        return <article className={`zone-card ${selected ? "selected" : ""} ${zone.status}`} key={zone.id}>
          <div className="zone-card-top"><span className="zone-symbol"><Sprout size={20}/></span><div><small>VÙNG DINH DƯỠNG</small><h2>{zone.name}</h2></div><div className="zone-card-actions"><button className="edit-zone-button" onClick={() => openEdit(zone)} aria-label={`Chỉnh sửa ${zone.name}`} title="Chỉnh sửa thông tin vùng"><Pencil size={14}/><span>Chỉnh sửa</span></button><span className={`zone-state ${zone.status}`}><StatusDot status={zone.status}/>{zone.status === "online" ? "Ổn định" : zone.status === "warning" ? "Cần chú ý" : "Chưa ghép cặp"}</span></div></div>
          <div className="zone-crop"><div><small>BỒN DÙNG CHUNG</small><strong>{zone.tank}</strong><p>{zone.rackList.length} giàn · {activeSeasonCount(zone)} mùa vụ đang chạy</p></div><span data-testid={`zone-target-${zone.id}`}><small>TDS hiện tại</small><b>{zone.status === "offline" ? "—" : formatOptionalNumber(zone.tds,0)} {zone.tds === null ? null : <em>ppm</em>}</b><p>Mục tiêu vùng {zone.targetTdsMin}–{zone.targetTdsMax}</p></span></div>
          <div className="rack-mini-list">{zone.rackList.map(rack=><div key={rack.id}><span><strong>{rack.name}</strong><small>{rack.location}</small></span>{rack.crop?<span><b>{rack.crop.name} · {rack.crop.variety}</b><small>Ngày {cropAgeDays(rack.crop.sowDate)} · {rack.crop.targetTds-50}–{rack.crop.targetTds+50} ppm</small></span>:<em>Chưa thiết lập mùa vụ</em>}</div>)}<button onClick={()=>addRack(zone)}><Plus size={14}/> Thêm giàn</button></div>
          <div className="zone-device"><span><Cpu size={15}/><div><small>ESP32</small><b>{zone.deviceId}</b></div></span><span><Network size={15}/><div><small>IP cục bộ</small><b>{zone.espIp}</b></div></span><span><Gauge size={15}/><div><small>Mực nước</small><b>{zone.waterLevel}</b></div></span></div>
          {zone.status === "warning" && <div className="zone-alert"><AlertTriangle size={15}/><span>Mực nước thấp — Auto Dosing đã được khóa an toàn.</span></div>}
          {zone.status === "offline" && <div className="zone-alert offline"><WifiOff size={15}/><span>Chưa ghép cặp ESP32. Vùng chưa thể nhận dữ liệu hoặc điều khiển.</span></div>}
          <button className={selected ? "selected-zone-button" : "open-zone-button"} onClick={() => onSelect(zone.id, true)}>{selected ? <><Check size={15}/> Vùng đang được chọn</> : <>Mở vùng này <span>→</span></>}</button>
        </article>;
      })}
    </section>

    <section className="panel zone-principle"><span><ShieldCheck size={21}/></span><div><strong>Mô hình mở rộng dự kiến</strong><p>Frontend được thiết kế trước với <b>siteId, zoneId, reservoirId, rackId, seasonId và deviceId</b>. Source hiện tại vẫn định danh dữ liệu chủ yếu theo <b>deviceId</b>; các field còn lại sẽ được chốt khi tích hợp Backend, không phải API contract hiện hành.</p></div></section>

    {showAdd && <div className="modal-backdrop"><div className="confirm-modal add-zone-modal"><span className="modal-icon"><Plus size={24}/></span><h2>Thêm vùng dinh dưỡng</h2><p>Tạo vùng trước, sau đó ghép cặp ESP32, cảm biến và các kênh bơm của vùng đó.</p><div className="add-zone-fields"><label>Tên vùng<input value={newName} onChange={(e) => setNewName(e.target.value)}/></label><label>Cây dự kiến<input value={newCrop} onChange={(e) => setNewCrop(e.target.value)}/></label></div><div className="modal-facts"><span>Một vùng cần <b>bồn riêng</b></span><span>Định danh ESP32 <b>không trùng lặp</b></span><span>Trạng thái ban đầu <b>Chưa ghép cặp</b></span></div><div className="modal-actions"><button className="secondary-button" onClick={() => setShowAdd(false)}>Hủy</button><button className="primary-button" onClick={addZone}><Plus size={15}/> Tạo vùng</button></div></div></div>}
    {editingZone && <div className="modal-backdrop"><div className="confirm-modal edit-zone-modal"><span className="modal-icon"><Pencil size={22}/></span><h2>Chỉnh sửa vùng dinh dưỡng</h2><p>Giàn và mùa vụ được quản lý riêng, không gộp vào tên vùng.</p><div className="edit-zone-fields"><label className="wide">Tên vùng<input value={editDraft.name} onChange={(e) => setEditDraft({...editDraft, name:e.target.value})}/></label><label>Bồn của vùng<input value={editDraft.tank} onChange={(e) => setEditDraft({...editDraft, tank:e.target.value})}/></label><label>Device ID<input value={editDraft.deviceId} onChange={(e) => setEditDraft({...editDraft, deviceId:e.target.value})}/></label><label>IP ESP32<input value={editDraft.espIp} onChange={(e) => setEditDraft({...editDraft, espIp:e.target.value})}/></label></div><div className="modal-actions"><button className="secondary-button" onClick={() => setEditingZone(null)}>Hủy</button><button className="primary-button" onClick={saveEdit}><Check size={15}/> Lưu thay đổi</button></div></div></div>}
  </div>;
}

function MonitoringView({ zone, runtimeDataAvailable, health, snapshot }: { zone: GrowingZone; runtimeDataAvailable:boolean; health:GatewayHealth; snapshot:DeviceSnapshot|null }) {
  const [metric, setMetric] = useState("TDS");
  return <div className="view-stack">
    <ViewHeader eyebrow="Dữ liệu Backend" title={`Giám sát ${zone.name}`} description={`${zone.racks} · Snapshot hiện tại được đọc từ API cho ${zone.deviceId}.`} action={<div className="live-chip"><Radio size={14} /> {runtimeDataAvailable?"RUNTIME":"CHƯA CÓ DỮ LIỆU"}</div>} />
    <section className="sensor-grid">
      <article className="sensor-card featured"><div className="sensor-card-head"><span><Droplets size={19} /></span><em>TDS / EC</em><b>{snapshot?.tdsCalibrationSetId?(snapshot.tdsControlValid?"Control valid":"Chỉ đọc · chưa ổn định"):"Chưa hiệu chuẩn"}</b></div><div className="sensor-main"><strong>{runtimeDataAvailable?formatOptionalNumber(snapshot?.tdsPpm??null,2):"—"}</strong><span>{snapshot?.tdsPpm===null?"":"ppm"}</span></div><div className="sensor-secondary"><span>EC <b>{runtimeDataAvailable&&snapshot?.ecUsCm!==null?`${formatOptionalNumber(snapshot?.ecUsCm??null,2)} µS/cm`:"—"}</b></span><span>ADC thô <b>{runtimeDataAvailable?formatOptionalNumber(snapshot?.tdsRaw??null,0):"—"}</b></span><span>Điện áp <b>{runtimeDataAvailable&&snapshot?.tdsVoltage!==null?`${formatOptionalNumber(snapshot?.tdsVoltage??null,3)} V`:"—"}</b></span></div><TinyTrend /></article>
      <article className="sensor-card"><div className="sensor-card-head amber"><span><Thermometer size={19} /></span><em>Nhiệt độ nước</em><b>{runtimeDataAvailable?"Backend":"Chưa có dữ liệu"}</b></div><div className="sensor-main"><strong>{runtimeDataAvailable?formatOptionalNumber(snapshot?.waterTemp??null,1):"—"}</strong><span>{snapshot?.waterTemp===null?"":"°C"}</span></div><div className="sensor-range"><span>0°C</span><div><i style={{width:runtimeDataAvailable&&snapshot?.waterTemp!==null?`${(snapshot?.waterTemp??0) * 2}%`:"0%"}} /></div><span>50°C</span></div><p className="sensor-foot">Không suy diễn tính hợp lệ khi API chưa cung cấp quality contract</p></article>
      <article className="sensor-card"><div className="sensor-card-head violet"><span><Gauge size={19} /></span><em>Mực nước</em><b>{runtimeDataAvailable?zone.waterLevel:"—"}</b></div><div className="water-level-visual"><div className="tank"><i /><i /><i /></div><div><strong>{runtimeDataAvailable?zone.waterLevel:"Chưa có dữ liệu"}</strong><span>Trạng thái snapshot Backend</span></div></div><p className="sensor-foot">Readiness dosing không được suy ra tại frontend</p></article>
    </section>
    <details className="planned-modules panel"><summary>Module dự kiến</summary><div><span><FlaskConical size={18}/></span><p><b>Cảm biến pH</b><small>Chưa có trong source và phần cứng hiện tại; không được dùng để kết luận hoặc điều khiển.</small></p></div></details>
    <section className="dashboard-grid two-one monitor-layout">
      <article className="panel tall-trend">
        <div className="panel-head"><div><span className="panel-kicker">Bản xem trước chỉ đọc</span><h2>Biểu đồ cảm biến</h2></div><div className="segmented">{["TDS","EC","Nhiệt độ"].map(x=><button key={x} className={metric===x?"active":""} onClick={()=>setMetric(x)}>{x}</button>)}</div></div>
        <div className="trend-statline"><div><span>Giá trị hiện tại</span><strong>{runtimeDataAvailable?(metric === "TDS" ? (snapshot?.tdsPpm===null?"Chưa hiệu chuẩn":`${formatOptionalNumber(snapshot?.tdsPpm??null,2)} ppm`) : metric === "EC" ? (snapshot?.ecUsCm===null?"Chưa hiệu chuẩn":`${formatOptionalNumber(snapshot?.ecUsCm??null,2)} µS/cm`) : (snapshot?.waterTemp===null?"—":`${formatOptionalNumber(snapshot?.waterTemp??null,1)} °C`)):"—"}</strong></div><span className="trend-change">Chưa tích hợp chuỗi thời gian</span></div>
        <div className="chart-legend"><span data-testid="monitoring-target"><i className="legend-zone"/> Vùng mục tiêu {zone.targetTdsMin}–{zone.targetTdsMax} ppm</span></div>
        <TrendChart targetMin={zone.targetTdsMin} targetMax={zone.targetTdsMax} />
      </article>
      <article className="panel connection-panel">
        <div className="panel-head"><div><span className="panel-kicker">Kiến trúc Local-first</span><h2>Luồng kết nối</h2></div><span className="status-chip muted">Sơ đồ</span></div>
        <div className="connection-flow local-flow">
          <div><span><UserRound size={18} /></span><strong>Local Web UI</strong><small>Người vận hành</small></div><i><Activity size={15} /></i><div><span><Server size={18} /></span><strong>Backend / API</strong><small>Kiểm tra quyền & an toàn</small></div><i><Network size={15} /></i><div><span><Radio size={18} /></span><strong>MQTT · {zone.deviceId}</strong><small>Điều khiển cục bộ</small></div>
        </div>
        <p className="architecture-note">Database chỉ được đọc/ghi qua Backend/API. Cloud chưa tích hợp và không nằm trong đường điều khiển bơm.</p>
        <details className="technical-details"><summary>Chi tiết kỹ thuật</summary><ul className="connection-list"><li><span><Wifi size={15}/></span><div><b>Backend REST</b><small>Endpoint health</small></div><em>{health.connected?"Online":"Offline"}</em></li><li><span><Network size={15}/></span><div><b>MQTT Broker</b><small>Topic do Backend cấu hình</small></div><em>{health.mqttConnected?"Connected":"Chưa xác nhận"}</em></li><li><span><Database size={15}/></span><div><b>Local Database</b><small>{health.databaseEngine??"Engine chưa xác nhận"}</small></div><em>{health.mongoConnected?"Connected":"Chưa xác nhận"}</em></li><li><span><Cloud size={15}/></span><div><b>Cloud Sync</b><small>Chưa có Backend</small></div><em>Chưa tích hợp</em></li></ul></details>
      </article>
    </section>
    <details className="panel mqtt-panel technical-details"><summary>Chi tiết kỹ thuật · MQTT</summary><div className="dataset-preview"><Network size={22}/><div><strong>Message stream chưa tích hợp</strong><p>Frontend không tự tạo bản ghi MQTT minh họa; trạng thái kết nối chỉ lấy từ Backend health.</p></div></div></details>
  </div>;
}

function PumpControlCard({ name, subtitle, letter, running, color, onAction, nutrient = false, disabled = false }: { name:string; subtitle:string; letter:string; running:boolean; color:string; onAction:(duration?:string)=>void; nutrient?:boolean; disabled?:boolean }) {
  const [duration, setDuration] = useState("500");
  return <article className={`pump-control-card ${disabled?"actuator-disabled":""}`}><div className="pump-control-head"><span className={`pump-large ${color}`}>{letter === "M" ? <Power size={23}/> : letter}</span><div><strong>{name}</strong><p>{subtitle}</p></div><span className={`status-chip ${disabled?"muted":running?"success":"muted"}`}>{disabled?"Bị khóa":running?"Đang chạy":"Sẵn sàng"}</span></div><div className="pump-visual"><div className={`motor ${running?"rotating":""}`}><i/><i/><i/></div><div className={`flow-line ${running?"active":""}`}><i/><i/><i/></div></div>{nutrient?<div className="pulse-controls"><label>Thời gian pulse<input aria-label={`Thời gian pulse bơm ${letter}`} type="number" min="50" max="5000" step="50" value={duration} onChange={e=>setDuration(e.target.value)} disabled={disabled}/><span>ms</span></label><button disabled={disabled} onClick={()=>onAction(duration)}><Play size={15}/> Chạy pulse thử</button></div>:<button className={`pump-main-action ${running?"stop":""}`} disabled={disabled} onClick={()=>onAction()}><Power size={16}/> {running?"Tắt bơm hồi lưu":"Bật bơm hồi lưu"}</button>}</article>;
}

function PumpsView({ deviceId, mainPump, notify, onNavigate, capabilities }: { deviceId:string; mainPump:boolean; notify:(text:string)=>void; onNavigate:(view:View)=>void; capabilities:SystemCapabilities }) {
  const [confirmPump, setConfirmPump] = useState<{pump:"A"|"B";duration:number}|null>(null);
  const actuatorAvailable=!capabilities.actuatorsLocked&&capabilities.pumpCommandsEnabled;
  const requestMainPump=async()=>{try{await backendApiAdapter.setMainPump(deviceId,!mainPump);notify(`Đã chuyển yêu cầu ${mainPump?"tắt":"bật"} bơm hồi lưu tới Backend; chờ trạng thái xác nhận`);}catch(error){notify(error instanceof Error?error.message:"Backend từ chối yêu cầu điều khiển");}};
  return <div className="view-stack"><ViewHeader eyebrow="Điều khiển cục bộ" title="Điều khiển bơm" description="Lệnh được kiểm tra an toàn tại Edge Gateway trước khi gửi tới ESP32." action={<span className="local-only-badge"><ShieldCheck size={15}/> Điều khiển Local</span>} />
    <div className={`safety-notice ${actuatorAvailable?"":"locked"}`} data-testid="pump-capability-banner"><ShieldCheck size={20}/><div><strong>{actuatorAvailable?"Backend cho phép gửi yêu cầu điều khiển":"Thiết bị chấp hành đang bị khóa"}</strong><p>{actuatorAvailable?"Trạng thái chỉ thay đổi sau khi Backend xác nhận; giao diện không cập nhật lạc quan.":capabilities.autoDosingLockReason}</p></div><span>{actuatorAvailable?"Backend authority":"LOCKED"}</span></div>
    <section className="pump-control-grid"><PumpControlCard name="Bơm hồi lưu vùng" subtitle="Kênh điều khiển do Backend quản lý" letter="M" color="main" running={mainPump} disabled={!actuatorAvailable} onAction={requestMainPump}/><PumpControlCard name="Bơm dinh dưỡng A" subtitle="Lưu lượng chưa nạp vào giao diện · CH2" letter="A" color="a" running={false} nutrient disabled={!actuatorAvailable} onAction={(duration)=>setConfirmPump({pump:"A",duration:Math.min(5000,Math.max(50,Number(duration)||500))})}/><PumpControlCard name="Bơm dinh dưỡng B" subtitle="Lưu lượng chưa nạp vào giao diện · CH3" letter="B" color="b" running={false} nutrient disabled={!actuatorAvailable} onAction={(duration)=>setConfirmPump({pump:"B",duration:Math.min(5000,Math.max(50,Number(duration)||500))})}/></section>
    <section className="dashboard-grid equal"><article className="panel"><div className="panel-head"><div><span className="panel-kicker">Trạng thái phần cứng</span><h2>Kiểm tra kênh điều khiển</h2></div><span className="status-chip muted">Chưa có telemetry kênh</span></div><div className="hardware-list">{[["MOSFET CH1","Bơm hồi lưu"],["MOSFET CH2","Bơm A"],["MOSFET CH3","Bơm B"],["MOSFET CH4","Dự phòng"]].map(([ch,name])=><div key={ch}><span className="idle"><Zap size={15}/></span><div><strong>{ch}</strong><p>{name}</p></div><em>Chưa xác minh</em></div>)}</div></article><article className="panel"><div className="panel-head"><div><span className="panel-kicker">Hiệu chuẩn</span><h2>Lưu lượng bơm dinh dưỡng</h2></div><button className="icon-text-button" onClick={()=>onNavigate("calibration")}>Mở hiệu chuẩn →</button></div><div className="calibration-summary"><div><span className="pump-avatar nutrient-a">A</span><div><strong>— ml/s</strong><p>Chưa nạp từ Backend</p></div><span className="status-chip muted">Chưa xác minh</span></div><div><span className="pump-avatar nutrient-b">B</span><div><strong>— ml/s</strong><p>Chưa nạp từ Backend</p></div><span className="status-chip muted">Chưa xác minh</span></div></div><div className="calibration-tip"><AlertTriangle size={16}/><p>Backend vẫn kiểm tra hiệu chuẩn và interlock trước khi chấp nhận mọi pulse.</p></div></article></section>
    {confirmPump && <div className="modal-backdrop"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="pump-confirm-title"><span className="modal-icon"><AlertTriangle size={24}/></span><h2 id="pump-confirm-title">Xác nhận yêu cầu chạy bơm {confirmPump.pump}</h2><p>Backend sẽ kiểm tra lại capability, hiệu chuẩn và interlock trước khi tạo command pulse {confirmPump.duration} ms. Giao diện không tự ước tính thể tích khi chưa nạp lưu lượng.</p><div className="modal-facts"><span>Thời gian pulse <b>{confirmPump.duration} ms</b></span><span>Mực nước <b>Backend kiểm tra</b></span><span>Bơm hồi lưu <b>{mainPump?"Đang chạy":"Đang tắt"}</b></span></div><div className="modal-actions"><button className="secondary-button" onClick={()=>setConfirmPump(null)}>Hủy</button><button className="primary-button" onClick={()=>void (async()=>{try{await backendApiAdapter.pulsePump(deviceId,confirmPump.pump,confirmPump.duration);notify(`Đã chuyển yêu cầu pulse ${confirmPump.duration} ms bơm ${confirmPump.pump} tới Backend`);}catch(error){notify(error instanceof Error?error.message:"Backend từ chối yêu cầu điều khiển");}finally{setConfirmPump(null);}})()}><Play size={15}/> Gửi yêu cầu tới Backend</button></div></div></div>}
  </div>;
}

function DosingView({ mainPump, crop, zone, capabilities }: { mainPump:boolean; crop:CropProfile; zone:GrowingZone; capabilities:SystemCapabilities }) {
  const [target,setTarget]=useState(Math.round((zone.targetTdsMin+zone.targetTdsMax)/2)); const [stepDose,setStepDose]=useState(1); const [maxDose,setMaxDose]=useState(1); const [dailyLimit,setDailyLimit]=useState(2); const [mixMinutes,setMixMinutes]=useState(15); const [requireRecirculation,setRequireRecirculation]=useState(true);
  const targetInZone=target>=zone.targetTdsMin&&target<=zone.targetTdsMax;
  const actuatorAvailable=!capabilities.actuatorsLocked&&capabilities.pumpCommandsEnabled;
  const checks = [["TDS hợp lệ & ổn định","Readiness API chưa tích hợp",false],["Setpoint thuộc mục tiêu vùng",`${target} ppm · vùng ${zone.targetTdsMin}–${zone.targetTdsMax}`,false],["Nhiệt độ hợp lệ","Readiness API chưa tích hợp",false],["Mực nước","Readiness API chưa tích hợp",false],["Bơm A/B đã hiệu chuẩn","Readiness API chưa tích hợp",false],["Bơm hồi lưu",mainPump?"Snapshot: đang chạy":"Snapshot: đang tắt",false],["Capability điều khiển",actuatorAvailable?"Capability thủ công đã xác minh":"Bị khóa",false],["Dosing run hoạt động","Readiness API chưa tích hợp",false]] as const;
  const passedChecks=checks.filter(([, , ok])=>ok).length;
  const readiness=Math.round(passedChecks/checks.length*100);
  const ready=passedChecks===checks.length;
  return <div className="view-stack"><ViewHeader eyebrow="Rule-based · Chỉ đọc" title="Auto Dosing V2" description="Giao diện mới chưa nối API settings/readiness; Backend Phase 22 tiếp tục khóa Auto Dosing OFF." action={<div className="dosing-master"><span><small>TRẠNG THÁI</small><strong>OFF · BỊ KHÓA</strong></span><button type="button" className="switch" role="switch" aria-label="Auto Dosing bị khóa" aria-checked={false} disabled><span/></button></div>} />
    {!actuatorAvailable&&<div className="prototype-warning" data-testid="dosing-capability-lock"><LockKeyhole size={21}/><div><strong>Auto Dosing hiện bị khóa kích hoạt</strong><p>Bạn vẫn có thể xem và lưu cấu hình hợp lệ với Auto Dosing ở trạng thái OFF. Việc lưu cấu hình không tạo lệnh điều khiển bơm.</p><small>Lý do: {capabilities.autoDosingLockReason}.</small></div></div>}
    <section className="dashboard-grid dosing-grid"><article className="panel readiness-panel"><div className="panel-head"><div><span className="panel-kicker">Safety interlock</span><h2>Mức độ sẵn sàng</h2></div><div className="ready-ring" data-testid="dosing-readiness"><b>{readiness}</b><small>%</small></div></div><div className="readiness-list">{checks.map(([label,value,ok])=><div key={label}><span className={ok?"pass":"fail"}>{ok?<Check size={13}/>:<X size={13}/>}</span><strong>{label}</strong><em>{value}</em></div>)}</div><div className={`readiness-result ${ready?"ready":"blocked"}`}><ShieldCheck size={18}/><div><strong>{ready?"Đủ điều kiện để Backend đánh giá":"Đang bị khóa an toàn"}</strong><p>{ready?"Frontend vẫn chờ Backend xác nhận trước mọi thay đổi trạng thái.":"Khắc phục các điều kiện chưa đạt ở danh sách trên."}</p></div></div></article>
      <article className="panel settings-panel"><div className="panel-head"><div><span className="panel-kicker">Cấu hình chỉ đọc</span><h2>Thông số dosing</h2></div><span className="preset-chip"><Sprout size={12}/> Mẫu giao diện · ngày {cropAgeDays(crop.sowDate)}</span></div><div className="crop-linked-target" data-testid="dosing-zone-target"><Sparkles size={15}/><span>Mục tiêu giao diện của {zone.name}: <b>{zone.targetTdsMin}–{zone.targetTdsMax} ppm</b>. Chưa đồng bộ với settings Backend.</span></div><div className="settings-form"><label>TDS setpoint<div><input aria-invalid={!targetInZone} value={target} onChange={e=>setTarget(Number(e.target.value))} type="number" disabled/><span>ppm</span></div></label><label>Liều mỗi bước / bơm<div><input value={stepDose} onChange={e=>setStepDose(Number(e.target.value))} type="number" disabled/><span>ml</span></div></label><label>Liều tối đa / run<div><input value={maxDose} onChange={e=>setMaxDose(Number(e.target.value))} type="number" disabled/><span>ml</span></div></label><label>Giới hạn ngày / bơm<div><input value={dailyLimit} onChange={e=>setDailyLimit(Number(e.target.value))} type="number" disabled/><span>ml</span></div></label><label>Thời gian chờ trộn<div><input value={mixMinutes} onChange={e=>setMixMinutes(Number(e.target.value))} type="number" disabled/><span>phút</span></div></label><label className="check-setting"><input type="checkbox" checked={requireRecirculation} onChange={e=>setRequireRecirculation(e.target.checked)} disabled/> Yêu cầu bơm hồi lưu đang chạy</label></div><button className="save-settings" disabled>Backend settings chưa tích hợp</button><p className="save-safety-note"><ShieldCheck size={14}/> Trang này không thể bật Auto Dosing hoặc gửi lệnh tới ESP32.</p></article></section>
    <section className="panel dosing-sequence"><div className="panel-head"><div><span className="panel-kicker">Mô tả thuật toán chỉ đọc</span><h2>Chuỗi vận hành dự kiến</h2></div><span className="status-chip muted">Không phải run runtime</span></div><div className="sequence-flow">{[["01","Đánh giá an toàn","Backend"],["02","Pulse bơm A","Sau interlock"],["03","Pulse bơm B","Sau A hoàn tất"],["04","Chờ trộn","Theo settings"],["05","Đọc lại TDS","Measurement mới"],["06","Kết luận","Backend authority"]].map(([n,t,v])=><div key={n}><span>{n}</span><strong>{t}</strong><small>{v}</small></div>)}</div></section>
    <section className="dashboard-grid equal"><article className="panel"><div className="panel-head"><div><span className="panel-kicker">Giới hạn ngày</span><h2>Lượng dinh dưỡng đã dùng</h2></div><span className="date-chip"><CalendarDays size={13}/> Chưa nạp</span></div><div className="usage-bars"><div><div><strong>Bơm A</strong><span>— ml</span></div><i><b style={{width:"0%"}}/></i></div><div className="b"><div><strong>Bơm B</strong><span>— ml</span></div><i><b style={{width:"0%"}}/></i></div></div><p className="usage-note"><ShieldCheck size={14}/> Chưa tích hợp endpoint thống kê giới hạn ngày.</p></article><article className="panel"><div className="panel-head"><div><span className="panel-kicker">Run gần nhất</span><h2>Kết quả đáp ứng dinh dưỡng</h2></div><span className="status-chip muted">Chưa nạp</span></div><div className="response-kpis"><span><small>Trước dosing</small><b>—</b></span><span><small>Sau trộn</small><b>—</b></span><span><small>Chênh lệch</small><b>—</b></span></div><button className="full-button" disabled>Chưa tích hợp lịch sử run</button></article></section>
  </div>;
}

function GardenView({ notify, onNavigate, zone, onUpdateZone }: { notify: (text: string) => void; onNavigate: (view: View) => void; zone: GrowingZone; onUpdateZone:(zone:GrowingZone)=>void }) {
  const [rackId, setRackId] = useState(()=>{const match=typeof window!=="undefined"?window.location.pathname.match(/^\/racks\/([^/]+)/):null;return zone.rackList.some(item=>item.id===match?.[1])?match![1]:zone.rackList[0]?.id??"";});
  const rack = zone.rackList.find(item=>item.id===rackId) ?? zone.rackList[0];
  const crop = rack?.crop ?? zone.crop;
  const [draft, setDraft] = useState(crop);
  const [source, setSource] = useState<"ai" | "manual">("ai");
  const [showImpact, setShowImpact] = useState(false);
  const [applyMin,setApplyMin]=useState(draft.targetTds-50);
  const [applyMax,setApplyMax]=useState(draft.targetTds+50);
  const impactModalRef=useRef<HTMLDivElement>(null);
  const impactTriggerRef=useRef<HTMLButtonElement>(null);
  const age = cropAgeDays(draft.sowDate);
  const harvestIn = daysUntil(draft.harvestDate);
  const isolationStart = shiftDate(draft.harvestDate, -draft.isolationDays);
  const update = (key: keyof CropProfile, value: string | number) => setDraft({ ...draft, [key]: value });
  const save = () => {
    const rackList=zone.rackList.map(item=>item.id===rack.id?{...item,crop:draft}:item);
    onUpdateZone({...zone,rackList,crop:rackList[0]?.crop ?? draft});
    notify(`Đã cập nhật bản nháp mùa vụ cho ${rack.name}; chưa lưu Backend`);
  };
  const seasons=zone.rackList.filter(item=>item.crop).map(item=>({rack:item,min:(item.crop?.targetTds??0)-50,max:(item.crop?.targetTds??0)+50}));
  const overlapMin=seasons.length?Math.max(...seasons.map(item=>item.min)):draft.targetTds-50;
  const overlapMax=seasons.length?Math.min(...seasons.map(item=>item.max)):draft.targetTds+50;
  const compatible=overlapMin<=overlapMax;
  const canApply=compatible&&applyMin<=applyMax&&applyMin>=overlapMin&&applyMax<=overlapMax;
  const openImpact=()=>{setApplyMin(compatible?overlapMin:draft.targetTds-50);setApplyMax(compatible?overlapMax:draft.targetTds+50);setShowImpact(true)};
  const closeImpact=()=>{setShowImpact(false);window.setTimeout(()=>impactTriggerRef.current?.focus(),0)};
  useEffect(()=>{
    if(!showImpact)return;
    const modal=impactModalRef.current;
    const focusable=()=>Array.from(modal?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')??[]);
    focusable()[0]?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();closeImpact();return;}
      if(event.key!=="Tab")return;
      const items=focusable();if(!items.length)return;const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);
  },[showImpact]);
  return <div className="view-stack garden-view">
    <ViewHeader eyebrow="Mùa vụ theo từng giàn" title="Mùa vụ của giàn" description="Mỗi giàn có tối đa một mùa vụ đang hoạt động; đề xuất dinh dưỡng chỉ tác động đến vùng sau khi người dùng duyệt." action={<button className="primary-button" onClick={save}><Check size={16}/> Lưu mùa vụ</button>} />
    <section className="rack-context-picker"><label>Giàn đang xem<select value={rackId} onChange={e=>{const nextId=e.target.value;const nextRack=zone.rackList.find(item=>item.id===nextId);setRackId(nextId);setDraft(nextRack?.crop??zone.crop);setSource("ai");window.history.pushState({},"",nextRack?.crop?`/racks/${nextId}/seasons/${nextId}-active`:`/racks/${nextId}/seasons/new`)}}>{zone.rackList.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><span>{zone.name} · {zone.tank}</span></section>
    <section className="crop-hero-card">
      <div className="crop-hero-plant"><Sprout size={34}/><span>ĐANG TRỒNG</span></div>
      <div className="crop-hero-copy"><small>{zone.name.toUpperCase()} · {rack.name.toUpperCase()}</small><h2>{draft.name} · {draft.variety}</h2><p>Ngày {age} của mùa vụ · Giai đoạn sinh trưởng thân lá</p><div className="crop-progress"><i style={{width:`${Math.min(100, Math.max(4, age / Math.max(1, age + harvestIn) * 100))}%`}}/></div><div className="crop-progress-labels"><span>Gieo hạt</span><b>Hôm nay · ngày {age}</b><span>Thu hoạch</span></div></div>
      <div className="crop-hero-kpis"><span><small>TDS mục tiêu</small><b>{draft.targetTds - 50}–{draft.targetTds + 50}</b><em>ppm</em></span><span><small>Dự kiến thu hoạch</small><b>{harvestIn}</b><em>ngày nữa</em></span></div>
    </section>

    <section className="garden-grid">
      <article className="panel crop-form-card">
        <div className="panel-head"><div><span className="panel-kicker">Thông tin đầu vào</span><h2>Lịch mùa vụ</h2></div><span className="status-chip success">Đang hoạt động</span></div>
        <div className="crop-form-grid">
          <label>Loại cây<select value={draft.name} onChange={e=>update("name",e.target.value)}><option>Xà lách</option><option>Cải xanh</option><option>Cải kale</option><option>Rau muống</option><option>Húng quế</option></select></label>
          <label>Giống cây<input value={draft.variety} onChange={e=>update("variety",e.target.value)}/></label>
          <label>Ngày gieo hạt<input type="date" value={draft.sowDate} onChange={e=>update("sowDate",e.target.value)}/></label>
          <label>Ngày dự kiến thu hoạch<input type="date" value={draft.harvestDate} onChange={e=>update("harvestDate",e.target.value)}/></label>
        </div>
        <div className="age-callout"><CalendarDays size={18}/><div><strong>Tuổi cây được tự động tính: {age} ngày</strong><p>Nếu mua cây giống, hãy nhập ngày gieo ước tính hoặc điều chỉnh tuổi cây theo nhãn của nhà vườn.</p></div></div>
      </article>
      <article className="panel nutrient-plan-card">
        <div className="panel-head"><div><span className="panel-kicker">Mục tiêu dinh dưỡng</span><h2>Chọn cách thiết lập</h2></div></div>
        <div className="plan-source"><button className={source==="ai"?"active":""} onClick={()=>setSource("ai")}><Sparkles size={17}/><span><b>AI đề xuất</b><small>Dựa trên cây, tuổi và dữ liệu cảm biến</small></span></button><button className={source==="manual"?"active":""} onClick={()=>setSource("manual")}><SlidersHorizontal size={17}/><span><b>Tự cài đặt</b><small>Nhập mục tiêu theo kinh nghiệm</small></span></button></div>
        {source==="ai"?<div className="ai-plan"><span><Sparkles size={20}/></span><div><small>ĐỀ XUẤT CHO NGÀY {age}</small><strong>{draft.targetTds - 50}–{draft.targetTds + 50} ppm</strong><p>Đề xuất của mùa vụ; khi áp dụng sẽ ảnh hưởng mọi giàn dùng chung bồn.</p></div><button ref={impactTriggerRef} onClick={openImpact}>Xem ảnh hưởng</button></div>:<label className="manual-target">TDS trung tâm<div><input type="number" value={draft.targetTds} onChange={e=>update("targetTds",Number(e.target.value))}/><span>ppm</span></div></label>}
      </article>
    </section>

    <section className="panel stage-plan">
      <div className="panel-head"><div><span className="panel-kicker">Theo tuổi cây</span><h2>Lộ trình dinh dưỡng theo giai đoạn</h2></div><button className="icon-text-button" onClick={()=>onNavigate("assistant")}><Bot size={14}/> Hỏi kỹ sư AI</button></div>
      <div className="stage-cards">
        {[{n:"01",title:"Ươm cây",days:"Ngày 0–7",tds:"250–350 ppm",state:"done"},{n:"02",title:"Ra rễ",days:"Ngày 8–14",tds:"300–400 ppm",state:"done"},{n:"03",title:"Sinh trưởng",days:"Ngày 15–27",tds:`${draft.targetTds-50}–${draft.targetTds+50} ppm`,state:"active"},{n:"04",title:"Trước thu hoạch",days:`${draft.isolationDays} ngày cuối`,tds:`Mục tiêu ${draft.isolationTds} ppm`,state:"upcoming"}].map(x=><div className={`stage-card ${x.state}`} key={x.n}><span>{x.state==="done"?<Check size={14}/>:x.n}</span><small>{x.days}</small><strong>{x.title}</strong><p>{x.tds}</p>{x.state==="active"&&<em>Đang áp dụng</em>}</div>)}
      </div>
    </section>

    <section className="panel isolation-card">
      <div className="isolation-head"><span><LockKeyhole size={21}/></span><div><span className="panel-kicker">Tùy chọn có kiểm soát</span><h2>Giảm dinh dưỡng trước thu hoạch</h2><p>Không phải cây nào cũng cần ngừng dinh dưỡng hoàn toàn. Hệ thống chỉ giảm về mục tiêu đã đặt và luôn yêu cầu xác nhận.</p></div><span className="status-chip muted">Chưa kích hoạt</span></div>
      <div className="isolation-settings"><label>Số ngày trước thu hoạch<div><input type="number" min="0" max="14" value={draft.isolationDays} onChange={e=>update("isolationDays",Number(e.target.value))}/><span>ngày</span></div></label><label>TDS mục tiêu giai đoạn giảm<div><input type="number" min="0" value={draft.isolationTds} onChange={e=>update("isolationTds",Number(e.target.value))}/><span>ppm</span></div></label><div className="isolation-date"><small>BẮT ĐẦU DỰ KIẾN</small><b>{formatViDate(isolationStart)}</b><span>Hệ thống sẽ nhắc trước 24 giờ</span></div></div>
      <div className="safety-inline"><ShieldCheck size={15}/><span>Auto Dosing sẽ không tự chuyển giai đoạn nếu chưa có người dùng duyệt đề xuất.</span></div>
    </section>
    {showImpact&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closeImpact()}}><div ref={impactModalRef} className="confirm-modal impact-modal" role="dialog" aria-modal="true" aria-labelledby="tds-impact-title"><button className="modal-close" onClick={closeImpact} aria-label="Đóng hộp thoại áp dụng mục tiêu TDS"><X size={18}/></button><span className="modal-icon"><FlaskConical size={23}/></span><h2 id="tds-impact-title">Áp dụng mục tiêu cho {zone.name}</h2><p>Mục tiêu TDS là cấu hình của toàn vùng; lưu mục tiêu không bật Auto Dosing.</p><div className="tds-comparison"><span><small>Đề xuất của Mùa vụ {draft.variety} — {rack.name.replace("Giàn ","")}</small><b>{draft.targetTds-50}–{draft.targetTds+50} ppm</b></span><span><small>Khoảng tương thích của toàn {zone.name}</small><b>{compatible?`${overlapMin}–${overlapMax} ppm`:"Không có khoảng giao nhau"}</b></span><span><small>Mục tiêu đang dùng của vùng</small><b>{zone.targetTdsMin}–{zone.targetTdsMax} ppm</b></span></div><fieldset className="apply-target-fields" disabled={!compatible}><legend>Mục tiêu sẽ áp dụng cho vùng</legend><label><span>Từ</span><input type="number" value={applyMin} onChange={e=>setApplyMin(Number(e.target.value))}/><em>ppm</em></label><i>–</i><label><span>Đến</span><input type="number" value={applyMax} onChange={e=>setApplyMax(Number(e.target.value))}/><em>ppm</em></label></fieldset><div className="impact-facts"><span><small>Bồn</small><b>{zone.tank.replace("Bồn ","")}</b></span><span><small>Giàn bị ảnh hưởng</small><b>{zone.rackList.map(item=>item.name.replace("Giàn ","")).join(", ")}</b></span><span><small>Mùa vụ bị ảnh hưởng</small><b>{seasons.map(item=>item.rack.crop?.variety).filter(Boolean).join(", ")}</b></span></div>{compatible?<div className="safety-inline"><ShieldCheck size={15}/><span>Các mùa vụ tương thích trong khoảng chung {overlapMin}–{overlapMax} ppm. Auto Dosing vẫn OFF sau khi áp dụng.</span></div>:<div className="zone-alert conflict-alert" role="alert"><AlertTriangle size={15}/><span><b>Xung đột:</b> {seasons.map(item=>`${item.rack.name.replace("Giàn ","")} · ${item.rack.crop?.variety} (${item.min}–${item.max} ppm)`).join("; ")}.<small>Chọn một phương án: điều chỉnh lại mục tiêu mùa vụ; chuyển giàn sang vùng dinh dưỡng khác; hoặc tạo vùng dinh dưỡng riêng.</small></span></div>}{compatible&&!canApply&&<p className="field-error" role="alert">Mục tiêu áp dụng phải nằm trong khoảng tương thích {overlapMin}–{overlapMax} ppm.</p>}<div className="modal-actions"><button className="secondary-button" onClick={closeImpact}>Hủy</button><button className="primary-button" disabled={!canApply} onClick={()=>{onUpdateZone({...zone,targetTdsMin:applyMin,targetTdsMax:applyMax});closeImpact();notify(`Đã áp dụng ${applyMin}–${applyMax} ppm cho ${zone.name}; Auto Dosing vẫn OFF`)}}><Check size={15}/> Áp dụng {applyMin}–{applyMax} ppm cho {zone.name}</button></div></div></div>}
  </div>;
}

function AiActionCenter({ crop, setCrop, notify, zone }: { crop: CropProfile; setCrop: (crop: CropProfile) => void; notify: (text: string) => void; zone:GrowingZone }) {
  const [running, setRunning] = useState<AiActionKind | null>(null);
  const [result, setResult] = useState<AiActionResult | null>(null);

  const runAction = (kind: AiActionKind) => {
    setRunning(kind);
    setResult(null);
    window.setTimeout(() => {
      const results: Record<AiActionKind, AiActionResult> = {
        nutrient: {
          kind,
          title: "Mục tiêu dinh dưỡng hôm nay",
          status: "Đề xuất an toàn",
          summary: `TDS hiện tại được đánh giá theo mục tiêu vùng ${zone.targetTdsMin}–${zone.targetTdsMax} ppm. Không tự tăng liều; đánh giá lại sau một chu kỳ tuần hoàn.`,
          fields: [
            { label: "TDS mục tiêu", value: `${Math.round((zone.targetTdsMin+zone.targetTdsMax)/2)} ppm` },
            { label: "Vùng cho phép", value: `${zone.targetTdsMin}–${zone.targetTdsMax} ppm` },
            { label: "Đánh giá lại", value: "Sau 4 giờ" },
          ],
          targetTds: Math.round((zone.targetTdsMin+zone.targetTdsMax)/2),
        },
        harvest: {
          kind,
          title: "Kế hoạch trước thu hoạch",
          status: "Cần người dùng duyệt",
          summary: `Với ${crop.name} ${crop.variety}, có thể đặt giai đoạn giảm dinh dưỡng trong 3 ngày cuối và theo dõi màu lá, rễ trước khi xác nhận.`,
          fields: [
            { label: "Bắt đầu dự kiến", value: formatViDate(shiftDate(crop.harvestDate, -3)) },
            { label: "Thời gian giảm", value: "3 ngày" },
            { label: "TDS gợi ý", value: "180 ppm" },
          ],
          isolationDays: 3,
          isolationTds: 180,
        },
        health: {
          kind,
          title: "Kiểm tra sức khỏe hệ thống",
          status: "Theo dõi",
          summary: "Chưa thấy bất thường rõ từ TDS, nhiệt độ và mực nước. Dữ liệu pH còn thiếu nên AI không kết luận tình trạng hấp thu dinh dưỡng.",
          fields: [
            { label: "Mức ưu tiên", value: "Trung bình" },
            { label: "Điểm cần bổ sung", value: "Đo pH thủ công" },
            { label: "Kiểm tra lại", value: "Trong 4 giờ" },
          ],
        },
      };
      setResult(results[kind]);
      setRunning(null);
    }, 850);
  };

  const applyResult = () => {
    if (!result) return;
    setCrop({
      ...crop,
      targetTds: result.targetTds ?? crop.targetTds,
      isolationDays: result.isolationDays ?? crop.isolationDays,
      isolationTds: result.isolationTds ?? crop.isolationTds,
    });
    notify(result.kind === "nutrient" ? "Đã đưa mục tiêu AI vào đề xuất mùa vụ; mục tiêu vùng chưa thay đổi" : "Đã điền lịch giảm dinh dưỡng từ đề xuất AI");
  };

  const actions = [
    { id: "nutrient" as const, icon: FlaskConical, title: "Tối ưu dinh dưỡng", text: "Trả về TDS mục tiêu, vùng cho phép và thời điểm đánh giá lại." },
    { id: "harvest" as const, icon: CalendarDays, title: "Lập kế hoạch thu hoạch", text: "Đề xuất ngày bắt đầu, thời gian và nồng độ giai đoạn giảm." },
    { id: "health" as const, icon: Activity, title: "Kiểm tra bất thường", text: "Đánh giá cảm biến, dữ liệu còn thiếu và việc cần làm tiếp theo." },
  ];

  return <section className="panel ai-action-center">
    <div className="panel-head"><div><span className="panel-kicker">Mẫu giao diện AI</span><h2>Phân tích nhanh và tự điền giá trị</h2></div><span className="status-chip muted"><LockKeyhole size={13}/> Chưa kết nối</span></div>
    <p className="ai-action-intro">Các action được giữ để thể hiện thiết kế tương lai. Frontend hiện không gọi model, không tự điền dữ liệu và không gửi lệnh điều khiển.</p>
    <div className="ai-action-grid">{actions.map(({id,icon:Icon,title,text})=><button key={id} className={running===id?"running":""} onClick={()=>runAction(id)} disabled><span><Icon size={20}/></span><div><strong>{title}</strong><p>{text}</p></div><Sparkles size={17}/></button>)}</div>
    {result && <div className="ai-structured-result">
      <div className="ai-result-head"><span><Bot size={19}/></span><div><small>KẾT QUẢ ĐÚNG ĐỊNH DẠNG</small><strong>{result.title}</strong></div><em>{result.status}</em></div>
      <p>{result.summary}</p>
      <div className="ai-result-fields">{result.fields.map(field=><span key={field.label}><small>{field.label}</small><b>{field.value}</b></span>)}</div>
      <div className="ai-result-actions"><span><CircleCheck size={15}/> Đã kiểm tra đủ trường dữ liệu</span>{result.kind!=="health"&&<button onClick={applyResult}><Check size={15}/> Dùng làm đề xuất mùa vụ</button>}</div>
    </div>}
  </section>;
}

function AssistantView({ crop, setCrop, notify, onNavigate, zone }: { crop: CropProfile; setCrop: (crop: CropProfile) => void; notify: (text:string)=>void; onNavigate:(view:View)=>void; zone:GrowingZone }) {
  const [question,setQuestion]=useState("");
  const [messages]=useState<{role:"user"|"assistant";text:string}[]>([
    {role:"assistant",text:`Chào bạn! Tôi đang theo dõi ${crop.name} ${crop.variety}; mục tiêu đang áp dụng cho ${zone.name} là ${zone.targetTdsMin}–${zone.targetTdsMax} ppm. Bạn muốn kiểm tra dinh dưỡng, nhiệt độ nước hay chuẩn bị thu hoạch?`}
  ]);
  return <div className="view-stack assistant-view"><ViewHeader eyebrow="Mẫu giao diện chỉ đọc" title="Kỹ sư thủy canh AI" description="AI chưa kết nối Backend; nội dung hội thoại bên dưới chỉ minh họa trải nghiệm dự kiến." action={<button className="secondary-button" onClick={()=>onNavigate("settings")}><KeyRound size={15}/> Xem cấu hình AI</button>}/>
    <AiActionCenter crop={crop} setCrop={setCrop} notify={notify} zone={zone}/>
    <section className="assistant-layout"><article className="chat-card panel"><div className="chat-head"><span><Bot size={21}/></span><div><strong>Kỹ sư HydroFlow</strong><p><StatusDot status="offline"/> Chưa kết nối AI</p></div><span className="context-badge"><BookOpen size={13}/> Nội dung minh họa</span></div><div className="quick-questions">{["TDS hôm nay có phù hợp?","Vì sao lá có thể bị vàng?","Chuẩn bị gì trước thu hoạch?"].map(q=><button key={q} disabled>{q}</button>)}</div><div className="chat-stream">{messages.slice(0,1).map((m,i)=><div className={`chat-message ${m.role}`} key={`${m.role}-${i}`}><span className="chat-avatar"><Bot size={15}/></span><div><small>Mẫu trợ lý</small><p>{m.text}</p></div></div>)}</div><div className="chat-input"><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="AI chưa được tích hợp" disabled/><button disabled aria-label="Gửi câu hỏi"><Send size={17}/></button></div><p className="ai-disclaimer">AI chưa chạy trong source hiện tại. Khu vực này không bật bơm, không bật Auto Dosing, không đổi mục tiêu và không gửi MQTT command.</p></article>
      <aside className="assistant-context"><article className="panel"><div className="panel-head"><div><span className="panel-kicker">Phạm vi dữ liệu</span><h2>Ngữ cảnh đang phân tích</h2></div><span className="status-chip success">Mới</span></div><div className="context-list" data-testid="ai-zone-target"><span><small>Cây trồng</small><b>{crop.name} · {crop.variety}</b></span><span><small>Tuổi cây</small><b>{cropAgeDays(crop.sowDate)} ngày</b></span><span><small>Mục tiêu TDS vùng</small><b>{zone.targetTdsMin}–{zone.targetTdsMax} ppm</b></span><span><small>TDS của vùng</small><b>{zone.tds===null?"Chưa hiệu chuẩn":`${formatOptionalNumber(zone.tds,0)} ppm`}</b></span><span><small>Nhiệt độ nước</small><b>{zone.temperature===null?"—":`${formatOptionalNumber(zone.temperature,1)}°C`}</b></span><span><small>Mực nước</small><b>{zone.waterLevel}</b></span><span><small>Cảm biến pH</small><b className="muted-text">Chưa có dữ liệu</b></span></div></article><article className="panel ai-guardrail"><ShieldCheck size={20}/><div><strong>Phạm vi chuyên môn</strong><p>Prompt hệ thống yêu cầu AI ưu tiên an toàn, nêu rõ dữ liệu còn thiếu và từ chối suy đoán ngoài chủ đề thủy canh.</p></div></article></aside>
    </section>
  </div>;
}

function LegacyCalibrationView({ notify }: { notify:(text:string)=>void }) {
  const [tab,setTab]=useState<"ec"|"pump">("ec");
  const [pointCount,setPointCount]=useState(3);
  return <div className="view-stack"><ViewHeader eyebrow="Độ chính xác đo lường" title="Hiệu chuẩn thiết bị vùng" description="Quản lý bộ hiệu chuẩn EC/TDS và lưu lượng bơm dinh dưỡng theo quy trình có kiểm chứng." action={<div className="cal-tabs"><button className={tab==="ec"?"active":""} onClick={()=>setTab("ec")}>EC / TDS</button><button className={tab==="pump"?"active":""} onClick={()=>setTab("pump")}>Bơm A / B</button></div>} />
    {tab==="ec"?<><section className="active-calibration"><div className="active-cal-head"><span><CircleCheck size={23}/></span><div><small>BỘ HIỆU CHUẨN ĐANG KÍCH HOẠT</small><strong>EC Standard · Set #EC-2408</strong><p>{pointCount} điểm chuẩn · EC-first · TDS scale 500</p></div><span className="status-chip success">Đang hoạt động</span></div><div className="cal-metrics"><span><small>Phương pháp</small><b>Linear interpolation</b></span><span><small>Khoảng EC hợp lệ</small><b>280–1,413 µS/cm</b></span><span><small>Sai số fit</small><b>±1.8%</b></span><span><small>Cập nhật</small><b>08/08/2026</b></span></div></section>
      <section className="dashboard-grid calibration-grid"><article className="panel"><div className="panel-head"><div><span className="panel-kicker">Calibration workflow</span><h2>Thêm điểm EC tham chiếu</h2></div><span className="step-badge">Bước {Math.min(pointCount,3)}/3+</span></div><ol className="cal-steps"><li className="done"><span><Check size={13}/></span><div><b>Nhúng đầu dò vào dung dịch chuẩn</b><p>Chờ điện áp và nhiệt độ ổn định.</p></div></li><li className="done"><span><Check size={13}/></span><div><b>Nhập giá trị máy đo tham chiếu</b><p>Hệ thống tự chuẩn hóa điện áp về 25°C.</p></div></li><li><span>3</span><div><b>Lưu điểm hiệu chuẩn</b><p>Cần tối thiểu 3 mức EC khác nhau.</p></div></li></ol><div className="cal-point-form"><label>ADC thô<input defaultValue="1830" type="number"/></label><label>Điện áp đo<input defaultValue="1.470" type="number"/><em>V</em></label><label>Nhiệt độ nước<input defaultValue="26.4" type="number"/><em>°C</em></label><label>EC tham chiếu<input placeholder="Ví dụ: 1413" type="number"/><em>µS/cm</em></label><label className="wide">Ghi chú<input placeholder="Tên dung dịch / máy đo tham chiếu"/></label></div><div className="form-actions"><button className="secondary-button">Dùng dữ liệu mới nhất</button><button className="primary-button" onClick={()=>{setPointCount(pointCount+1);notify("Đã thêm điểm hiệu chuẩn EC mới")}}>Lưu điểm chuẩn</button></div></article>
      <article className="panel"><div className="panel-head"><div><span className="panel-kicker">Quality gate</span><h2>Chất lượng hiệu chuẩn</h2></div><span className="status-chip success">Đạt</span></div><div className="quality-score"><div><b>96</b><small>/100</small></div><div><strong>Độ tin cậy cao</strong><p>Đủ điều kiện dùng làm dữ liệu điều khiển.</p></div></div><div className="quality-list"><div><span>Đủ số điểm chuẩn</span><b>{pointCount} / 3+</b></div><div><span>Phân bố khoảng đo</span><b>Tốt</b></div><div><span>Ổn định cửa sổ đo</span><b>±4.2 ppm</b></div><div><span>Bù nhiệt độ 25°C</span><b>Đang bật</b></div><div><span>Control valid</span><b className="positive">TRUE</b></div></div><div className="quality-note"><ShieldCheck size={16}/><p>Auto Dosing có thể sử dụng bộ hiệu chuẩn này.</p></div></article></section>
      <section className="panel"><div className="panel-head"><div><span className="panel-kicker">Calibration points</span><h2>Các điểm tham chiếu</h2></div><button className="secondary-button"><Download size={14}/> Xuất CSV</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Điểm</th><th>EC tham chiếu</th><th>Điện áp @25°C</th><th>Nhiệt độ</th><th>TDS quy đổi</th><th>Độ lệch</th><th>Trạng thái</th></tr></thead><tbody>{[["P1","280 µS/cm","0.590 V","25.8°C","140 ppm","+0.7%"],["P2","700 µS/cm","1.440 V","26.4°C","350 ppm","-1.2%"],["P3","1,413 µS/cm","2.230 V","26.1°C","706.5 ppm","+1.8%"]].map(r=><tr key={r[0]}>{r.map(v=><td key={v}>{v}</td>)}<td><span className="table-status">Hợp lệ</span></td></tr>)}</tbody></table></div></section></>:<><section className="pump-cal-grid">{[["A","Dung dịch A","2.00","500","10.0","02/08/2026"],["B","Dung dịch B","1.80","556","9.9","02/08/2026"]].map((r,i)=><article className="panel pump-cal-card" key={r[0]}><div className="pump-control-head"><span className={`pump-large ${i?"b":"a"}`}>{r[0]}</span><div><strong>Bơm {r[1]}</strong><p>Kênh MOSFET CH{i+2}</p></div><span className="status-chip success">Hợp lệ</span></div><div className="pump-cal-value"><strong>{r[2]}</strong><span>ml/s</span></div><div className="cal-metrics"><span><small>Pulse test</small><b>{r[3]} ms</b></span><span><small>Thể tích đo</small><b>{r[4]} ml</b></span><span><small>Hiệu chuẩn</small><b>{r[5]}</b></span></div><button className="full-button" onClick={()=>notify(`Đã mở quy trình hiệu chuẩn bơm ${r[0]}`)}>Hiệu chuẩn lại <span>→</span></button></article>)}</section><div className="calibration-tip wide-tip"><AlertTriangle size={17}/><p>Quy trình khuyến nghị: chạy pulse trong cốc đo, nhập thể tích thực tế, lặp lại ít nhất 3 lần và dùng giá trị trung bình.</p></div></>}
  </div>;
}

type ReportDataset="sensor_logs"|"dosing_runs"|"auto_dosing_events"|"hardware_alerts"|"crop_journal"|"season_report"|"system_summary";
type ReportScope="garden"|"zone"|"device"|"reservoir"|"rack"|"season";
const datasetConfig:Record<ReportDataset,{label:string;scopes:ReportScope[]}>={
  sensor_logs:{label:"Sensor logs",scopes:["garden","zone","device"]},
  dosing_runs:{label:"Dosing runs",scopes:["zone","reservoir","device"]},
  auto_dosing_events:{label:"Auto Dosing events",scopes:["zone","device"]},
  hardware_alerts:{label:"Cảnh báo phần cứng",scopes:["zone","device"]},
  crop_journal:{label:"Nhật ký trồng",scopes:["rack","season"]},
  season_report:{label:"Báo cáo mùa vụ",scopes:["season"]},
  system_summary:{label:"Tổng hợp hệ thống",scopes:["garden"]},
};
const scopeNames:Record<ReportScope,string>={garden:"Toàn vườn",zone:"Vùng",device:"Thiết bị",reservoir:"Bồn",rack:"Giàn",season:"Mùa vụ"};

function DataView({ notify, zone }: { notify:(text:string)=>void; zone:GrowingZone }) {
  const [query,setQuery]=useState("");
  const [dataset,setDataset]=useState<ReportDataset>("sensor_logs");
  const [scope,setScope]=useState<ReportScope>("zone");
  const [rackId,setRackId]=useState(zone.rackList[0]?.id??"");
  const [sensorLogs,setSensorLogs]=useState<SensorLogRow[]>([]);
  const [sensorLogsState,setSensorLogsState]=useState<{loading:boolean;error:string}>({loading:true,error:""});
  const [exportState,setExportState]=useState<{status:"idle"|"loading"|"success"|"error";message:string}>({status:"idle",message:""});
  const scopedRack=zone.rackList.find(rack=>rack.id===rackId)??zone.rackList[0];
  const rows=sensorLogs.filter(row=>JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  const allowedScopes=datasetConfig[dataset].scopes;
  const scopeLabel=scope==="garden"?"Toàn vườn":scope==="zone"?zone.name:scope==="device"?zone.deviceId:scope==="reservoir"?zone.tank:scope==="rack"?scopedRack?.name:`Mùa vụ ${scopedRack?.crop?.variety??"chưa thiết lập"}`;
  const labelForScope=(value:ReportScope)=>value==="garden"?"Toàn vườn":value==="zone"?zone.name:value==="device"?zone.deviceId:value==="reservoir"?zone.tank:value==="rack"?scopedRack?.name:`Mùa vụ ${scopedRack?.crop?.variety??"chưa thiết lập"}`;
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const data=await backendApiAdapter.getSensorLogs(zone.deviceId,100);
        if(active){setSensorLogs(data);setSensorLogsState({loading:false,error:""});}
      }catch(reason){
        if(active)setSensorLogsState({loading:false,error:reason instanceof Error?reason.message:"Không thể tải sensor logs"});
      }
    };
    void load();
    const timer=window.setInterval(()=>void load(),5000);
    return()=>{active=false;window.clearInterval(timer);};
  },[zone.deviceId]);
  const formatNumber=(value:number|null,digits=1)=>value===null?"—":value.toFixed(digits);
  const formatDate=(value:string|null)=>value?new Date(value).toLocaleString("vi-VN"):"—";
  const waterLevelLabel=(value:SensorLogRow["waterLevel"])=>value==="normal"?"Bình thường":value==="low"?"Thấp":value==="error"?"Lỗi":"—";
  const exportCsv=async(requestedDataset:ReportDataset=dataset)=>{
    const effectiveScope=datasetConfig[requestedDataset].scopes.includes(scope)?scope:datasetConfig[requestedDataset].scopes[0];
    setDataset(requestedDataset);setScope(effectiveScope);setExportState({status:"loading",message:"Đang tạo file CSV…"});
    try{
      const {blob,filename}=await backendApiAdapter.downloadCsv(zone.deviceId,requestedDataset);
      const url=URL.createObjectURL(blob);const anchor=document.createElement("a");
      anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setExportState({status:"success",message:`Đã tải ${filename}`});notify(`Đã xuất ${datasetConfig[requestedDataset].label} · ${labelForScope(effectiveScope)}`);
    }catch(reason){
      setExportState({status:"error",message:reason instanceof Error?reason.message:"Không thể tạo CSV. Hãy kiểm tra Backend."});
    }
  };
  return <div className="view-stack"><ViewHeader eyebrow="Local Database" title="Dữ liệu & báo cáo" description={`Dataset: ${datasetConfig[dataset].label} · Phạm vi: ${scopeLabel}.`} action={<div className="export-action"><button className="primary-button" disabled={exportState.status==="loading"} onClick={()=>exportCsv()}><FileDown size={16}/> {exportState.status==="loading"?"Đang xuất…":"Xuất dữ liệu CSV"}</button>{exportState.status!=="idle"&&<span className={`export-status ${exportState.status}`} role="status">{exportState.message}</span>}</div>} />
    <section className="report-dataset-picker"><label>Loại dữ liệu<select value={dataset} onChange={e=>{const next=e.target.value as ReportDataset;setDataset(next);if(!datasetConfig[next].scopes.includes(scope))setScope(datasetConfig[next].scopes[0]);}}>{(Object.keys(datasetConfig) as ReportDataset[]).map(id=><option key={id} value={id}>{datasetConfig[id].label}</option>)}</select></label><p>Phạm vi khả dụng thay đổi theo loại dữ liệu để không tạo cảm giác mỗi giàn có cảm biến nước riêng.</p></section>
    <section className="report-scope"><label>Phạm vi<select value={scope} onChange={e=>setScope(e.target.value as ReportScope)}>{allowedScopes.map(id=><option key={id} value={id}>{scopeNames[id]}</option>)}</select></label>{(scope==="rack"||scope==="season")&&<label>Chọn giàn<select value={rackId} onChange={e=>setRackId(e.target.value)}>{zone.rackList.map(rack=><option key={rack.id} value={rack.id}>{rack.name}{rack.crop?` · ${rack.crop.variety}`:" · Chưa có mùa vụ"}</option>)}</select></label>}<span><Filter size={14}/> Đang xem: <b>{scopeLabel}</b></span></section>
    {dataset==="season_report"&&<div className="report-context-note"><CalendarDays size={16}/><span>Dữ liệu của <b>{zone.name}</b> trong khoảng thời gian Mùa vụ <b>{scopedRack?.crop?.variety}</b> trên <b>{scopedRack?.name}</b> hoạt động. Các số đo TDS thuộc bồn/vùng, không phải cảm biến riêng của giàn.</span></div>}
    <section className="data-kpis"><article><span><Database size={18}/></span><div><small>BẢN GHI ĐÃ NẠP</small><strong>{sensorLogsState.loading?"…":sensorLogs.length}</strong><p>Tối đa 100 bản ghi mới nhất</p></div></article><article><span><Activity size={18}/></span><div><small>NGUỒN SENSOR LOGS</small><strong>{sensorLogsState.error?"Lỗi":"API"}</strong><p>{sensorLogsState.error||`Thiết bị ${zone.deviceId}`}</p></div></article><article><span><FlaskConical size={18}/></span><div><small>DOSING RUNS</small><strong>—</strong><p>Chưa nạp thống kê</p></div></article><article><span><AlertTriangle size={18}/></span><div><small>CẢNH BÁO</small><strong>—</strong><p>Chưa có endpoint tổng hợp</p></div></article></section>
    <section className="panel data-explorer"><div className="data-toolbar"><div className="data-tabs" aria-label="Dataset hiện tại"><span>{datasetConfig[dataset].label}</span><small>{allowedScopes.map(id=>scopeNames[id]).join(" · ")}</small></div><div className="data-tools"><label aria-label="Tìm kiếm trong báo cáo"><Search size={14}/><input aria-label="Tìm kiếm trong báo cáo" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm trong dữ liệu..."/></label><button disabled><CalendarDays size={14}/> 100 bản ghi mới nhất</button><button disabled><Filter size={14}/> Bộ lọc chưa tích hợp</button></div></div>{dataset==="sensor_logs"?<><div className="table-scroll"><table className="data-table"><thead><tr><th>Thời gian</th><th>TDS</th><th>EC</th><th>Nhiệt độ</th><th>Mực nước</th><th>Bơm hồi lưu vùng</th><th>Control valid</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{formatDate(row.measurementAt)}</td><td><b>{formatNumber(row.tdsPpm,2)}</b>{row.tdsPpm===null?"":" ppm"}</td><td>{formatNumber(row.ecUsCm,2)}{row.ecUsCm===null?"":" µS/cm"}</td><td>{formatNumber(row.waterTemp,1)}{row.waterTemp===null?"":"°C"}</td><td><span className="water-ok"><Droplets size={12}/>{waterLevelLabel(row.waterLevel)}</span></td><td><span className="pump-on">{row.pumpMain?"ON":"OFF"}</span></td><td><span className={`table-status ${row.tdsControlValid?"":"muted"}`}>{row.tdsControlValid?"TRUE":"FALSE"}</span></td></tr>)}</tbody></table>{!sensorLogsState.loading&&!sensorLogsState.error&&rows.length===0&&<div className="dataset-preview"><Database size={22}/><div><strong>Chưa có sensor log</strong><p>Backend chưa trả về bản ghi phù hợp cho thiết bị này.</p></div></div>}{sensorLogsState.error&&<div className="dataset-preview"><AlertTriangle size={22}/><div><strong>Không tải được sensor logs</strong><p>{sensorLogsState.error}</p></div></div>}</div><div className="table-footer"><span>Hiển thị {rows.length} bản ghi do Backend trả về</span></div></>:<div className="dataset-preview"><Database size={22}/><div><strong>{datasetConfig[dataset].label}</strong><p>Dataset này hiện chỉ hỗ trợ luồng xuất CSV khi Backend có endpoint tương ứng; bảng xem trước chưa tích hợp.</p></div></div>}</section>
    <section className="dashboard-grid equal"><article className="panel"><div className="panel-head"><div><span className="panel-kicker">Lưu trữ cục bộ</span><h2>Dung lượng Local Database</h2></div><span className="status-chip muted">Chưa có metrics</span></div><div className="storage-meter"><div><span>Dung lượng đã dùng</span><b>—</b></div><i><b style={{width:"0%"}}/></i><p>Backend chưa cung cấp endpoint dung lượng hoặc chính sách lưu trữ.</p></div></article><article className="panel export-panel"><div className="panel-head"><div><span className="panel-kicker">Báo cáo nhanh</span><h2>Gói dữ liệu có thể xuất</h2></div></div><div className="export-list"><button disabled={exportState.status==="loading"} onClick={()=>exportCsv("sensor_logs")}><span><Activity size={15}/></span><div><strong>Sensor logs</strong><small>CSV · Dữ liệu cảm biến</small></div><Download size={15}/></button><button disabled={exportState.status==="loading"} onClick={()=>exportCsv("dosing_runs")}><span><FlaskConical size={15}/></span><div><strong>Dosing runs</strong><small>CSV · Kết quả châm dinh dưỡng</small></div><Download size={15}/></button><button disabled={exportState.status==="loading"} onClick={()=>exportCsv("auto_dosing_events")}><span><History size={15}/></span><div><strong>Auto Dosing events</strong><small>CSV · Nhật ký truy vết</small></div><Download size={15}/></button></div></article></section>
  </div>;
}

function SettingToggle({ title, text, active, disabled, onChange }: {title:string;text:string;active?:boolean;disabled?:boolean;onChange?:()=>void}) { return <div className={`setting-toggle ${disabled?"disabled":""}`}><div><strong>{title}</strong><p>{text}</p></div>{disabled?<span className="planned-tag">Chưa triển khai</span>:<button className={`switch ${active?"on":""}`} role="switch" aria-label={title} aria-checked={Boolean(active)} onClick={onChange}><span/></button>}</div> }

function SystemInfoView({ onNavigate, zones, health }: { onNavigate:(view:View)=>void; zones:GrowingZone[]; health:GatewayHealth }) {
  const serviceStates=[
    {name:"Backend REST API",online:health.connected,detail:"Trang /health"},
    {name:"MQTT Broker",online:health.mqttConnected,detail:"Theo Backend health"},
    {name:"Local Database",online:health.mongoConnected,detail:health.databaseEngine??"Engine chưa xác nhận"},
    {name:"Cloud Sync",online:false,detail:"Chưa tích hợp"},
  ];
  return <div className="view-stack system-info-view">
    <ViewHeader eyebrow="Edge Gateway · Local-first" title="Thông tin hệ thống" description="Theo dõi các dịch vụ mà Backend health xác nhận; tài nguyên máy và Cloud chưa có metrics." action={<button className="secondary-button" onClick={()=>onNavigate("settings")}><Settings size={15}/> Mở cài đặt</button>} />
    <section className="system-health-hero">
      <div className="system-health-icon"><Server size={28}/></div>
      <div><small>HYDRO-EDGE-01</small><h2>{health.connected?"Backend cục bộ đang phản hồi":"Chưa kết nối Backend cục bộ"}</h2><p><StatusDot status={health.connected?"online":"offline"}/> Trạng thái lấy trực tiếp từ endpoint health</p></div>
      <div className="system-health-score"><strong>{health.connected?"API":"OFF"}</strong><span>Không suy diễn health score</span></div>
    </section>
    <section className="system-resource-grid">
      {[{label:"CPU",value:"—",note:"Chưa có metrics endpoint",icon:Cpu,tone:"green"},{label:"Bộ nhớ RAM",value:"—",note:"Chưa có metrics endpoint",icon:Database,tone:"blue"},{label:"Lưu trữ",value:"—",note:"Chưa có metrics endpoint",icon:Database,tone:"violet"},{label:"ESP32 kết nối",value:"—",note:"Chưa có connection inventory",icon:Network,tone:"amber"}].map(({label,value,note,icon:Icon,tone})=><article className={`system-resource-card ${tone}`} key={label}><span><Icon size={20}/></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>)}
    </section>
    <section className="dashboard-grid equal system-detail-grid">
      <article className="panel"><div className="panel-head"><div><span className="panel-kicker">Health adapter</span><h2>Phiên bản đang chạy</h2></div><span className="status-chip muted">Theo Backend</span></div><div className="system-detail-list"><span><small>Hệ điều hành</small><b>Chưa xác nhận</b></span><span><small>HydroFlow Backend</small><b>{health.backendVersion??"Chưa xác nhận"}</b></span><span><small>Build profile</small><b>{health.buildProfile??"Chưa xác nhận"}</b></span><span><small>{health.databaseLabel}</small><b>{health.databaseEngine??"Engine chưa xác nhận"}</b></span><span><small>Firmware ESP32</small><b>{health.firmwareVersion??"Chưa xác nhận"}</b></span></div></article>
      <article className="panel"><div className="panel-head"><div><span className="panel-kicker">Dịch vụ cục bộ</span><h2>Trạng thái vận hành</h2></div></div><div className="service-status-list">{serviceStates.map(({name,online,detail})=><div key={name}><span>{online?<CircleCheck size={16}/>:<AlertTriangle size={16}/>}</span><div><strong>{name}</strong><p>{detail}</p></div><em>{online?"Online":"Chưa sẵn sàng"}</em></div>)}</div></article>
    </section>
    <section className="panel system-zone-table"><div className="panel-head"><div><span className="panel-kicker">Thiết bị vùng dinh dưỡng</span><h2>Kết nối ESP32</h2></div><button className="icon-text-button" onClick={()=>onNavigate("zones")}>Quản lý vùng <span>→</span></button></div><div className="table-scroll"><table><thead><tr><th>Vùng</th><th>Device ID</th><th>IP cục bộ</th><th>Giàn / bồn</th><th>Trạng thái</th></tr></thead><tbody>{zones.map(zone=><tr key={zone.id}><td><b>{zone.name}</b></td><td className="mono">{zone.deviceId}</td><td>{zone.espIp}</td><td>{zone.racks} / {zone.tank}</td><td><span className={`zone-state ${zone.status}`}><StatusDot status={zone.status}/>{zone.status === "online" ? "Online" : zone.status === "warning" ? "Cảnh báo" : "Offline"}</span></td></tr>)}</tbody></table></div></section>
    <button className="system-back-button" onClick={()=>onNavigate("settings")}><span>←</span> Quay lại Cài đặt</button>
  </div>;
}

function SettingsView({ notify, zone, onNavigate, onUpdateZone, health, onPathChange }: { notify:(text:string)=>void; zone:GrowingZone; onNavigate:(view:View)=>void; onUpdateZone:(zone:GrowingZone)=>void; health:GatewayHealth; onPathChange:(path:string)=>void }) {
  const [tab,setTab]=useState<SettingsTab>(()=>settingsTabFromPath(typeof window!=="undefined"?window.location.pathname:"/settings/gateway"));
  const [zoneForm,setZoneForm]=useState({name:zone.name,tank:zone.tank,deviceId:zone.deviceId,espIp:zone.espIp});
  const saveZone=()=>{const name=zoneForm.name.trim();if(!name){notify("Tên vùng không được để trống");return;}onUpdateZone({...zone,name,tank:zoneForm.tank.trim()||zone.tank,deviceId:zoneForm.deviceId.trim()||zone.deviceId,espIp:zoneForm.espIp.trim()||zone.espIp});notify(`Đã cập nhật bản nháp thiết bị ${name}; chưa lưu Backend`);};
  const tabs=[{id:"gateway",label:"Gateway & mạng",icon:Server},{id:"device",label:"Thiết bị vùng dinh dưỡng",icon:Cpu},{id:"ai",label:"AI",icon:Bot},{id:"cloud",label:"Cloud & đồng bộ",icon:Cloud},{id:"modules",label:"Thông báo & module",icon:Bell}] as const;
  useEffect(()=>{const sync=()=>setTab(settingsTabFromPath(window.location.pathname));window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[]);
  return <div className="view-stack settings-split-view">
    <ViewHeader eyebrow="Cài đặt theo phạm vi" title="Cài đặt hệ thống" description="Cấu hình toàn vườn được tách khỏi cấu hình ESP32 của vùng đang chọn." action={<button className="secondary-button" onClick={()=>onNavigate("system")}><Server size={15}/> Thông tin hệ thống</button>}/>
    <nav className="settings-scope-tabs" aria-label="Nhóm cài đặt">{tabs.map(({id,label,icon:Icon})=><button key={id} className={tab===id?"active":""} onClick={()=>{const path=id==="device"?`/settings/zones/${zone.id}/device`:`/settings/${id}`;setTab(id);window.history.pushState({},"",path);onPathChange(path)}}><Icon size={16}/>{label}</button>)}</nav>
    {tab==="gateway"&&<section className="settings-layout"><div className="settings-main"><article className="panel settings-card"><div className="settings-title"><span><Network size={19}/></span><div><h2>Gateway & mạng toàn vườn</h2><p>Mẫu cấu hình chỉ đọc; Backend chưa có API cập nhật Gateway.</p></div><span className={`status-chip ${health.connected?"success":"muted"}`}>{health.connected?"API Online":"API Offline"}</span></div><div className="info-grid"><label>Tên Gateway<input defaultValue="hydro-edge-01.local" disabled/></label><label>Địa chỉ IP Gateway<input defaultValue="Chưa lấy từ Backend" disabled/></label><label>MQTT Broker<input defaultValue="Theo cấu hình Backend" disabled/></label><label>Vườn<input defaultValue="Vườn sân thượng" disabled/></label></div><details className="technical-details"><summary>Chi tiết kỹ thuật</summary><p>Local Web UI → Backend/API → {health.databaseLabel}. Với lệnh điều khiển: Backend kiểm tra capability và điều kiện an toàn trước khi gửi qua MQTT tới ESP32.</p></details><button className="save-settings" disabled>Chưa có API lưu Gateway</button></article></div><aside className="settings-side"><article className="panel gateway-card"><div className="gateway-hero"><span><Server size={25}/></span><div><small>PHẠM VI TOÀN VƯỜN</small><strong>HydroFlow Backend</strong><p><StatusDot status={health.connected?"online":"offline"}/> {health.connected?"Đang phản hồi":"Chưa kết nối"}</p></div></div></article></aside></section>}
    {tab==="device"&&<section className="settings-layout"><div className="settings-main"><article className="panel settings-card"><div className="settings-title"><span><Cpu size={19}/></span><div><h2>Thiết bị vùng dinh dưỡng</h2><p>Chỉ áp dụng cho {zone.name}.</p></div><span className="status-chip success">{zone.deviceId}</span></div><div className="info-grid"><label>Tên vùng<input value={zoneForm.name} onChange={e=>setZoneForm({...zoneForm,name:e.target.value})}/></label><label>Tên bồn<input value={zoneForm.tank} onChange={e=>setZoneForm({...zoneForm,tank:e.target.value})}/></label><label>Device ID<input value={zoneForm.deviceId} onChange={e=>setZoneForm({...zoneForm,deviceId:e.target.value})}/></label><label>IP ESP32<input value={zoneForm.espIp} onChange={e=>setZoneForm({...zoneForm,espIp:e.target.value})}/></label></div><div className="rack-settings-list"><strong>Giàn thuộc vùng</strong>{zone.rackList.map(rack=><span key={rack.id}><b>{rack.name}</b><small>{rack.location} · {rack.crop?`Mùa vụ ${rack.crop.name}`:"Chưa có mùa vụ"}</small></span>)}</div><details className="technical-details"><summary>Mô hình dữ liệu mở rộng dự kiến</summary><p>Frontend dùng thống nhất siteId, zoneId, reservoirId, rackId, seasonId và deviceId. Source hiện tại chủ yếu dùng deviceId; tên field API/Database sẽ được chốt khi tích hợp.</p></details><button className="save-settings" onClick={saveZone}>Lưu thiết bị vùng</button></article></div><aside className="settings-side"><article className="panel zone-principle"><ShieldCheck size={21}/><div><strong>Khả năng source hiện tại</strong><p>Dữ liệu vận hành hiện được liên kết chủ yếu bằng <b>{zone.deviceId}</b>. Zone/rack/season là lớp tổ chức frontend dự kiến.</p></div></article></aside></section>}
    {tab==="ai"&&<section className="panel settings-card"><div className="settings-title"><span><Bot size={19}/></span><div><h2>Trợ lý AI</h2><p>Mẫu cấu hình chỉ đọc; AI chưa được tích hợp Backend.</p></div><span className="status-chip muted">Chưa kết nối</span></div><div className="info-grid"><label>Nhà cung cấp<select defaultValue="Chưa cấu hình" disabled><option>Chưa cấu hình</option></select></label><label>Model<input defaultValue="Chưa cấu hình" disabled/></label><label className="wide-field">API endpoint<input defaultValue="Chưa cấu hình" disabled/></label></div><div className="system-prompt-box"><span><LockKeyhole size={16}/><b>Không có đường điều khiển</b></span><p>Module AI tương lai chỉ được đề xuất; không trực tiếp gửi lệnh bơm hoặc bật Auto Dosing.</p></div><button className="save-settings" disabled>AI chưa tích hợp</button></section>}
    {tab==="cloud"&&<section className="panel settings-card"><div className="settings-title"><span><Cloud size={19}/></span><div><h2>Cloud & đồng bộ</h2><p>Cloud chưa được tích hợp Backend và không nằm trong đường điều khiển.</p></div><span className="status-chip muted">Chưa tích hợp</span></div><SettingToggle title="Đồng bộ telemetry tổng hợp" text="Chưa có service Cloud Sync." disabled/><SettingToggle title="Backup bản ghi quan trọng" text="Chưa có hàng đợi đồng bộ." disabled/><details className="technical-details"><summary>Chi tiết kỹ thuật</summary><p>Không có credential, queue hoặc API Cloud trong frontend hiện tại.</p></details></section>}
    {tab==="modules"&&<section className="panel settings-card"><div className="settings-title"><span><Bell size={19}/></span><div><h2>Thông báo & module dự kiến</h2><p>Các chức năng chưa có trong source thật được phân loại rõ.</p></div></div><SettingToggle title="Cảnh báo trên Local Web UI" text="Cảnh báo TDS, nhiệt độ, mực nước và dosing." active/><SettingToggle title="Zalo OA" text="Module thông báo một chiều dự kiến; không nhận lệnh và không điều khiển hệ thống." disabled/><SettingToggle title="Cảm biến pH" text="Module phần cứng dự kiến, chưa triển khai." disabled/><SettingToggle title="AI Camera / Inference" text="Module dự kiến trên Gateway." disabled/><SettingToggle title="Adaptive Dosing" text="Chưa được phép thay thế cơ chế rule-based hiện tại." disabled/></section>}
  </div>;
}

const pathForView = (view:View, zone:GrowingZone) => {
  if(view==="overview") return "/overview";
  if(view==="zones") return `/zones/${zone.id}`;
  if(view==="garden") { const rack=zone.rackList[0]; return rack?.crop?`/racks/${rack.id}/seasons/${rack.id}-active`:"/seasons"; }
  if(view==="monitoring") return `/zones/${zone.id}/monitoring`;
  if(view==="pumps") return `/zones/${zone.id}/pumps`;
  if(view==="dosing") return `/zones/${zone.id}/auto-dosing`;
  if(view==="calibration") return `/zones/${zone.id}/calibration`;
  if(view==="data") return "/reports";
  if(view==="settings") return "/settings/gateway";
  if(view==="system") return "/settings/system";
  if(view==="assistant") return `/zones/${zone.id}/assistant`;
  return "/overview";
};

const routeFromPath = (pathname:string):{view:View;zoneId?:string;rackId?:string} => {
  const zoneMatch=pathname.match(/^\/zones\/([^/]+)(?:\/(monitoring|pumps|auto-dosing|calibration|assistant))?$/);
  if(zoneMatch){const map:Record<string,View>={monitoring:"monitoring",pumps:"pumps","auto-dosing":"dosing",calibration:"calibration",assistant:"assistant"};return{view:zoneMatch[2]?map[zoneMatch[2]]:"zones",zoneId:zoneMatch[1]};}
  const rackMatch=pathname.match(/^\/racks\/([^/]+)\/seasons\//);if(rackMatch)return{view:"garden",rackId:rackMatch[1]};
  if(pathname==="/seasons")return{view:"garden"};
  if(pathname==="/reports")return{view:"data"};
  if(pathname==="/settings/system")return{view:"system"};
  const deviceSettingsMatch=pathname.match(/^\/settings\/zones\/([^/]+)\/device$/);if(deviceSettingsMatch)return{view:"settings",zoneId:deviceSettingsMatch[1]};
  if(pathname.startsWith("/settings/"))return{view:"settings"};
  return{view:pathname==="/zones"?"zones":"overview"};
};

type RouteMetadata={headerTitle:string;subtitle:string;scopeLabel:string;scope:"garden"|"zone";breadcrumbs:string[]};
const routeMetadataFor=(view:View,pathname:string,zone:GrowingZone,crop:CropProfile):RouteMetadata=>{
  const globalSettings:Record<string,{title:string;leaf:string}>={
    "/settings/gateway":{title:"Gateway & mạng",leaf:"Gateway & mạng"},
    "/settings/ai":{title:"AI",leaf:"AI"},
    "/settings/cloud":{title:"Cloud & đồng bộ",leaf:"Cloud & đồng bộ"},
    "/settings/modules":{title:"Module dự kiến",leaf:"Module dự kiến"},
    "/settings/system":{title:"Thông tin hệ thống",leaf:"Thông tin hệ thống"},
  };
  if(globalSettings[pathname])return{headerTitle:globalSettings[pathname].title,subtitle:"Cấu hình không phụ thuộc vùng đang chọn",scopeLabel:"Phạm vi toàn vườn",scope:"garden",breadcrumbs:["Cài đặt",globalSettings[pathname].leaf]};
  if(/^\/settings\/zones\/[^/]+\/device$/.test(pathname))return{headerTitle:"Thiết bị vùng dinh dưỡng",subtitle:`${zone.name} · ${zone.deviceId}`,scopeLabel:"Phạm vi vùng",scope:"zone",breadcrumbs:["Vùng","Thiết bị",zone.deviceId]};
  if(view==="garden"){const rackId=pathname.match(/^\/racks\/([^/]+)/)?.[1];const rack=zone.rackList.find(item=>item.id===rackId)??zone.rackList[0];return{headerTitle:"Mùa vụ của giàn",subtitle:`${zone.name} · ${rack?.name??"Giàn"}`,scopeLabel:"Phạm vi giàn",scope:"zone",breadcrumbs:["Vườn sân thượng",zone.name,rack?.name??"Giàn",`Mùa vụ ${rack?.crop?.variety??crop.variety}`]};}
  if(view==="data")return{headerTitle:"Dữ liệu & báo cáo",subtitle:"Chọn dataset và phạm vi trong báo cáo",scopeLabel:"Phạm vi báo cáo",scope:"garden",breadcrumbs:["Vườn sân thượng","Dữ liệu & báo cáo"]};
  const label=view==="overview"?"Tổng quan":navItems.find(item=>item.id===view)?.label??"HydroFlow";
  return{headerTitle:label,subtitle:`${zone.name} · ${zone.deviceId}`,scopeLabel:"Phạm vi vùng",scope:"zone",breadcrumbs:["Vườn sân thượng",zone.name,zone.deviceId]};
};

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [currentPath,setCurrentPath]=useState("/overview");
  const [zones, setZones] = useState<GrowingZone[]>(initialZones);
  const [selectedZoneId, setSelectedZoneId] = useState(initialZones[0].id);
  const [contextZoneMenuOpen, setContextZoneMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [pumpStates, setPumpStates] = useState<Record<string, boolean>>({ "zone-nft-01": false, "zone-nft-02": false, "zone-nft-03": false });
  const [lastRefresh, setLastRefresh] = useState("chưa có dữ liệu runtime");
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");
  const [gatewayAdapter,setGatewayAdapter]=useState<GatewayAdapter>(lockedGatewayAdapter);
  const [backendConnected,setBackendConnected]=useState(false);
  const [runtimeDataAvailable,setRuntimeDataAvailable]=useState(false);
  const [latestSnapshot,setLatestSnapshot]=useState<DeviceSnapshot|null>(null);
  const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0], [zones, selectedZoneId]);
  const crop = primaryCrop(selectedZone);
  const mainPump = pumpStates[selectedZoneId] ?? false;
  const autoDosingEnabled = false;

  const applyDeviceSnapshot = useCallback((snapshot: DeviceSnapshot) => {
    setZones(items => items.map(zone => zone.deviceId !== snapshot.deviceId ? zone : {
      ...zone,
      status: snapshot.waterLevel === "low" || snapshot.waterLevel === "error" ? "warning" : "online",
      tds: snapshot.tdsPpm,
      ec: snapshot.ecUsCm,
      temperature: snapshot.waterTemp,
      waterLevel: snapshot.waterLevel === "low" ? "Thấp" : "Bình thường",
    }));
    setPumpStates(states => ({ ...states, "zone-nft-01": snapshot.pumpMain }));
    setLatestSnapshot(snapshot);
    setRuntimeDataAvailable(true);
    setLastRefresh(snapshot.measurementAt ? new Date(snapshot.measurementAt).toLocaleTimeString("vi-VN") : new Date().toLocaleTimeString("vi-VN"));
  }, []);

  const loadRuntimeState = useCallback(async () => {
    const [capabilityResult, healthResult, snapshotResult] = await Promise.allSettled([
      new CapabilityAdapter().get(),
      new HealthAdapter().get(),
      backendApiAdapter.getDeviceSnapshot("device001"),
    ]);

    const capabilities = capabilityResult.status === "fulfilled" ? capabilityResult.value : lockedGatewayAdapter.capabilities;
    const health = healthResult.status === "fulfilled" ? healthResult.value : lockedGatewayAdapter.health;
    setGatewayAdapter({ capabilities, health });
    setBackendConnected(healthResult.status === "fulfilled" && healthResult.value.connected);
    if (snapshotResult.status === "fulfilled") applyDeviceSnapshot(snapshotResult.value);
    else { setRuntimeDataAvailable(false); setLatestSnapshot(null); }
  }, [applyDeviceSnapshot]);

  useEffect(()=>{
    const applyRoute=()=>{const path=window.location.pathname;const route=routeFromPath(path);setCurrentPath(path);setView(route.view);if(route.zoneId&&initialZones.some(zone=>zone.id===route.zoneId))setSelectedZoneId(route.zoneId);else if(route.rackId){const owner=initialZones.find(zone=>zone.rackList.some(rack=>rack.id===route.rackId));if(owner)setSelectedZoneId(owner.id);}};
    applyRoute();
    void loadRuntimeState();
    const runtimeRefreshTimer=window.setInterval(()=>void loadRuntimeState(),5000);
    window.addEventListener("popstate",applyRoute);
    return()=>{window.clearInterval(runtimeRefreshTimer);window.removeEventListener("popstate",applyRoute);};
  },[loadRuntimeState]);

  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadRuntimeState();
      notify("Dữ liệu mới nhất đã được cập nhật từ Backend");
    } finally {
      setRefreshing(false);
    }
  };

  const navigate = (next: View) => {
    setView(next);
    setMobileMenu(false);
    setContextZoneMenuOpen(false);
    const nextPath=pathForView(next,selectedZone);
    if(window.location.pathname!==nextPath)window.history.pushState({},"",nextPath);
    setCurrentPath(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectZone = (id: string, goToOverview = false) => {
    setSelectedZoneId(id);
    setContextZoneMenuOpen(false);
    const nextZone=zones.find(zone=>zone.id===id)??selectedZone;
    const currentPath=window.location.pathname;
    if (goToOverview) {setView("overview");window.history.pushState({},"","/overview");setCurrentPath("/overview");}
    else if(view==="garden"){const path=`/zones/${nextZone.id}`;setView("zones");window.history.pushState({},"",path);setCurrentPath(path);}
    else if(view==="settings"&&/^\/settings\/(gateway|ai|cloud|modules)$/.test(currentPath)){window.history.replaceState({},"",currentPath);setCurrentPath(currentPath);}
    else if(view==="settings"&&currentPath.includes("/settings/zones/")){const path=`/settings/zones/${nextZone.id}/device`;window.history.pushState({},"",path);setCurrentPath(path);}
    else if(view==="system"){window.history.replaceState({},"",currentPath);setCurrentPath(currentPath);}
    else {const path=pathForView(view,nextZone);window.history.pushState({},"",path);setCurrentPath(path);}
  };

  const setCrop = (nextCrop: CropProfile) => {
    setZones((items) => items.map((zone) => zone.id === selectedZoneId ? { ...zone, crop: nextCrop, rackList:zone.rackList.map((rack,index)=>index===0?{...rack,crop:nextCrop}:rack) } : zone));
  };

  const addZone = (zone: GrowingZone) => {
    setZones((items) => [...items, zone]);
    setSelectedZoneId(zone.id);
  };

  const updateZone = (nextZone: GrowingZone) => {
    setZones((items) => items.map((zone) => zone.id === nextZone.id ? nextZone : zone));
  };

  const routeMetadata=routeMetadataFor(view,currentPath,selectedZone,crop);

  return (
    <div className={`app-shell ${darkMode ? "dark" : ""} ${sidebarOpen ? "" : "sidebar-compact"}`}>
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Leaf size={24} /></span><div><strong>Hydro<span>Flow</span></strong><small>IoT Control Center</small></div><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Đóng menu"><X size={20} /></button></div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <span className="nav-caption">VẬN HÀNH</span>
          {navItems.slice(0, 7).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)} title={label}><Icon size={19} /><span>{label}</span>{id === "dosing" && <em>{autoDosingEnabled ? "ON" : "OFF"}</em>}</button>)}
          <span className="nav-caption">HỆ THỐNG</span>
          {navItems.slice(7).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)} title={label}><Icon size={19} /><span>{label}</span></button>)}
        </nav>
        <div className="edge-status"><div className="edge-head"><span><Cpu size={17} /></span><div><strong>Edge Gateway</strong><p><StatusDot status={backendConnected ? "online" : "offline"}/> {backendConnected ? "Backend kết nối" : "Chưa kết nối"}</p></div></div><div className="edge-stats"><span><small>REST</small><b>{backendConnected ? "OK" : "--"}</b></span><span><small>MQTT</small><b>{gatewayAdapter.health.mqttConnected ? "OK" : "--"}</b></span><span><small>DB</small><b>{gatewayAdapter.health.mongoConnected ? "OK" : "--"}</b></span></div></div>
        <button className="collapse-button" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}<span>Thu gọn thanh bên</span></button>
      </aside>

      {!sidebarOpen && <button className="sidebar-reopen" onClick={() => setSidebarOpen(true)} aria-label="Mở lại thanh bên"><PanelLeftOpen size={18}/><span>Mở menu</span></button>}

      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Đóng menu" />}

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title"><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Mở menu"><Menu size={21} /></button><div><span data-testid="route-title">{routeMetadata.headerTitle}</span><small className="topbar-zone-context" data-testid="route-subtitle"><b>{routeMetadata.subtitle}</b><em data-testid="route-scope">{routeMetadata.scopeLabel}</em></small></div></div>
          <div className="topbar-actions">
            <div className="context-zone-switcher header-zone-switcher">
              <button className="context-zone" onClick={() => setContextZoneMenuOpen(!contextZoneMenuOpen)} aria-label={`Chọn vùng dinh dưỡng, hiện tại là ${selectedZone.name}`} aria-haspopup="listbox" aria-expanded={contextZoneMenuOpen}><span className="context-zone-caption">Vùng đang chọn</span><b>{selectedZone.name}</b><ChevronDown className={contextZoneMenuOpen ? "open" : ""} size={13}/></button>
              {contextZoneMenuOpen && <div className="context-zone-menu" role="listbox" aria-label="Danh sách vùng dinh dưỡng"><div className="context-zone-menu-title">Chọn vùng để xem và điều khiển</div>{zones.map((zone) => <button key={zone.id} role="option" aria-selected={zone.id === selectedZoneId} className={zone.id === selectedZoneId ? "active" : ""} onClick={() => selectZone(zone.id)}><StatusDot status={zone.status}/><span><strong>{zone.name}</strong><small>{rackSummary(zone)} · {activeSeasonCount(zone)} mùa vụ</small></span>{zone.id === selectedZoneId && <Check size={15}/>}</button>)}<button className="manage-zones-link" onClick={() => navigate("zones")}><Network size={15}/><span>Quản lý vùng & giàn</span><span>→</span></button></div>}
            </div>
            <div className="connectivity"><span><StatusDot status={backendConnected ? "online" : "offline"}/> Backend {backendConnected ? "online" : "offline"}</span><span className="cloud-state"><Cloud size={14} /> Cloud chưa tích hợp</span></div>
            <button className="round-button refresh-button" onClick={refresh} aria-label="Làm mới dữ liệu"><RefreshCw size={18} className={refreshing ? "spin" : ""} /></button>
            <button className="round-button theme-button" onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"} aria-pressed={darkMode} title={darkMode ? "Chế độ sáng" : "Chế độ tối"}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="round-button notification-button" aria-label="Thông báo"><Bell size={18} /></button>
            <div className="user-menu"><span>NV</span><div><strong>Phiên cục bộ</strong><small>Chưa có xác thực</small></div><ChevronDown size={15} /></div>
          </div>
        </header>
        <div className="context-bar">
          <span className="breadcrumb" data-testid="route-breadcrumb">{routeMetadata.breadcrumbs.map((item,index)=><span key={`${item}-${index}`}>{index>0&&<em>/</em>}{index===0?<b>{item}</b>:item}</span>)}</span><span className="last-update">Cập nhật: {lastRefresh}</span><button aria-label="Tùy chọn khác"><MoreHorizontal size={17} /></button>
        </div>
        <main className="content-area">
          <div className={`backend-banner ${backendConnected ? "connected" : "disconnected"}`} role="status"><span><StatusDot status={backendConnected ? "online" : "offline"}/><strong>{backendConnected ? "Local Backend/API đã kết nối" : "Chưa kết nối Backend"}</strong></span><small>{backendConnected ? (runtimeDataAvailable ? "device001 đang dùng dữ liệu runtime từ API cục bộ" : "Backend đã kết nối nhưng chưa có snapshot device001") : "Không tự thay bằng mock; actuator luôn khóa fail-closed"}</small></div>
          <div className="prototype-scope-banner" role="note"><BookOpen size={16}/><span><strong>Phạm vi tích hợp:</strong> số đo device001, sensor logs, health, capability, calibration và CSV dùng Backend thật. Zone/rack/season chỉ là bản nháp trong phiên trình duyệt; AI, Cloud, biểu đồ lịch sử và system metrics chưa tích hợp.</span></div>
          {view === "overview" && <Overview onNavigate={navigate} mainPump={mainPump} notify={notify} zone={selectedZone} capabilities={gatewayAdapter.capabilities} health={gatewayAdapter.health} runtimeDataAvailable={runtimeDataAvailable} snapshot={latestSnapshot} />}
          {view === "zones" && <ZonesView zones={zones} selectedZoneId={selectedZoneId} onSelect={selectZone} onAddZone={addZone} onUpdateZone={updateZone} notify={notify} health={gatewayAdapter.health} />}
          {view === "garden" && <GardenView key={selectedZone.id} notify={notify} onNavigate={navigate} zone={selectedZone} onUpdateZone={updateZone} />}
          {view === "monitoring" && <MonitoringView zone={selectedZone} runtimeDataAvailable={runtimeDataAvailable} health={gatewayAdapter.health} snapshot={latestSnapshot} />}
          {view === "pumps" && <PumpsView deviceId={selectedZone.deviceId} mainPump={mainPump} notify={notify} onNavigate={navigate} capabilities={gatewayAdapter.capabilities} />}
          {view === "dosing" && <DosingView mainPump={mainPump} crop={crop} zone={selectedZone} capabilities={gatewayAdapter.capabilities} />}
          {view === "assistant" && <AssistantView crop={crop} setCrop={setCrop} notify={notify} onNavigate={navigate} zone={selectedZone} />}
          {view === "calibration" && <CalibrationWizard deviceId={selectedZone.deviceId} notify={notify} />}
          {view === "data" && <DataView notify={notify} zone={selectedZone} />}
          {view === "settings" && <SettingsView key={selectedZone.id} notify={notify} zone={selectedZone} onNavigate={navigate} onUpdateZone={updateZone} health={gatewayAdapter.health} onPathChange={setCurrentPath} />}
          {view === "system" && <SystemInfoView onNavigate={navigate} zones={zones} health={gatewayAdapter.health} />}
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh trên điện thoại">
        {[{id:"overview" as View,label:"Nhà",icon:LayoutDashboard},{id:"zones" as View,label:"Vùng",icon:Network},{id:"dosing" as View,label:"Dinh dưỡng",icon:FlaskConical},{id:"assistant" as View,label:"Trợ lý AI",icon:Bot}].map(({id,label,icon:Icon})=><button key={id} className={view===id?"active":""} onClick={()=>navigate(id)}><Icon size={20}/><span>{label}</span></button>)}
        <button onClick={()=>setMobileMenu(true)}><Menu size={20}/><span>Thêm</span></button>
      </nav>
      {toast && <div className="toast"><span><Check size={15} /></span>{toast}</div>}
    </div>
  );
}
