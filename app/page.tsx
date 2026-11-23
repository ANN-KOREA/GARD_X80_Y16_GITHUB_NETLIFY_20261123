"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  InputRecord,
  LOW_SAMPLE,
  M0Comparison,
  M0Observation,
  SAMPLE_CASES,
  ScoreResult,
  X80_FIELDS,
  buildM0Observations,
  calculateScores,
  cleanInputs,
  compareWithM0,
  completionRate,
} from "@/lib/score-engine";
import { MlScore, LoadProgress, scoreAllML } from "@/lib/ml-runtime";

type AuditRecord = {
  id: string;
  subjectKey: string;
  createdAt: string;
  modelVersion: string;
  parserVersion: string;
  completeness: number;
  inputs: InputRecord;
  scores: Array<ScoreResult | MlScore>;
  mlScores?: MlScore[];
  m0Scores?: ScoreResult[];
  m0Observations?: M0Observation[];
  m0Comparisons?: Record<string, M0Comparison>;
  components: Record<string, string | number | boolean>;
  warnings: string[];
};

const STORAGE_KEY = "x80-y16-score-factory-v1";
const DRAFT_KEY = "x80-y16-score-draft-v1";
const groups = [...new Set(X80_FIELDS.map((field) => field[1]))];
const keyFields = new Set(["성별", "나이", "BMI (체질량 지수)", "최고혈압", "hba1c", "t_cholesterol", "ldl_chol", "tg", "hdl_chol", "apob", "apoc3"]);

const formatScore = (score: number | null) => score === null ? "NA" : score.toFixed(2);
const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function download(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  return rows;
}

