import type { InputRecord } from "./score-engine";

export type PortableRegistryEntry = {
  key: string;
  label: string;
  stage: number;
  architecture: string;
  eligibleSex: "all" | "M" | "F";
  trainingN: number;
  metadataUrl: string;
  forestUrl: string;
  portableSha256: string;
  sourceBundleSha256: string;
  smokeExpected: number | null;
  historicalExact: number;
  historicalWithin1: number;
};

export type PortableRegistry = {
  version: string;
  createdFrom: string;
  canonicalDataSha256: string;
  embeddedMasterSha256: string;
  actualArchiveSha256: string;
  embeddedMasterMatches: boolean;
  targets: PortableRegistryEntry[];
};

type Preprocessor = {
  numeric: Array<{ name: string; median: number }>;
  categorical: Array<{ name: string; fill: string; mapping: Record<string, number> }>;
  outputSize: number;
};

type TargetMetadata = {
  key: string;
  label: string;
  target: string;
  stage: number;
  architecture: string;
  eligibleSex: "all" | "M" | "F";
  trainingN: number;
  scoreGrid: number[];
  historical: { mae: number; r2: number; spearman: number; exact: number; within1: number; qwk: number };
  sourceStatus: string;
  sourceBundleSha256: string;
  preprocessor: Preprocessor;
  forest: {
    format: string;
    kind: "regressor" | "classifier";
    classes: string[];
    trees: number;
    nodes: number;
    leaves: number;
    bytes: number;
    sha256: string;
    url: string;
  };
  smoke: { input: InputRecord; expected: number | null };
};

type LoadedForest = {
  classifier: boolean;
  classCount: number;
  treeCount: number;
  nodeCount: number;
  treeOffsets: Uint32Array;
  rightChildren: Int32Array;
  features: Int8Array;
  thresholds: Float32Array;
  leafValues: Float32Array;
};

type LoadedTarget = { metadata: TargetMetadata; forest: LoadedForest };

export type MlScore = {
  key: string;
  label: string;
  stage: number;
  score: number | null;
  raw: number | null;
  applicable: boolean;
  architecture: string;
  trainingN: number;
  modelSha256: string;
  historicalExact: number;
  historicalWithin1: number;
};

export type LoadProgress = { completed: number; total: number; label: string };

let assetOrigin = "";
let registryPromise: Promise<PortableRegistry> | null = null;
const targetCache = new Map<string, Promise<LoadedTarget>>();

export function setModelAssetOrigin(origin: string) {
  assetOrigin = origin.replace(/\/$/, "");
  registryPromise = null;
  targetCache.clear();
}

const assetUrl = (path: string) => `${assetOrigin}${path}`;

export async function loadRegistry(): Promise<PortableRegistry> {
  if (!registryPromise) {
    registryPromise = fetch(assetUrl("/models/registry.json"), { cache: "force-cache" }).then(async (response) => {
      if (!response.ok) throw new Error(`모델 레지스트리를 불러오지 못했습니다 (${response.status}).`);
      const registry = await response.json() as PortableRegistry;
      if (registry.targets.length !== 16) throw new Error("16개 모델 레지스트리가 완전하지 않습니다.");
      return registry;
    });
  }
  return registryPromise;
}

function parseForest(buffer: ArrayBuffer): LoadedForest {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 8));
  if (magic !== "X80Y16M1") throw new Error("지원하지 않는 모델 포맷입니다.");
  const classifier = view.getUint8(8) === 1;
  const classCount = view.getUint8(9);
  const treeCount = view.getUint16(10, true);
  const nodeCount = view.getUint32(12, true);
  let offset = 16;
  const treeOffsets = new Uint32Array(buffer, offset, treeCount + 1); offset += (treeCount + 1) * 4;
  const rightChildren = new Int32Array(buffer, offset, nodeCount); offset += nodeCount * 4;
  const features = new Int8Array(buffer, offset, nodeCount); offset += nodeCount;
  offset += (4 - (nodeCount % 4)) % 4;
  const thresholds = new Float32Array(buffer, offset, nodeCount); offset += nodeCount * 4;
  const leafValues = new Float32Array(buffer, offset);
  return { classifier, classCount, treeCount, nodeCount, treeOffsets, rightChildren, features, thresholds, leafValues };
}

