export type InputRecord = Record<string, string | number | null | undefined>;

export type ScoreResult = {
  key: string;
  label: string;
  group: "8대 암" | "8대 만성질환";
  score: number | null;
  applicable: boolean;
  formula: string;
  primaryModel: string;
  holdoutExact: number;
  holdoutWithin1: number;
  stage: number;
};

export type M0Observation = {
  key: string;
  label: string;
  group: "8대 암" | "8대 만성질환";
  applicable: boolean;
  m0Score: number | null;
  band: "적용 제외" | "기준선 하단" | "기준선 중간" | "기준선 상단";
  summary: string;
  basis: string;
  boundary: string;
};

export type M0Comparison = {
  status: "적용 제외" | "비교 전" | "정확 일치" | "인접 1단계" | "2단계 이상 차이";
  stepDifference: number | null;
  detail: string;
};

export const SCORE_GRIDS: Record<string, number[]> = {
  lung: [.15, .20, .25, .30, .35, .40, .45, .50, .55, .60, .65, .70, .75, .80],
  liverCancer: [.15, .20, .25, .30, .35, .40, .45, .50, .55, .60, .65, .70, .75, .80],
  colon: [.15, .20, .25, .30, .35, .40, .45, .50, .55, .60, .65, .70, .75, .80],
  stomach: [.20, .25, .30, .35, .40, .45, .50, .55, .60, .65, .70],
  prostate: [.10, .15, .20, .25, .30, .35, .40, .45, .50, .55, .60, .65, .70, .75, .80],
  breast: [.15, .20, .25, .30, .35, .40, .45, .50, .60, .70, .80],
  pancreas: [.10, .20, .25, .30, .35, .40, .45, .50, .60, .65, .70, .80],
  ovary: [.20, .25, .30, .35, .40, .45, .50, .60, .65, .70],
  immune: [.20, .30, .40, .50, .60, .70],
  cardio: [.20, .30, .40, .50, .60, .70, .80],
  diabetes: [.10, .20, .30, .40, .50, .60, .70],
  lipid: [.20, .30, .40, .50, .60, .70, .80, .90],
  thyroid: [.10, .20, .30, .40, .50, .60, .70],
  liverFunction: [.10, .20, .30, .40, .50, .60, .70, .80],
  kidney: [.10, .20, .30, .40, .50, .60, .70, .80, .90],
  blood: [.10, .20, .30, .40, .50, .60, .70],
};

