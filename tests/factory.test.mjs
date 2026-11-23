import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const importTS = async (relative) => {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
};
const engine = await importTS('../lib/score-engine.ts');
const runtime = await importTS('../lib/ml-runtime.ts');

// Read the real deployed binary assets without a network service.
globalThis.fetch = async (url) => {
  const pathname = new URL(String(url), 'http://factory.test').pathname;
  assert.match(pathname, /^\/models\/(registry\.json|stage\d+\.(json|bin))$/);
  try { return new Response(await readFile(new URL('../public' + pathname, import.meta.url))); }
  catch { return new Response('Not found', { status: 404 }); }
};

test('80 unique fields, 16 outputs, quality gates and leakage exclusion', () => {
  assert.equal(engine.X80_FIELDS.length, 80);
  assert.equal(new Set(engine.X80_FIELDS.map(([name]) => name)).size, 80);
  const clean = engine.cleanInputs({ ...engine.LOW_SAMPLE, 'BMI (체질량 지수)': 0, ldl_chol: -1, lung_Score: .99 });
  assert.equal(clean['BMI (체질량 지수)'], '');
  assert.equal(clean.ldl_chol, '');
  assert.equal(clean.lung_Score, undefined);
  const result = engine.calculateScores(clean);
  assert.equal(result.scores.length, 16);
  assert.equal(engine.buildM0Observations(result.scores, result.components).length, 16);
});

test('all 16 frozen models reproduce their original embedded smoke expectations', async () => {
  const results = await runtime.runPortableSmokeTests();
  assert.equal(results.length, 16);
  for (const item of results) assert.equal(item.actual, item.expected, `${item.stage}: ${item.label}`);
});

test('three samples produce 16 scores with structural sex exclusions', async () => {
  for (const sample of engine.SAMPLE_CASES) {
    const input = engine.cleanInputs(sample.values);
    const scores = await runtime.scoreAllML(input);
    assert.equal(scores.length, 16);
    for (const score of scores) {
      if (score.applicable) assert.ok(engine.SCORE_GRIDS[score.key].includes(score.score));
      else assert.equal(score.score, null);
    }
  }
  for (const sex of ['M', 'F', '']) {
    const scores = await runtime.scoreAllML({ ...engine.LOW_SAMPLE, '성별': sex });
    assert.equal(scores.find(s => s.key === 'prostate').applicable, sex === 'M');
    assert.equal(scores.find(s => s.key === 'breast').applicable, sex === 'F');
    assert.equal(scores.find(s => s.key === 'ovary').applicable, sex === 'F');
  }
});

test('comparison uses score grid steps', () => {
  assert.equal(engine.compareWithM0('lipid', .3, .3, true).status, '정확 일치');
  assert.equal(engine.compareWithM0('lipid', .4, .3, true).status, '인접 1단계');
  assert.equal(engine.compareWithM0('lipid', .6, .3, true).status, '2단계 이상 차이');
});
