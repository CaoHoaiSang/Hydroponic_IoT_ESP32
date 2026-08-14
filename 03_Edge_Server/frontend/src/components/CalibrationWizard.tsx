import { useEffect, useState } from "react";
import { AlertTriangle, Check, Gauge, LockKeyhole, Plus, ShieldCheck } from "lucide-react";
import { backendApiAdapter } from "../adapters";
import type { StableMeasurement } from "../adapters";

type Props = { deviceId: string; notify: (message: string) => void };

export function CalibrationWizard({ deviceId, notify }: Props) {
  const [active, setActive] = useState<unknown | null>(null);
  const [setId, setSetId] = useState("");
  const [referenceMeter, setReferenceMeter] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [measurement, setMeasurement] = useState<StableMeasurement | null>(null);
  const [referenceEc, setReferenceEc] = useState("");
  const [pointNote, setPointNote] = useState("");
  const [pointCount, setPointCount] = useState(0);
  const [validated, setValidated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { backendApiAdapter.getActiveCalibration(deviceId).then(result => setActive(result.data)).catch(() => setActive(null)); }, [deviceId]);
  const run = async (job: () => Promise<void>) => { setBusy(true); setError(""); try { await job(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Backend từ chối yêu cầu"); } finally { setBusy(false); } };
  const createDraft = () => run(async () => { const result = await backendApiAdapter.createCalibrationSet(deviceId, `${referenceMeter}${sessionNote ? ` · ${sessionNote}` : ""}`); setSetId(result.data.setId); notify("Đã tạo draft calibration trên Backend"); });
  const capture = () => run(async () => { const value = await backendApiAdapter.captureLatest(deviceId); if (!value.stable) throw new Error("Phép đo mới nhất chưa ổn định"); setMeasurement(value); notify("Đã chụp phép đo ổn định mới nhất"); });
  const savePoint = () => run(async () => {
    if (!measurement) throw new Error("Hãy chụp phép đo ổn định từ Backend trước");
    const ec = Number(referenceEc); if (!Number.isFinite(ec) || ec <= 0) throw new Error("EC tham chiếu phải lớn hơn 0");
    await backendApiAdapter.addCalibrationPoint(deviceId, setId, { ...measurement, referenceEcUsCm: ec, note: pointNote });
    setPointCount(count => count + 1); setMeasurement(null); setReferenceEc(""); setPointNote(""); setValidated(false); notify("Đã lưu điểm EC vào draft");
  });
  const validate = () => run(async () => { if (pointCount < 3) throw new Error("Cần tối thiểu 3 điểm EC hợp lệ trước khi validate"); await backendApiAdapter.validateCalibration(deviceId, setId); setValidated(true); notify("Backend xác nhận calibration set hợp lệ"); });
  const activate = () => run(async () => { await backendApiAdapter.activateCalibration(deviceId, setId); setConfirming(false); setActive({ setId }); notify("Đã activate; Backend vẫn giữ Auto Dosing OFF"); });

  return <div className="view-stack calibration-wizard">
    <section className="active-calibration">
      <div className="active-cal-head"><span>{active ? <ShieldCheck size={23}/> : <AlertTriangle size={23}/>}</span><div><small>BỘ HIỆU CHUẨN ĐANG KÍCH HOẠT</small><strong>{active ? "Có active calibration set từ Backend" : "Chưa có active calibration set"}</strong><p>Legacy chỉ dùng tham khảo · Piecewise-linear EC interpolation · TDS scale 500 (factor 0.5)</p></div><span className={`status-chip ${active ? "success" : "muted"}`}>{active ? "ACTIVE" : "NONE"}</span></div>
    </section>
    <section className="dashboard-grid calibration-grid"><article className="panel">
      <div className="panel-head"><div><span className="panel-kicker">Draft → Capture → Validate</span><h2>Hiệu chuẩn EC/TDS từ dữ liệu Backend</h2></div><span className="step-badge">{pointCount} điểm</span></div>
      {!setId ? <div className="cal-point-form"><label>Máy đo tham chiếu<input value={referenceMeter} onChange={e=>setReferenceMeter(e.target.value)} placeholder="Tên / serial máy đo"/></label><label className="wide">Ghi chú phiên<input value={sessionNote} onChange={e=>setSessionNote(e.target.value)} placeholder="Dung dịch, điều kiện đo"/></label><button className="primary-button" disabled={busy || !referenceMeter.trim()} onClick={createDraft}><Plus size={15}/> Tạo draft</button></div> : <>
        <p className="calibration-tip"><Gauge size={16}/> Draft: <b>{setId}</b>. Giá trị đo là read-only và chỉ lấy từ Backend.</p>
        <div className="cal-point-form"><label>ADC thô<input readOnly value={measurement?.measuredRaw ?? "—"}/></label><label>Điện áp đo<input readOnly value={measurement?.measuredVoltage ?? "—"}/></label><label>Nhiệt độ nước<input readOnly value={measurement?.waterTemp ?? "—"}/></label><label>EC tham chiếu<input type="number" min="1" max="2000" value={referenceEc} onChange={e=>setReferenceEc(e.target.value)} placeholder="µS/cm"/></label><label className="wide">Ghi chú điểm<input value={pointNote} onChange={e=>setPointNote(e.target.value)} placeholder="Dung dịch chuẩn"/></label></div>
        <div className="form-actions"><button className="secondary-button" disabled={busy} onClick={capture}>Chụp dữ liệu mới nhất</button><button className="primary-button" disabled={busy || !measurement} onClick={savePoint}>Lưu điểm chuẩn</button></div>
      </>}
      {error && <div className="calibration-tip wide-tip" role="alert"><AlertTriangle size={16}/><p>{error}</p></div>}
    </article><article className="panel"><div className="panel-head"><div><span className="panel-kicker">Safety gate</span><h2>Validate và Activate</h2></div><span className={`status-chip ${validated ? "success" : "muted"}`}>{validated ? "Đạt" : "Chưa đạt"}</span></div>
      <div className="quality-list"><div><span>Điểm hợp lệ tối thiểu</span><b>{pointCount} / 3</b></div><div><span>Phương pháp</span><b>piecewise_linear_ec</b></div><div><span>Auto Dosing</span><b>OFF</b></div><div><span>Lệnh bơm khi activate</span><b>Không gửi</b></div></div>
      <div className="form-actions"><button className="secondary-button" disabled={busy || !setId || pointCount < 3} onClick={validate}><Check size={15}/> Validate</button><button className="primary-button" disabled={busy || !validated} onClick={()=>setConfirming(true)}><LockKeyhole size={15}/> Activate</button></div>
    </article></section>
    {confirming && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirming(false)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="activate-title"><h2 id="activate-title">Xác nhận Activate</h2><p>Active set cũ sẽ được retire. Khoảng đo hợp lệ lấy từ kết quả validate. Auto Dosing vẫn OFF và thao tác này không phát lệnh bơm.</p><div className="form-actions"><button className="secondary-button" autoFocus onClick={()=>setConfirming(false)}>Hủy</button><button className="primary-button" disabled={busy} onClick={activate}>Xác nhận Activate</button></div></div></div>}
  </div>;
}