const OBSERVATION_META: Record<string, { drivers: Array<[string, string]>; focus: string }> = {
  lung: { drivers: [["A", "연령"], ["S", "흡연"], ["TMlung", "CEA·CYFRA21-1"], ["INF", "염증"]], focus: "연령·흡연·폐암 관련 표지자·염증 신호" },
  liverCancer: { drivers: [["A", "연령"], ["LIV", "간 관련"], ["TMliver", "AFP·간질환"], ["INF", "염증"]], focus: "연령·간 관련 신호·AFP·염증 신호" },
  colon: { drivers: [["A", "연령"], ["TMcolon", "CEA·체중·혈액·소화기"], ["INF", "염증"]], focus: "연령·CEA·체중감소·혈액·소화기·염증 신호" },
  stomach: { drivers: [["A", "연령"], ["TMstomach", "PG2·CEA·소화기"], ["HEM", "혈액"]], focus: "연령·PG2·CEA·체중·소화기·혈액 신호" },
  prostate: { drivers: [["A", "연령"], ["TMprostate", "tPSA·PSA ratio" ]], focus: "남성에서 연령·tPSA·PSA ratio·배뇨 신호" },
  breast: { drivers: [["A", "연령"], ["TMbreast", "CA15-3·CEA"], ["M", "대사"]], focus: "여성에서 연령·CA15-3·CEA·가족력·대사 신호" },
  pancreas: { drivers: [["A", "연령"], ["TMpancreas", "CA19-9·CEA"], ["S", "흡연"], ["M", "대사"]], focus: "연령·CA19-9·CEA·체중·당대사·흡연 신호" },
  ovary: { drivers: [["A", "연령"], ["TMovary", "CA125·HE4"], ["INF", "염증"]], focus: "여성에서 연령·CA125·HE4·가족력·폐경·염증 신호" },
  immune: { drivers: [["INF", "염증"]], focus: "CRP·WBC·D-dimer·B2M·albumin 기반 염증 신호" },
  cardio: { drivers: [["A", "연령"], ["S", "흡연"], ["M", "대사"], ["LIP", "지질"], ["INF", "염증"]], focus: "연령·흡연·혈압·당대사·지질·염증 신호" },
  diabetes: { drivers: [["GLY", "HbA1c"], ["M", "대사"], ["A", "연령"]], focus: "HbA1c 중심의 당대사·체질·혈압·연령 신호" },
  lipid: { drivers: [["LIP", "지질"], ["M", "대사"]], focus: "총콜레스테롤·LDL·중성지방·HDL·ApoB·ApoC3·대사 신호" },
  thyroid: { drivers: [["THY", "갑상선"]], focus: "TSH·갑상선 관련 증상·진단·복약 신호" },
  liverFunction: { drivers: [["LIV", "간 관련"], ["INF", "염증"]], focus: "간질환·음주·AST·ALT·γ-GTP·bilirubin·albumin·염증 신호" },
  kidney: { drivers: [["KID", "신장"], ["A", "연령"], ["M", "대사"]], focus: "creatinine·BUN·요산·B2M·albumin·혈압·연령·대사 신호" },
  blood: { drivers: [["HEM", "혈액"], ["INF", "염증"]], focus: "Hgb·Hct·MCV·RDW·platelet·WBC·염증 신호" },
};

const nearestGridIndex = (key: string, value: number) => {
  const grid = SCORE_GRIDS[key] ?? [];
  if (!grid.length) return -1;
  return grid.reduce((best, current, index) => Math.abs(current - value) < Math.abs(grid[best] - value) ? index : best, 0);
};

export function buildM0Observations(scores: ScoreResult[], components: Components): M0Observation[] {
  return scores.map((score) => {
    const meta = OBSERVATION_META[score.key];
    const grid = SCORE_GRIDS[score.key] ?? [];
    if (!score.applicable || score.score === null) {
      return {
        key: score.key, label: score.label, group: score.group, applicable: false, m0Score: null, band: "적용 제외",
        summary: `${score.label} 항목은 현재 입력된 성별에 적용되지 않아 M0 매뉴얼 기준 소견을 생성하지 않았습니다.`,
        basis: `적용 조건을 확인하십시오. 이 Target의 주요 설명 요소는 ${meta?.focus ?? "M0 공식 구성요소"}입니다.`,
        boundary: "구조적 NA이며 0점이나 낮은 질환 가능성을 뜻하지 않습니다.",
      };
    }
    const index = nearestGridIndex(score.key, score.score);
    const ratio = grid.length > 1 ? index / (grid.length - 1) : 0;
    const band: M0Observation["band"] = ratio <= .33 ? "기준선 하단" : ratio <= .66 ? "기준선 중간" : "기준선 상단";
    const componentText = (meta?.drivers ?? []).map(([key, label]) => `${label} ${key}=${String(components[key] ?? "NA")}`).join(" · ");
    return {
      key: score.key, label: score.label, group: score.group, applicable: true, m0Score: score.score, band,
      summary: `M0 매뉴얼 공식으로 산출한 ${score.label} 설명 기준선은 ${score.score.toFixed(2)}이며, 해당 Target Score Grid에서 ${band}에 위치합니다.`,
      basis: `주요 반영요소: ${componentText || meta?.focus || "M0 공식 구성요소"}.`,
      boundary: `${band}이라는 표시는 기존 Final Score 생성규칙 안의 상대적 단계입니다. 암·질환의 진단, 발생확률, 중증도 또는 치료 필요성을 뜻하지 않습니다.`,
    };
  });
}

