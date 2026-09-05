import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('release artifact cashpilot.zip is absent from the working tree', () => {
  const legacyArchive = join(root, 'files', 'cashpilot.zip');

  assert.equal(
    existsSync(legacyArchive),
    false,
    'Release guard failed: files/cashpilot.zip must remain absent from the working tree.',
  );
});

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

for (const purpose of ['any', 'maskable']) {
  for (const size of [192, 512]) {
    test(`PWA ${purpose} icon is a real ${size}x${size} PNG`, () => {
      const icon = manifest.icons.find(item =>
        item.purpose === purpose && item.sizes === `${size}x${size}`,
      );
      assert.ok(icon, `Manifest must declare a ${size}x${size} ${purpose} icon`);
      assert.equal(icon.type, 'image/png');
      const png = readFileSync(join(root, icon.src));
      assert.ok(png.length >= 33, `${icon.src}: PNG header is incomplete`);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(png.readUInt32BE(8), 13);
      assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR');
      assert.equal(png.readUInt32BE(16), size, `${icon.src}: width differs from manifest`);
      assert.equal(png.readUInt32BE(20), size, `${icon.src}: height differs from manifest`);
    });
  }
}