async function loadTarget(entry: PortableRegistryEntry): Promise<LoadedTarget> {
  let promise = targetCache.get(entry.key);
  if (!promise) {
    promise = (async () => {
      const [metadataResponse, forestResponse] = await Promise.all([
        fetch(assetUrl(entry.metadataUrl), { cache: "force-cache" }),
        fetch(assetUrl(entry.forestUrl), { cache: "force-cache" }),
      ]);
      if (!metadataResponse.ok || !forestResponse.ok) throw new Error(`${entry.label} frozen model을 불러오지 못했습니다.`);
      const metadata = await metadataResponse.json() as TargetMetadata;
      const forest = parseForest(await forestResponse.arrayBuffer());
      if (metadata.key !== entry.key || forest.treeCount !== metadata.forest.trees || forest.nodeCount !== metadata.forest.nodes) {
        throw new Error(`${entry.label} 모델 계약이 일치하지 않습니다.`);
      }
      return { metadata, forest };
    })();
    targetCache.set(entry.key, promise);
  }
  return promise;
}

const missing = (value: unknown) => value === null || value === undefined || value === "" || (typeof value === "number" && !Number.isFinite(value));

function preprocess(input: InputRecord, contract: Preprocessor): Float64Array {
  const transformed = new Float64Array(contract.outputSize);
  let cursor = 0;
  for (const column of contract.numeric) {
    const value = input[column.name];
    const numeric = missing(value) ? column.median : Number(value);
    transformed[cursor++] = Number.isFinite(numeric) ? numeric : column.median;
  }
  for (const column of contract.categorical) {
    const value = missing(input[column.name]) ? column.fill : String(input[column.name]);
    transformed[cursor++] = Object.prototype.hasOwnProperty.call(column.mapping, value) ? column.mapping[value] : -1;
  }
  return transformed;
}

function predictForest(forest: LoadedForest, features: Float64Array): { raw: number; classIndex?: number } {
  if (forest.classifier) {
    const probabilities = new Float64Array(forest.classCount);
    for (let tree = 0; tree < forest.treeCount; tree++) {
      let node = forest.treeOffsets[tree];
      while (forest.features[node] >= 0) {
        node = features[forest.features[node]] <= forest.thresholds[node] ? node + 1 : forest.rightChildren[node];
      }
      const leaf = -forest.rightChildren[node] - 1;
      const start = leaf * forest.classCount;
      for (let classIndex = 0; classIndex < forest.classCount; classIndex++) probabilities[classIndex] += forest.leafValues[start + classIndex];
    }
    let best = 0;
    for (let classIndex = 1; classIndex < probabilities.length; classIndex++) if (probabilities[classIndex] > probabilities[best]) best = classIndex;
    return { raw: probabilities[best] / forest.treeCount, classIndex: best };
  }
  let sum = 0;
  for (let tree = 0; tree < forest.treeCount; tree++) {
    let node = forest.treeOffsets[tree];
    while (forest.features[node] >= 0) {
      node = features[forest.features[node]] <= forest.thresholds[node] ? node + 1 : forest.rightChildren[node];
    }
    sum += forest.leafValues[-forest.rightChildren[node] - 1];
  }
  return { raw: sum / forest.treeCount };
}

function quantize(raw: number, grid: number[]): number {
  let best = grid[0], distance = Math.abs(raw - grid[0]);
  for (let index = 1; index < grid.length; index++) {
    const candidate = Math.abs(raw - grid[index]);
    if (candidate < distance) { best = grid[index]; distance = candidate; }
  }
  return best;
}