export function compareWithM0(key: string, mlScore: number | null | undefined, m0Score: number | null, applicable: boolean): M0Comparison {
  if (!applicable || m0Score === null) return { status: "적용 제외", stepDifference: null, detail: "성별 적용 조건에 따라 비교하지 않습니다." };
  if (mlScore === null || mlScore === undefined) return { status: "비교 전", stepDifference: null, detail: "16개 Frozen ML 계산 후 M0와의 단계 차이를 표시합니다." };
  const mlIndex = nearestGridIndex(key, mlScore), m0Index = nearestGridIndex(key, m0Score);
  const stepDifference = mlIndex < 0 || m0Index < 0 ? null : Math.abs(mlIndex - m0Index);
  if (stepDifference === null) return { status: "비교 전", stepDifference, detail: "Score Grid에서 비교 위치를 찾지 못했습니다." };
  const status: M0Comparison["status"] = stepDifference === 0 ? "정확 일치" : stepDifference === 1 ? "인접 1단계" : "2단계 이상 차이";
  return { status, stepDifference, detail: `Frozen ML ${mlScore.toFixed(2)}와 M0 ${m0Score.toFixed(2)}의 Score Grid 차이는 ${stepDifference}단계입니다.` };
}

export const X80_FIELDS = [
  ["성별", "문진·인구학", "categorical"],
  ["나이", "문진·인구학", "numeric"],
  ["BMI (체질량 지수)", "문진·인구학", "numeric"],
  ["최고혈압", "문진·인구학", "numeric"],
  ["최저혈압", "문진·인구학", "numeric"],
  ["불편한증상", "문진·인구학", "categorical"],
  ["1년 내에 받은 검사", "문진·인구학", "categorical"],
  ["체중감소", "문진·인구학", "categorical"],
  ["질병으로 진단 받은적", "문진·인구학", "categorical"],
  ["현재 복용중인 약 ", "문진·인구학", "categorical"],
  ["간 질환", "문진·인구학", "categorical"],
  ["암 가족력", "문진·인구학", "categorical"],
  ["흡연여부", "문진·인구학", "categorical"],
  ["흡연량", "문진·인구학", "categorical"],
  ["음주여부", "문진·인구학", "categorical"],
  ["음주량", "문진·인구학", "categorical"],
  ["보조식품 여부", "문진·인구학", "categorical"],
  ["복용죽인 건강식품", "문진·인구학", "categorical"],
  ["20분 땀", "문진·인구학", "categorical"],
  ["30분 땀", "문진·인구학", "categorical"],
  ["임신여부", "문진·인구학", "categorical"],
  ["월경여부", "문진·인구학", "categorical"],
  ["호르몬제 복용여부", "문진·인구학", "categorical"],
  ["과거 유방 양성 진단", "문진·인구학", "categorical"],
  ["피임약 복용여부", "문진·인구학", "categorical"],
  ["출산 자녀수", "문진·인구학", "categorical"],
  ["모유수유 기간", "문진·인구학", "categorical"],
  ["afp", "종양·염증 표지자", "numeric"],
  ["cea", "종양·염증 표지자", "numeric"],
  ["ca19_9", "종양·염증 표지자", "numeric"],
  ["ca125", "종양·염증 표지자", "numeric"],
  ["ca15_3", "종양·염증 표지자", "numeric"],
  ["tpsa", "종양·염증 표지자", "numeric"],
  ["cyfra21_1", "종양·염증 표지자", "numeric"],
  ["crp", "종양·염증 표지자", "numeric"],
  ["he4", "종양·염증 표지자", "numeric"],
  ["d_dimer", "종양·염증 표지자", "numeric"],
  ["ttr", "단백·대사", "numeric"],
  ["apoa1", "단백·대사", "numeric"],
  ["apoa2", "단백·대사", "numeric"],
  ["b2m", "단백·대사", "numeric"],
  ["svcam_1", "단백·대사", "numeric"],
  ["t_protein", "간·단백", "numeric"],
  ["albumin", "간·단백", "numeric"],
  ["t_bilirubin", "간·단백", "numeric"],
  ["ast", "간·단백", "numeric"],
  ["alt", "간·단백", "numeric"],
  ["alp", "간·단백", "numeric"],
  ["y_gtp", "간·단백", "numeric"],
  ["t_cholesterol", "지질·신장·당대사", "numeric"],
  ["tg", "지질·신장·당대사", "numeric"],
  ["hdl_chol", "지질·신장·당대사", "numeric"],
  ["ldl_chol", "지질·신장·당대사", "numeric"],
  ["bun", "지질·신장·당대사", "numeric"],
  ["creatinine", "지질·신장·당대사", "numeric"],
  ["uric_acid", "지질·신장·당대사", "numeric"],
  ["hba1c", "지질·신장·당대사", "numeric"],
  ["tsh", "지질·신장·당대사", "numeric"],
  ["vit_d", "지질·신장·당대사", "numeric"],
  ["apoc3", "지질·신장·당대사", "numeric"],
  ["apob", "지질·신장·당대사", "numeric"],
  ["wbc", "CBC", "numeric"],
  ["rbc", "CBC", "numeric"],
  ["hgb", "CBC", "numeric"],
  ["hct", "CBC", "numeric"],
  ["mcv", "CBC", "numeric"],
  ["mch", "CBC", "numeric"],
  ["mchc", "CBC", "numeric"],
  ["platelet", "CBC", "numeric"],
  ["rdw", "CBC", "numeric"],
  ["pct", "CBC", "numeric"],
  ["mpv", "CBC", "numeric"],
  ["pdw", "CBC", "numeric"],
  ["n_segment", "CBC", "numeric"],
  ["lymphocyte", "CBC", "numeric"],
  ["monocyte", "CBC", "numeric"],
  ["eosinophil", "CBC", "numeric"],
  ["basophil", "CBC", "numeric"],
  ["pg2", "기타 표지자", "numeric"],
  ["psa_ratio", "기타 표지자", "numeric"],
] as const;