export default function Home() {
  const [inputs, setInputs] = useState<InputRecord>(LOW_SAMPLE);
  const [subjectKey, setSubjectKey] = useState("SAMPLE-001");
  const [activeTab, setActiveTab] = useState<"work" | "history" | "evidence">("work");
  const [fieldMode, setFieldMode] = useState<"core" | "all">("core");
  const [openGroup, setOpenGroup] = useState<string>("문진·인구학");
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [toast, setToast] = useState("");
  const [selectedResult, setSelectedResult] = useState<string>("lipid");
  const [mlScores, setMlScores] = useState<MlScore[] | null>(null);
  const [mlProgress, setMlProgress] = useState<LoadProgress | null>(null);
  const [mlError, setMlError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const draft = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed.filter(isAuditRecord).slice(0, 100));
      }
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.inputs) setInputs(cleanInputs(parsed.inputs));
        if (parsed.subjectKey) setSubjectKey(parsed.subjectKey);
      }
    } catch { /* keep safe defaults */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ inputs, subjectKey })); }
    catch { /* calculation remains available when storage is disabled */ }
  }, [inputs, subjectKey, hydrated]);

  const cleaned = useMemo(() => cleanInputs(inputs), [inputs]);
  const result = useMemo(() => calculateScores(cleaned), [cleaned]);
  const m0Observations = useMemo(() => buildM0Observations(result.scores, result.components), [result]);
  const m0Comparisons = useMemo(() => Object.fromEntries(result.scores.map((score) => {
    const ml = mlScores?.find((item) => item.key === score.key);
    return [score.key, compareWithM0(score.key, ml?.score, score.score, score.applicable)];
  })), [result.scores, mlScores]);
  const completeness = completionRate(cleaned);
  const selected = result.scores.find((score) => score.key === selectedResult) ?? result.scores[0];
  const selectedMl = mlScores?.find((score) => score.key === selectedResult) ?? null;
  const selectedObservation = m0Observations.find((item) => item.key === selected.key) ?? m0Observations[0];
  const selectedComparison = m0Comparisons[selected.key];
  const fieldsShown = fieldMode === "all" ? X80_FIELDS : X80_FIELDS.filter(([name]) => keyFields.has(name));
  const missing = X80_FIELDS.filter(([name]) => cleaned[name] === "" || cleaned[name] === undefined).map(([name]) => name);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const invalidateMl = () => { setMlScores(null); setMlProgress(null); setMlError(""); };
  const updateInput = (name: string, value: string) => { setInputs((current) => ({ ...current, [name]: value })); invalidateMl(); };

  const loadSample = (index: number) => {
    setInputs(SAMPLE_CASES[index].values);
    setSubjectKey(`SAMPLE-00${index + 1}`);
    invalidateMl();
    showToast(`${SAMPLE_CASES[index].name} 사례를 불러왔습니다.`);
  };

  const calculateML = async () => {
    setBusy(true);
    setMlError("");
    setMlProgress({ completed: 0, total: 16, label: "모델 레지스트리" });
    try {
      const scores = await scoreAllML(cleaned, setMlProgress);
      setMlScores(scores);
      setMlProgress(null);
      showToast("16개 frozen winner ML Score를 생성했습니다.");
      return scores;
    } catch (error) {
      const message = error instanceof Error ? error.message : "ML 모델을 불러오지 못했습니다.";
      setMlError(message); setMlProgress(null); showToast(message);
      return null;
    } finally { setBusy(false); }
  };

  const saveRecord = () => {
    const primaryScores = mlScores ?? result.scores;
    const record: AuditRecord = {
      id: crypto.randomUUID(), subjectKey: subjectKey.trim() || `LOCAL-${Date.now()}`,
      createdAt: new Date().toISOString(), modelVersion: mlScores ? "X80-Y16-FROZEN-WINNERS-20260822-1941-PORTABLE-v1" : "X80-M0-REF-v1.0",
      parserVersion: "X80-PARSER-v1.0", completeness, inputs: cleaned,
      scores: primaryScores, mlScores: mlScores ?? undefined, m0Scores: result.scores,
      m0Observations, m0Comparisons,
      components: result.components, warnings: result.warnings,
    };
    const next = [record, ...history].slice(0, 100);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setHistory(next);
      showToast("이 기기에 계산 기록을 저장했습니다.");
    } catch { showToast("브라우저 저장소가 부족하거나 차단되었습니다. JSON으로 내보내 주세요."); }
  };

  const loadRecord = (record: AuditRecord) => {
    setInputs(record.inputs); setSubjectKey(record.subjectKey); setMlScores(record.mlScores ?? null); setMlProgress(null); setMlError(""); setActiveTab("work");
    showToast("저장된 기록을 입력 화면에 불러왔습니다.");
  };

  const deleteRecord = (id: string) => {
    const next = history.filter((item) => item.id !== id);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setHistory(next); }
    catch { showToast("기록을 삭제하지 못했습니다. 브라우저 저장 설정을 확인해 주세요."); }
  };

  const exportCurrent = (kind: "json" | "csv") => {
    const primaryScores = mlScores ?? result.scores;
    const payload = { subjectKey, generatedAt: new Date().toISOString(), modelVersion: mlScores ? "X80-Y16-FROZEN-WINNERS-20260822-1941-PORTABLE-v1" : "X80-M0-REF-v1.0", observationVersion: "X80-M0-OBS-v1.0", parserVersion: "X80-PARSER-v1.0", completeness, inputs: cleaned, scores: primaryScores, mlScores, m0Scores: result.scores, m0Observations, m0Comparisons, components: result.components, warnings: result.warnings, interpretationBoundary: "Existing Final Score reconstruction; not diagnosis or disease probability" };
    if (kind === "json") download(`${subjectKey || "x80-y16"}.json`, JSON.stringify(payload, null, 2));
    else {
      const headers = ["subject_key", "engine", "observation_version", ...X80_FIELDS.map(([name]) => name), ...primaryScores.map((score) => `${score.label}_Score`), ...result.scores.map((score) => `${score.label}_M0_Reference`), ...m0Observations.map((item) => `${item.label}_M0_소견`), ...result.scores.map((score) => `${score.label}_ML_M0_비교`)];
      const values = [subjectKey, mlScores ? "16_FROZEN_WINNERS_ML" : "M0_REFERENCE", "X80-M0-OBS-v1.0", ...X80_FIELDS.map(([name]) => cleaned[name] ?? ""), ...primaryScores.map((score) => score.score ?? "NA"), ...result.scores.map((score) => score.score ?? "NA"), ...m0Observations.map((item) => `${item.band} | ${item.summary} | ${item.basis} | ${item.boundary}`), ...result.scores.map((score) => `${m0Comparisons[score.key].status} | ${m0Comparisons[score.key].detail}`)];
      download(`${subjectKey || "x80-y16"}.csv`, `\uFEFF${headers.map(escapeCsv).join(",")}\n${values.map(escapeCsv).join(",")}`, "text/csv");
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json") || /^[\s\uFEFF]*[\[{]/.test(text)) {
        const parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
        if (Array.isArray(parsed)) {
          if (!parsed.length || !parsed.every(isAuditRecord)) throw new Error("전체 기록 JSON 형식이 올바르지 않습니다.");
          const merged = [...new Map([...history, ...parsed].map((item) => [item.id, item])).values()]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          setHistory(merged); setActiveTab("history");
          showToast(`전체 기록을 복원했습니다. 현재 ${merged.length}건입니다.`);
          return;
        }
        if (!parsed || typeof parsed !== "object") throw new Error("JSON 객체를 선택해 주세요.");
        const record = parsed;
        setInputs(cleanInputs(record.inputs ?? record.features ?? record));
        // Imported inputs require fresh inference; do not label supplied scores as current.
        invalidateMl();
        if (record.subjectKey || record.name) setSubjectKey(record.subjectKey ?? record.name);
        showToast("JSON 입력을 불러왔습니다.");
      } else {
        const rows = parseCsv(text);
        if (rows.length < 2) throw new Error("데이터 행이 없습니다.");
        const headers = rows[0].map((item) => item.trim());
        if (new Set(headers).size !== headers.length) throw new Error("CSV 열 이름이 중복되어 있습니다.");
        if (!headers.some((name) => X80_FIELDS.some(([field]) => field === name))) throw new Error("X80 필드가 없는 CSV입니다. 예제 템플릿을 사용해 주세요.");
        if (rows.length > 101) throw new Error("CSV는 한 번에 최대 100건입니다. 파일을 나눠 주세요.");
        const dataRows = rows.slice(1, 101);
        const records: Array<Record<string, unknown>> = [];
        for (let index = 0; index < dataRows.length; index++) {
          const row = dataRows[index];
          const raw: InputRecord = {};
          headers.forEach((header, cellIndex) => { raw[header] = row[cellIndex] ?? ""; });
          const safe = cleanInputs(raw), calc = calculateScores(safe);
          const ml = await scoreAllML(safe, (progress) => setMlProgress({ completed: index * 16 + progress.completed, total: dataRows.length * 16, label: `${index + 1}행 · ${progress.label}` }));
          const observations = buildM0Observations(calc.scores, calc.components);
          const comparisons = Object.fromEntries(calc.scores.map((score) => {
            const mlScore = ml.find((item) => item.key === score.key);
            return [score.key, compareWithM0(score.key, mlScore?.score, score.score, score.applicable)];
          }));
          records.push({ index: index + 1, subject_key: raw.subject_key ?? raw.subjectKey ?? `BATCH-${index + 1}`, engine: "16_FROZEN_WINNERS_ML", observation_version: "X80-M0-OBS-v1.0", ...Object.fromEntries(ml.map((score) => [`${score.label}_Score`, score.score ?? "NA"])), ...Object.fromEntries(calc.scores.map((score) => [`${score.label}_M0_Reference`, score.score ?? "NA"])), ...Object.fromEntries(observations.map((item) => [`${item.label}_M0_소견`, `${item.band} | ${item.summary} | ${item.basis} | ${item.boundary}`])), ...Object.fromEntries(calc.scores.map((score) => [`${score.label}_ML_M0_비교`, `${comparisons[score.key].status} | ${comparisons[score.key].detail}`])) });
        }
        setMlProgress(null);
        const batchHeaders = Object.keys(records[0]);
        const csv = `\uFEFF${batchHeaders.map(escapeCsv).join(",")}\n${records.map((record) => batchHeaders.map((header) => escapeCsv(record[header])).join(",")).join("\n")}`;
        download(`x80-y16-batch-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
        showToast(`${records.length}건의 16개 ML Score와 M0 소견을 만들었습니다.`);
      }
    } catch (error) { setMlProgress(null); showToast(error instanceof Error ? error.message : "파일을 읽지 못했습니다."); }
    finally { setBusy(false); event.target.value = ""; }
  };

  return (
    <main>
      <fieldset className="factory-controls" disabled={busy} aria-label="Score Factory 작업대">
      <header className="topbar">
        <div className="brand-wrap"><div className="brand-mark" aria-hidden="true">16</div><div><p className="eyebrow">X80 → Y16 · LOCAL FACTORY</p><h1>Score Reconstruction Factory</h1></div></div>
        <div className="privacy-pill"><span className="live-dot" /> 입력 데이터는 이 브라우저에만 저장</div>
      </header>

      <nav className="tabs" aria-label="주요 화면">
        <button className={activeTab === "work" ? "active" : ""} onClick={() => setActiveTab("work")}>입력 · 계산</button>
        <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>로컬 기록 <b>{history.length}</b></button>
        <button className={activeTab === "evidence" ? "active" : ""} onClick={() => setActiveTab("evidence")}>공정 · 검증</button>
      </nav>

      {activeTab === "work" && <>
        <section className="workspace-head">
          <div><p className="section-kicker">16 FROZEN WINNERS · FULL-X80 INFERENCE</p><h2>16개 ML Reconstruction Score</h2><p>각 Target의 고정된 winner 모델로 계산하고, M0 설명 기준선을 나란히 비교합니다.</p></div>
          <div className="head-actions"><input value={subjectKey} onChange={(event) => setSubjectKey(event.target.value)} aria-label="대상자 키" placeholder="대상자 키 (비식별)" /><button className="secondary" onClick={() => fileRef.current?.click()}>JSON / CSV 가져오기</button><input ref={fileRef} type="file" accept=".json,.csv" hidden onChange={handleImport} /></div>
        </section>

        <section className="status-strip">
          <div className="status-main"><div className="progress-ring" style={{ "--progress": `${Math.round(completeness * 360)}deg` } as React.CSSProperties}><span>{Math.round(completeness * 100)}%</span></div><div><strong>입력 완전도</strong><small>{80 - missing.length}/80 입력 · {missing.length ? `${missing.length}개 비어 있음` : "Data Contract 충족"} · {mlScores ? "ML 결과 최신" : "ML 계산 필요"}</small></div></div>
          <div className="sample-actions"><span>가상 사례</span>{SAMPLE_CASES.map((item, index) => <button key={item.name} onClick={() => loadSample(index)}>{index + 1}. {item.name.replace(" 지질신호", "")}</button>)}<button onClick={() => { setInputs({}); setSubjectKey(""); invalidateMl(); }}>비우기</button></div>
        </section>

        <div className="workspace-grid">
          <section className="input-panel card">
            <div className="panel-head"><div><span className="step">01</span><h3>X80 입력</h3></div><div className="segmented"><button className={fieldMode === "core" ? "active" : ""} onClick={() => setFieldMode("core")}>핵심 11</button><button className={fieldMode === "all" ? "active" : ""} onClick={() => setFieldMode("all")}>전체 80</button></div></div>
            {fieldMode === "core" ? <div className="field-grid core-fields">{fieldsShown.map(([name, group, type]) => <Field key={name} name={name} group={group} type={type} value={inputs[name]} onChange={updateInput} />)}</div> : <div className="accordion-list">{groups.map((group) => { const groupFields = fieldsShown.filter(([, fieldGroup]) => fieldGroup === group); const filled = groupFields.filter(([name]) => cleaned[name] !== "" && cleaned[name] !== undefined).length; return <div className="accordion" key={group}><button className="accordion-button" onClick={() => setOpenGroup(openGroup === group ? "" : group)}><span>{group}</span><small>{filled}/{groupFields.length}</small><b>{openGroup === group ? "−" : "+"}</b></button>{openGroup === group && <div className="field-grid">{groupFields.map(([name, fieldGroup, type]) => <Field key={name} name={name} group={fieldGroup} type={type} value={inputs[name]} onChange={updateInput} />)}</div>}</div>; })}</div>}
            <div className="quality-note"><b>품질 게이트 적용</b><span>BMI=0, 음수 LDL, 비정상 RDW/PCT/MPV/PDW/MCH는 결측으로 정규화합니다.</span></div>
          </section>

          <section className="result-panel card">
            <div className="panel-head"><div><span className="step coral">02</span><h3>Y16 결과</h3></div><span className={`engine-badge ${mlScores ? "ready" : ""}`}>{mlScores ? "16 FROZEN WINNERS · READY" : "M0 READY · ML WAITING"}</span></div>
            {mlProgress && <div className="model-loading"><div><span style={{ width: `${Math.round(mlProgress.completed / mlProgress.total * 100)}%` }} /></div><p>{mlProgress.label} · {mlProgress.completed}/{mlProgress.total} 모델</p></div>}
            {mlError && <div className="warning-box"><p>{mlError}</p></div>}
            {(["8대 암", "8대 만성질환"] as const).map((group) => <div className="score-section" key={group}><div className="score-section-title"><h4>{group}</h4><span>{group === "8대 암" ? "성별 적용성 자동 반영" : "Target별 Frozen Winner"}</span></div><div className="score-grid">{result.scores.filter((score) => score.group === group).map((score) => { const ml = mlScores?.find((item) => item.key === score.key); const applicable = ml ? ml.applicable : score.applicable; return <button key={score.key} className={`score-card ${selected.key === score.key ? "selected" : ""} ${applicable ? "" : "not-applicable"} ${ml ? "ml-ready" : ""}`} onClick={() => setSelectedResult(score.key)}><span>{score.label}</span><strong>{ml ? formatScore(ml.score) : "—"}</strong><small>{ml ? `M0 ${formatScore(score.score)} · ${ml.architecture.replace("M3_", "").replace("M5_", "").replace("M4_", "")}` : `M0 ${formatScore(score.score)} · Stage ${score.stage}`}</small></button>; })}</div></div>)}
            <div className="result-detail"><div><span className="detail-label">선택 결과 · Stage {selected.stage} · {selectedMl ? "FROZEN ML" : "M0 REFERENCE"}</span><h4>{selected.label} <b>{selectedMl ? formatScore(selectedMl.score) : "계산 전"}</b></h4><code>{selectedMl ? `${selectedMl.architecture} · raw ${selectedMl.raw?.toFixed(6) ?? "NA"} · N=${selectedMl.trainingN.toLocaleString()}` : selected.formula}</code><div className="m0-compare"><span>M0 Reference</span><b>{formatScore(selected.score)}</b><small>{selected.formula}</small></div></div><div className="metric-pair"><div><span>Locked Holdout Exact</span><b>{(selectedMl ? selectedMl.historicalExact * 100 : selected.holdoutExact).toFixed(2)}%</b></div><div><span>Within ±1</span><b>{(selectedMl ? selectedMl.historicalWithin1 * 100 : selected.holdoutWithin1).toFixed(2)}%</b></div></div><p>{selectedMl ? <>현재 값은 8,843명 전체 적격자료(성별 제한 Target 제외)로 post-validation refit된 <b>{selectedMl.architecture}</b> frozen winner의 실제 브라우저 추론 결과입니다.</> : <>M0 기준선은 준비되어 있습니다. 아래 버튼으로 <b>{selected.primaryModel}</b> frozen winner를 포함한 16개 ML 모델을 불러오십시오.</>}</p></div>
            <article className={`m0-observation ${selectedObservation.applicable ? "" : "na"}`}>
              <div className="observation-head"><div><span>M0 MANUAL OBSERVATION · X80-M0-OBS-v1.0</span><h4>{selected.label} M0 매뉴얼 소견</h4></div><b>{selectedObservation.band}</b></div>
              <p className="observation-summary">{selectedObservation.summary}</p>
              <div className="observation-grid"><div><span>공식 반영 근거</span><p>{selectedObservation.basis}</p></div><div><span>Frozen ML ↔ M0 비교</span><p><b>{selectedComparison.status}</b> · {selectedComparison.detail}</p></div></div>
              <p className="observation-boundary"><b>해석 경계</b> {selectedObservation.boundary}</p>
            </article>
            <div className="component-row">{Object.entries(result.components).slice(0, 10).map(([key, value]) => <div key={key}><span>{key}</span><b>{String(value)}</b></div>)}</div>
            {result.warnings.length > 0 && <div className="warning-box">{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
            <div className="governance-box"><b>해석 경계</b><p>ML Reconstruction Score는 기존 전문가 Final Score의 생성관계를 재현합니다. 실제 암 확진, 질환 발생확률, 임상적 민감도·특이도가 아닙니다.</p></div>
            <div className="result-actions">{!mlScores && <button className="primary" disabled={Boolean(mlProgress)} onClick={calculateML}>{mlProgress ? "16개 모델 계산 중…" : "16개 Frozen ML 계산"}</button>}<button className={mlScores ? "primary" : "secondary"} onClick={saveRecord}>{mlScores ? "ML 결과·M0 소견 저장" : "M0 결과·소견 저장"}</button><button className="secondary" onClick={() => exportCurrent("json")}>JSON</button><button className="secondary" onClick={() => exportCurrent("csv")}>CSV</button><button className="secondary" onClick={() => window.print()}>인쇄</button></div>
          </section>
        </div>
      </>}

      {activeTab === "history" && <section className="content-shell"><div className="page-title-row"><div><p className="section-kicker">DEVICE-LOCAL AUDIT TRAIL</p><h2>로컬 계산 기록</h2><p>최대 100건을 이 브라우저에 저장합니다. 서버 전송이나 계정 동기화는 없습니다.</p></div><div className="head-actions"><button className="secondary" onClick={() => download("x80-y16-history.json", JSON.stringify(history, null, 2))}>전체 내보내기</button><button className="danger" onClick={() => { if (confirm("이 브라우저의 모든 기록을 삭제할까요?")) { setHistory([]); localStorage.removeItem(STORAGE_KEY); } }}>전체 삭제</button></div></div>{history.length === 0 ? <div className="empty-state"><span>0</span><h3>아직 저장된 기록이 없습니다</h3><p>입력·계산 화면에서 ‘이 기기에 기록 저장’을 누르세요.</p><button className="primary" onClick={() => setActiveTab("work")}>첫 기록 만들기</button></div> : <div className="history-list">{history.map((record) => <article key={record.id} className="history-card"><div className="history-meta"><span>{new Date(record.createdAt).toLocaleString("ko-KR")}</span><b>{record.subjectKey}</b><small>{Math.round(record.completeness * 100)}% 입력 · {record.mlScores ? "16 Frozen ML" : "M0 Reference"} · {record.m0Observations ? "M0 소견 포함" : "이전 형식"}</small></div><div className="mini-scores">{record.scores.map((score) => <span key={score.key}>{score.label} <b>{formatScore(score.score)}</b></span>)}</div><div className="history-actions"><button onClick={() => loadRecord(record)}>불러오기</button><button onClick={() => download(`${record.subjectKey}.json`, JSON.stringify(record, null, 2))}>내보내기</button><button className="delete" onClick={() => deleteRecord(record.id)}>삭제</button></div></article>)}</div>}</section>}

      {activeTab === "evidence" && <section className="content-shell evidence-page"><div className="page-title-row"><div><p className="section-kicker">FACTORY GOVERNANCE</p><h2>공정 · 검증 지도</h2><p>네 개 기준파일을 M0 설명층과 16개 frozen ML 실행층으로 연결했습니다.</p></div><span className="version-stamp">기준일 2026-08-22</span></div><div className="evidence-cards"><article><span>01</span><h3>X80 Data Contract</h3><p>문진·인구학 27개와 바이오마커 53개. Score/original 열은 입력에서 차단하고 성별 적용성을 분리합니다.</p></article><article><span>02</span><h3>M0 Reference Layer</h3><p>A, S, M, INF, LIV, LIP, KID, HEM, GLY, THY와 8개 TM을 16개 설명 기준선에 적용합니다.</p></article><article><span>03</span><h3>16 Frozen Winners</h3><p>Target별 Direct ET 11개, Classifier 4개, Rule+Residual ET 1개를 브라우저에서 직접 실행합니다.</p></article><article><span>04</span><h3>Local Audit Trail</h3><p>입력, ML·M0 Score, raw prediction, 완전도와 모델 버전을 브라우저 저장소에 기록합니다.</p></article></div><div className="evidence-grid"><article className="card source-map"><h3>네 개 기준파일 반영 결과</h3><table><thead><tr><th>기준 파일</th><th>MVP에 반영한 내용</th></tr></thead><tbody><tr><td>누구나 사용자 매뉴얼 v1.0</td><td>X80 schema, 16개 M0 공식, 성별 적용성, 품질 게이트, Stage 1–16 검증표, 해석 경계</td></tr><tr><td>8,843 SCORE 현안 분석</td><td>Exact와 Within ±1의 구분, “인접 단계 재현율 ≠ 임상 정확도” 안내</td></tr><tr><td>고지혈증 Self-Service MVP ZIP</td><td>3개 가상 사례, X80 입력 패턴, 로컬 내보내기, Stage-12 frozen 모델의 서비스 패턴</td></tr><tr><td>16Target Frozen Winner Bundles</td><td>16개 post-validation frozen model, 전처리기, score grid, 성별 적용성, 개별 SHA와 smoke test</td></tr></tbody></table></article><article className="card boundary-card"><h3>경계 해결 결과</h3><div className="boundary-line pass"><b>16/16 모델 확보</b><span>8대 암·8대 만성질환의 Target별 winner bundle이 모두 확인되었습니다.</span></div><div className="boundary-line pass"><b>원본의 3중 검증 기록</b><span>원본 사이트에 기록된 결과: bundle SHA 16/16, Python smoke 16/16, portable parity 16/16 PASS. 이번 이전판에서는 portable 모델 SHA 및 내장 smoke 기대값 16/16을 별도 재검증했습니다.</span></div><div className="boundary-line partial"><b>포장 메타데이터 보정</b><span>MANIFEST에는 Stage 13–16만 기록되어 있어, 공식 16개 registry·실제 폴더·개별 SHA를 우선해 portable manifest를 재생성했습니다. ZIP 내부 MASTER 전체 해시 불일치도 실제 archive SHA로 별도 고정했습니다.</span></div><div className="boundary-line pending"><b>남은 Evidence Gap</b><span>ML은 기존 Final Score를 재현합니다. 독립 병리·영상·추적 outcome에 대한 임상검증은 별도 단계입니다.</span></div></article></div><article className="card metric-explainer"><div><span className="step coral">±1</span><h3>Within ±1을 읽는 법</h3></div><p>예측 Score가 실제 기존 Final Score와 정확히 같거나, 그 Score grid에서 바로 앞·뒤 한 단계 이내인 비율입니다. 예: 실제 0.40에 예측 0.30·0.40·0.50은 성공, 0.20·0.60은 실패입니다.</p><strong>질환을 ±10% 오차로 맞혔다는 뜻이 아닙니다.</strong></article></section>}

      <footer><span>X80 → Y16 Score Reconstruction Factory</span><p>16 frozen winner inference + M0 reference · Existing Final Score reconstruction only</p><b>Data stays local</b></footer>
      </fieldset>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function isAuditRecord(value: unknown): value is AuditRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AuditRecord>;
  const validScores = (scores: unknown) => Array.isArray(scores) && scores.length === 16 && scores.every((item) =>
    item && typeof item === "object" && typeof item.key === "string" && typeof item.label === "string" &&
    (item.score === null || (typeof item.score === "number" && Number.isFinite(item.score))));
  return typeof record.id === "string" && typeof record.subjectKey === "string" &&
    typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt)) &&
    typeof record.completeness === "number" && Boolean(record.inputs && typeof record.inputs === "object") &&
    validScores(record.scores) && (!record.mlScores || (validScores(record.mlScores) && record.mlScores.every((item) =>
      typeof item.architecture === "string" && typeof item.trainingN === "number")));
}

function Field({ name, type, value, onChange }: { name: string; group: string; type: string; value: string | number | null | undefined; onChange: (name: string, value: string) => void }) {
  const aliases: Record<string, string> = { "BMI (체질량 지수)": "BMI", "현재 복용중인 약 ": "현재 복용중인 약", "복용죽인 건강식품": "복용중인 건강식품", t_cholesterol: "총콜레스테롤", hdl_chol: "HDL 콜레스테롤", ldl_chol: "LDL 콜레스테롤", y_gtp: "γ-GTP" };
  if (name === "성별") return <label className="field"><span>{aliases[name] ?? name}</span><select value={String(value ?? "")} onChange={(event) => onChange(name, event.target.value)}><option value="">선택</option><option value="M">M · 남성</option><option value="F">F · 여성</option></select></label>;
  return <label className="field"><span>{aliases[name] ?? name}</span><input type={type === "numeric" ? "number" : "text"} step="any" value={String(value ?? "")} onChange={(event) => onChange(name, event.target.value)} placeholder={type === "numeric" ? "숫자" : "텍스트 / Y·N"} /></label>;
}
