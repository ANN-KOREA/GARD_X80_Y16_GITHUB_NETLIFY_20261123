import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const publicRoot = resolve(process.argv[2] || fileURLToPath(new URL('../public', import.meta.url)));
const readAsset = async (url) => {
  const path = resolve(publicRoot, '.' + url);
  assert.ok(path.startsWith(publicRoot + sep), 'Asset path must remain in public directory');
  return readFile(path);
};
const registry = JSON.parse(await readAsset('/models/registry.json'));
assert.equal(registry.targets.length, 16);
assert.equal(new Set(registry.targets.map(t => t.key)).size, 16);
for (const target of registry.targets) {
  const metadata = JSON.parse(await readAsset(target.metadataUrl));
  const bytes = await readAsset(target.forestUrl);
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, target.portableSha256, `${target.key}: registry SHA256`);
  assert.equal(hash, metadata.forest.sha256, `${target.key}: metadata SHA256`);
  assert.equal(bytes.length, metadata.forest.bytes, `${target.key}: binary bytes`);
  assert.equal(bytes.subarray(0, 8).toString(), 'X80Y16M1');
  assert.equal(metadata.key, target.key);
  assert.equal(metadata.stage, target.stage);
  assert.equal(metadata.forest.url, target.forestUrl);
  assert.ok((await stat(resolve(publicRoot, '.' + target.forestUrl))).size < 25 * 1024 * 1024);
  console.log(`PASS Stage ${target.stage}: ${target.label} | ${bytes.length} bytes | ${hash}`);
}
console.log('PASS: 16/16 portable model assets verified. This does not reverify original training archives.');