export const LOW_SAMPLE: InputRecord = {
  "성별": "F", "나이": 42, "BMI (체질량 지수)": 22.5, "최고혈압": 116, "최저혈압": 72,
  "불편한증상": "없음", "1년 내에 받은 검사": "없음", "체중감소": "N", "질병으로 진단 받은적": "N",
  "현재 복용중인 약 ": "N", "간 질환": "N", "암 가족력": "N", "흡연여부": "N", "흡연량": "0",
  "음주여부": "N", "음주량": "0", "보조식품 여부": "있음", "복용죽인 건강식품": "N",
  "20분 땀": "0.일", "30분 땀": "0.일", "임신여부": "N", "월경여부": "Y", "호르몬제 복용여부": "N",
  "과거 유방 양성 진단": "아니오", "피임약 복용여부": "N", "출산 자녀수": "N", "모유수유 기간": "N",
  afp: 3.03, cea: 1.75, ca19_9: 7.93, ca125: 9.71, ca15_3: 8.13, tpsa: 0.85, cyfra21_1: 1.76,
  crp: 0.4, he4: 47.9, d_dimer: 0.18, ttr: 28.7, apoa1: 149, apoa2: 30.4, b2m: 1.51,
  svcam_1: 315, t_protein: 7.3, albumin: 4.6, t_bilirubin: 0.59, ast: 21, alt: 17, alp: 70, y_gtp: 20,
  t_cholesterol: 158, tg: 72, hdl_chol: 65, ldl_chol: 82, bun: 13.7, creatinine: 0.8, uric_acid: 4.9,
  hba1c: 5.3, tsh: 1.93, vit_d: 16.4, apoc3: 7.5, apob: 72, wbc: 5.58, rbc: 4.62, hgb: 14.1,
  hct: 43.5, mcv: 94.1, mch: 30.6, mchc: 32.4, platelet: 252, rdw: 12.5, pct: 0.27, mpv: 10.9,
  pdw: 13.2, n_segment: 52.7, lymphocyte: 36.4, monocyte: 7.2, eosinophil: 2.1, basophil: 0.7,
  pg2: 14.4, psa_ratio: 30,
};