function thyroidRule(input: InputRecord): number {
  const tshValue = Number(input.tsh);
  const tsh = Number.isFinite(tshValue) ? tshValue : Number.NaN;
  const symptoms = String(input["불편한증상"] ?? "");
  const medication = String(input["현재 복용중인 약 "] ?? "");
  const symptomTerms = ["갑상선","두근거림","손떨림","손 떨림","추위","더위","심한 피로","목 부위","목부위","체중증가","체중 증가","체중감소","체중 감소"];
  const medicationTerms = ["갑상선","씬지로이드","레보티록신","메티마졸","프로필티오우라실"];
  const rule = Math.min(4,
    Number(Number.isFinite(tsh) && (tsh < .4 || tsh > 4.5)) +
    Number(Number.isFinite(tsh) && (tsh < .1 || tsh > 10)) +
    Number(symptomTerms.some((term) => symptoms.includes(term))) +
    Number(medicationTerms.some((term) => medication.includes(term)))
  );
  return Number((.1 + .1 * Math.min(6, Math.max(0, Math.floor(rule + .5)))).toFixed(10));
}

function eligible(input: InputRecord, required: "all" | "M" | "F"): boolean {
  if (required === "all") return true;
  return String(input["성별"] ?? "").trim().toUpperCase() === required;
}

async function scoreTarget(input: InputRecord, entry: PortableRegistryEntry): Promise<MlScore> {
  const loaded = await loadTarget(entry);
  const applicable = eligible(input, loaded.metadata.eligibleSex);
  if (!applicable) {
    return { key: entry.key, label: entry.label, stage: entry.stage, score: null, raw: null, applicable: false, architecture: entry.architecture, trainingN: entry.trainingN, modelSha256: entry.sourceBundleSha256, historicalExact: entry.historicalExact, historicalWithin1: entry.historicalWithin1 };
  }
  const features = preprocess(input, loaded.metadata.preprocessor);
  const prediction = predictForest(loaded.forest, features);
  let raw: number;
  let score: number;
  if (loaded.metadata.architecture === "M5_ExtraTreesClassifier") {
    score = Number(loaded.metadata.forest.classes[prediction.classIndex ?? 0]);
    raw = score;
  } else if (loaded.metadata.architecture === "M4_RulePlusResidualExtraTrees") {
    raw = thyroidRule(input) + prediction.raw;
    score = quantize(raw, loaded.metadata.scoreGrid);
  } else {
    raw = prediction.raw;
    score = quantize(raw, loaded.metadata.scoreGrid);
  }
  return { key: entry.key, label: entry.label, stage: entry.stage, score, raw, applicable: true, architecture: entry.architecture, trainingN: entry.trainingN, modelSha256: entry.sourceBundleSha256, historicalExact: entry.historicalExact, historicalWithin1: entry.historicalWithin1 };
}

export async function scoreAllML(input: InputRecord, onProgress?: (progress: LoadProgress) => void): Promise<MlScore[]> {
  const registry = await loadRegistry();
  const results = new Array<MlScore>(registry.targets.length);
  let nextIndex = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= registry.targets.length) return;
      const entry = registry.targets[index];
      results[index] = await scoreTarget(input, entry);
      completed += 1;
      onProgress?.({ completed, total: registry.targets.length, label: entry.label });
    }
  };
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  return results.sort((a, b) => a.stage - b.stage);
}

export async function runPortableSmokeTests(onProgress?: (progress: LoadProgress) => void): Promise<Array<{ stage: number; label: string; expected: number | null; actual: number | null; passed: boolean }>> {
  const registry = await loadRegistry();
  const results = [];
  let completed = 0;
  for (const entry of registry.targets) {
    const loaded = await loadTarget(entry);
    const actual = (await scoreTarget(loaded.metadata.smoke.input, entry)).score;
    const expected = loaded.metadata.smoke.expected;
    results.push({ stage: entry.stage, label: entry.label, expected, actual, passed: expected === actual });
    completed += 1;
    onProgress?.({ completed, total: registry.targets.length, label: entry.label });
  }
  return results;
}