export const SAMPLE_CASES = [
  { name: "낮은 지질신호", description: "제공 ZIP의 가상 검증 사례", values: LOW_SAMPLE },
  { name: "중간 지질신호", description: "일부 지질 threshold 초과", values: { ...LOW_SAMPLE, "성별": "M", "나이": 56, "BMI (체질량 지수)": 26.8, "최고혈압": 134, "최저혈압": 82, t_cholesterol: 218, tg: 168, hdl_chol: 43, ldl_chol: 142, hba1c: 5.9, apoc3: 10.8, apob: 108 } },
  { name: "높은 지질신호", description: "다수 지질·대사 threshold 초과", values: { ...LOW_SAMPLE, "성별": "M", "나이": 68, "BMI (체질량 지수)": 31.2, "최고혈압": 148, "최저혈압": 92, "질병으로 진단 받은적": "고지혈증, 고혈압", "현재 복용중인 약 ": "고지혈증약, 혈압약", t_cholesterol: 276, tg: 265, hdl_chol: 34, ldl_chol: 188, hba1c: 6.6, apoc3: 15.2, apob: 148 } },
];

const PERF: Record<string, [number, string, number, number]> = {
  lung: [1, "Direct ET", 51.84, 91.18], liverCancer: [2, "Direct ET", 65.97, 96.89], colon: [3, "Direct ET", 58.60, 95.59], stomach: [4, "Direct ET", 54.44, 96.83],
  prostate: [5, "Direct ET", 60.77, 98.01], breast: [6, "Direct ET", 66.74, 97.06], pancreas: [7, "Direct ET", 69.77, 97.80], ovary: [8, "Direct ET", 65.57, 96.72],
  immune: [9, "Direct ET", 89.20, 100], cardio: [10, "ET Classifier", 94.12, 97.79], diabetes: [11, "ET Classifier", 98.19, 100], lipid: [12, "Direct ET", 79.45, 98.25],
  thyroid: [13, "Rule+Residual ET", 94.68, 98.30], liverFunction: [14, "ET Classifier", 90.73, 98.42], kidney: [15, "Direct ET", 88.75, 98.70], blood: [16, "ET Classifier", 93.67, 96.61],
};

const n = (r: InputRecord, key: string) => {
  const value = r[key];
  if (value === null || value === undefined || value === "") return Number.NaN;
  const parsed = Number(String(value).replace(/,/g, "").match(/-?\d+(\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};
const s = (r: InputRecord, key: string) => String(r[key] ?? "").trim().toLowerCase();
const finite = (v: number) => Number.isFinite(v);
const I = (condition: boolean) => condition ? 1 : 0;
const T = (value: number, a: number, b: number, c: number) => finite(value) ? I(value >= a) + I(value >= b) + I(value >= c) : 0;
const cap = (v: number, max = 5) => Math.min(max, Math.max(0, v));
const q = (base: number, step: number, maxStage: number, u: number) => Number((base + step * cap(Math.floor(u + 0.5), maxStage)).toFixed(2));
const yes = (value: string) => /^(y|yes|예|있음|유|true|1)$/.test(value) || /있음|복용|진단/.test(value);
const includes = (value: string, words: string[]) => words.some((word) => value.includes(word));

export type Components = Record<string, number | boolean | string>;

export function calculateScores(r: InputRecord): { scores: ScoreResult[]; components: Components; warnings: string[] } {
  const sexRaw = s(r, "성별");
  const sex = /^m|남/.test(sexRaw) ? "M" : /^f|여/.test(sexRaw) ? "F" : "";
  const age = n(r, "나이");
  const A = !finite(age) ? 0 : age < 40 ? 0 : age < 50 ? 1 : age < 60 ? 2 : age < 70 ? 3 : age < 80 ? 4 : 5;
  const smoking = yes(s(r, "흡연여부"));
  const smokeAmount = n(r, "흡연량");
  const S = !smoking ? 0 : !finite(smokeAmount) ? 1 : smokeAmount >= 30 ? 4 : smokeAmount >= 20 ? 3 : smokeAmount >= 10 ? 2 : smokeAmount >= 1 ? 1 : 1;
  const bmi = n(r, "BMI (체질량 지수)"), sbp = n(r, "최고혈압"), hba1c = n(r, "hba1c");
  const M = cap(I(finite(bmi) && bmi >= 25) + I(finite(bmi) && bmi >= 30) + I(finite(sbp) && sbp >= 130) + I(finite(sbp) && sbp >= 140) + I(finite(hba1c) && hba1c >= 5.7) + I(finite(hba1c) && hba1c >= 6.5));
  const crp = n(r, "crp"), wbc = n(r, "wbc"), dd = n(r, "d_dimer"), b2m = n(r, "b2m"), albumin = n(r, "albumin");
  const INF = cap(I(finite(crp) && crp >= .3) + I(finite(crp) && crp >= 1) + I(finite(wbc) && wbc >= 8) + I(finite(dd) && dd >= .5) + I(finite(b2m) && b2m >= 2.5) + I(finite(albumin) && albumin < 4));
  const liverDisease = yes(s(r, "간 질환")) || includes(s(r, "질병으로 진단 받은적"), ["간염", "간경", "지방간"]);
  const drinkText = `${s(r, "음주여부")} ${s(r, "음주량")}`;
  const highDrink = includes(drinkText, ["과음", "고위험", "많음", "매일"]);
  const LIV = cap(I(liverDisease) + I(highDrink) + I(n(r, "ast") >= 40) + I(n(r, "alt") >= 40) + I(n(r, "y_gtp") >= 60) + I(n(r, "t_bilirubin") >= 1.3) + I(finite(albumin) && albumin < 4));
  const hdl = n(r, "hdl_chol");
  const lowHdl = finite(hdl) && ((sex === "M" && hdl < 40) || (sex === "F" && hdl < 50));
  const LIP = cap(I(n(r, "t_cholesterol") >= 200) + I(n(r, "ldl_chol") >= 130) + I(n(r, "tg") >= 150) + I(lowHdl) + I(n(r, "apob") >= 100) + I(n(r, "apoc3") >= 10));
  const creatinine = n(r, "creatinine");
  const creatinineHigh = finite(creatinine) && ((sex === "M" && creatinine > 1.3) || (sex === "F" && creatinine > 1.1));
  const KID = cap(I(creatinineHigh) + I(n(r, "bun") >= 20) + I(n(r, "uric_acid") >= 7) + I(finite(b2m) && b2m >= 2.5) + I(finite(albumin) && albumin < 4) + I(finite(sbp) && sbp >= 140));
  const hgb = n(r, "hgb"), hct = n(r, "hct"), mcv = n(r, "mcv"), rdw = n(r, "rdw"), platelet = n(r, "platelet");
  const hgbAbnormal = finite(hgb) && (sex === "M" ? hgb < 13 || hgb > 17.5 : sex === "F" ? hgb < 12 || hgb > 16 : hgb < 12 || hgb > 17.5);
  const hctAbnormal = finite(hct) && (sex === "M" ? hct < 39 || hct > 52 : sex === "F" ? hct < 36 || hct > 48 : hct < 36 || hct > 52);
  const HEM = cap(I(hgbAbnormal) + I(hctAbnormal) + I(finite(mcv) && (mcv < 80 || mcv > 100)) + I(finite(rdw) && rdw >= 14) + I(finite(platelet) && (platelet < 150 || platelet > 450)) + I(finite(wbc) && (wbc < 4 || wbc > 10)));
  const GLY = I(finite(hba1c) && hba1c >= 5.7) + I(finite(hba1c) && hba1c >= 6) + I(finite(hba1c) && hba1c >= 6.5) + I(finite(hba1c) && hba1c >= 8);
  const tsh = n(r, "tsh"), diagnoses = s(r, "질병으로 진단 받은적"), meds = s(r, "현재 복용중인 약 "), symptoms = s(r, "불편한증상");
  const THY = I(finite(tsh) && (tsh < .4 || tsh > 4.5)) + I(finite(tsh) && (tsh < .1 || tsh > 10)) + I(includes(`${symptoms} ${diagnoses}`, ["갑상선"])) + I(includes(meds, ["갑상선", "씬지", "신지"]));
  const family = s(r, "암 가족력");
  const fh = (words: string[]) => I(yes(family) || includes(family, words));
  const weightLoss = finite(n(r, "체중감소")) ? n(r, "체중감소") >= 3 : yes(s(r, "체중감소"));
  const gi = includes(symptoms, ["소화", "복통", "위장", "혈변", "대변", "설사", "변비"]);
  const urinary = includes(`${symptoms} ${diagnoses}`, ["배뇨", "소변", "빈뇨", "야뇨", "전립선"]) ? 1 : 0;
  const menopause = /^(n|no|아니오)$/.test(s(r, "월경여부")) || includes(s(r, "월경여부"), ["폐경"]);
  const benignBreast = yes(s(r, "과거 유방 양성 진단"));
  const TMlung = cap(T(n(r, "cea"), 2.5, 5, 10) + T(n(r, "cyfra21_1"), 2, 3.5, 6));
  const TMliver = cap(T(n(r, "afp"), 5, 10, 20) + I(liverDisease));
  const TMcolon = cap(T(n(r, "cea"), 2.5, 5, 10) + I(weightLoss) + I(HEM >= 1) + I(gi));
  const TMstomach = cap(T(n(r, "pg2"), 12, 20, 35) + T(n(r, "cea"), 2.5, 5, 10) + I(weightLoss) + I(gi));
  const TMprostate = cap(T(n(r, "tpsa"), 2.5, 4, 10) + I(n(r, "psa_ratio") < 25) + I(n(r, "psa_ratio") < 15) + fh(["전립선"]));
  const TMbreast = cap(T(n(r, "ca15_3"), 20, 30, 50) + T(n(r, "cea"), 2.5, 5, 10) + fh(["유방"]) + I(benignBreast));
  const TMpancreas = cap(T(n(r, "ca19_9"), 20, 37, 100) + T(n(r, "cea"), 2.5, 5, 10) + I(weightLoss) + I(finite(hba1c) && hba1c >= 6.5));
  const TMovary = cap(T(n(r, "ca125"), 20, 35, 70) + T(n(r, "he4"), 60, 90, 150) + fh(["난소"]) + I(menopause));
  const make = (key: string, label: string, group: ScoreResult["group"], score: number | null, formula: string, applicable = true): ScoreResult => {
    const [stage, primaryModel, holdoutExact, holdoutWithin1] = PERF[key];
    return { key, label, group, score: applicable ? score : null, applicable, formula, primaryModel, holdoutExact, holdoutWithin1, stage };
  };
  const scores = [
    make("lung", "폐암", "8대 암", q(.15, .05, 13, A + 1.4*S + 1.3*TMlung + .4*INF + fh(["폐"])), "Q.05(.15,13,A+1.4S+1.3TMlung+0.4INF+FH)"),
    make("liverCancer", "간암", "8대 암", q(.15, .05, 13, .9*A + LIV + TMliver + .3*INF + fh(["간암"])), "Q.05(.15,13,0.9A+LIV+TMliver+0.3INF+FH)"),
    make("colon", "대장암", "8대 암", q(.15, .05, 13, A + 1.4*TMcolon + .4*INF + 1.5*fh(["대장", "결장", "직장"])), "Q.05(.15,13,A+1.4TMcolon+0.4INF+1.5FH)"),
    make("stomach", "위암", "8대 암", q(.20, .05, 10, .8*A + 1.5*TMstomach + .4*HEM + fh(["위암"])), "Q.05(.20,10,0.8A+1.5TMstomach+0.4HEM+FH)"),
    make("prostate", "전립선암", "8대 암", q(.10, .05, 14, A + 1.5*TMprostate + .5*urinary), "Q.05(.10,14,A+1.5TMprostate+0.5Urinary)", sex === "M"),
    make("breast", "유방암", "8대 암", q(.15, .05, 13, .8*A + 1.5*TMbreast + .4*M), "Q.05(.15,13,0.8A+1.5TMbreast+0.4M)", sex === "F"),
    make("pancreas", "췌장암", "8대 암", q(.10, .05, 14, .8*A + 1.6*TMpancreas + .5*S + .4*M + fh(["췌장"])), "Q.05(.10,14,0.8A+1.6TMpancreas+0.5S+0.4M+FH)"),
    make("ovary", "난소암", "8대 암", q(.20, .05, 10, .7*A + 1.2*TMovary + .3*INF), "Q.05(.20,10,0.7A+1.2TMovary+0.3INF)", sex === "F"),
    make("immune", "면역·염증", "8대 만성질환", q(.20, .10, 5, INF), "Q.10(.20,5,INF)"),
    make("cardio", "심혈관", "8대 만성질환", q(.20, .10, 6, (A+S+M+LIP+INF)/3), "Q.10(.20,6,(A+S+M+LIP+INF)/3)"),
    make("diabetes", "당뇨", "8대 만성질환", q(.10, .10, 6, GLY + .25*M + .15*A), "Q.10(.10,6,GLY+0.25M+0.15A)"),
    make("lipid", "고지혈증", "8대 만성질환", q(.20, .10, 7, LIP + .25*M), "Q.10(.20,7,LIP+0.25M)"),
    make("thyroid", "갑상선기능", "8대 만성질환", q(.10, .10, 6, THY), "Q.10(.10,6,THY)"),
    make("liverFunction", "간기능", "8대 만성질환", q(.10, .10, 7, LIV + .3*INF), "Q.10(.10,7,LIV+0.3INF)"),
    make("kidney", "신장기능", "8대 만성질환", q(.10, .10, 8, KID + .4*A + .3*M), "Q.10(.10,8,KID+0.4A+0.3M)"),
    make("blood", "혈액이상", "8대 만성질환", q(.10, .10, 6, HEM + .3*INF), "Q.10(.10,6,HEM+0.3INF)"),
  ];
  const warnings: string[] = [];
  if (!sex) warnings.push("성별이 M/F로 확인되지 않아 성별 제한 Score를 NA 처리했습니다.");
  if (!finite(age)) warnings.push("나이가 비어 있어 연령 단계 A를 0으로 계산했습니다.");
  const components: Components = { A, S, M, INF, LIV, LIP, KID, HEM, GLY, THY, TMlung, TMliver, TMcolon, TMstomach, TMprostate, TMbreast, TMpancreas, TMovary, lowHdl, creatinineHigh };
  return { scores, components, warnings };
}

export const cleanInputs = (input: InputRecord): InputRecord => {
  const out: InputRecord = {};
  for (const [name, , type] of X80_FIELDS) {
    const value = input[name];
    if (value === "" || value === null || value === undefined) { out[name] = ""; continue; }
    if (type === "numeric") {
      let parsed = n(input, name);
      if ((name === "BMI (체질량 지수)" && parsed === 0) || (name === "ldl_chol" && parsed < 0) || (["rdw"].includes(name) && parsed <= 0) || (["pct","mpv","pdw"].includes(name) && parsed < 0) || (name === "mch" && parsed > 100)) parsed = Number.NaN;
      out[name] = finite(parsed) ? parsed : "";
    } else out[name] = String(value).trim();
  }
  return out;
};

export const completionRate = (r: InputRecord) => X80_FIELDS.filter(([name]) => r[name] !== "" && r[name] !== null && r[name] !== undefined).length / 80;
