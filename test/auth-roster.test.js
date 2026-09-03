import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('Teacher Roster & Unit Authentication Engine', () => {
  it('loads and validates all 50 official teachers across KB-TK, SD, SMP, SMA, and SMK', async () => {
    const raw = await readFile(join(root, 'content', 'authorized-teachers.json'), 'utf8');
    const roster = JSON.parse(raw);
    assert.strictEqual(roster.length, 50, 'Should have exactly 50 registered teachers');

    const kbtkCount = roster.filter(t => t.unit === 'KB-TK GOLDEN BEE').length;
    const sdCount = roster.filter(t => t.unit === 'SD KARYA BANGSA').length;
    const smpCount = roster.filter(t => t.unit === 'SMP KARYA BANGSA').length;
    const smaCount = roster.filter(t => t.unit === 'SMA KARYA BANGSA').length;
    const smkCount = roster.filter(t => t.unit === 'SMK KARYA BANGSA').length;

    assert.strictEqual(kbtkCount, 10, 'KB-TK should have 10 teachers');
    assert.strictEqual(sdCount, 10, 'SD should have 10 teachers');
    assert.strictEqual(smpCount, 9, 'SMP should have 9 teachers');
    assert.strictEqual(smaCount, 10, 'SMA should have 10 teachers');
    assert.strictEqual(smkCount, 11, 'SMK should have 11 teachers');

    roster.forEach(t => {
      assert.ok(t.email.endsWith('@karyabangsa.sch.id'), `Email ${t.email} must end with @karyabangsa.sch.id`);
      assert.ok(t.unit, `Teacher ${t.email} must have a unit`);
      assert.ok(t.name, `Teacher ${t.email} must have a name`);
    });
  });

  it('validates correct email and unit match', async () => {
    const raw = await readFile(join(root, 'content', 'authorized-teachers.json'), 'utf8');
    const roster = JSON.parse(raw);

    const testTeacher = roster.find(t => t.email === 'heri.yansyah@karyabangsa.sch.id');
    assert.ok(testTeacher);
    assert.strictEqual(testTeacher.unit, 'SMP KARYA BANGSA');

    // Matching unit passes
    const selectedUnit = 'SMP KARYA BANGSA';
    const isUnitMatch = testTeacher.unit.toLowerCase().trim() === selectedUnit.toLowerCase().trim();
    assert.strictEqual(isUnitMatch, true);
  });

  it('detects and rejects unit mismatch', async () => {
    const raw = await readFile(join(root, 'content', 'authorized-teachers.json'), 'utf8');
    const roster = JSON.parse(raw);

    const testTeacher = roster.find(t => t.email === 'anggra@karyabangsa.sch.id');
    assert.ok(testTeacher);
    assert.strictEqual(testTeacher.unit, 'SMA KARYA BANGSA');

    // Wrong unit (e.g. selecting SMP instead of SMA) fails
    const selectedWrongUnit = 'SMP KARYA BANGSA';
    const isUnitMatch = testTeacher.unit.toLowerCase().trim() === selectedWrongUnit.toLowerCase().trim();
    assert.strictEqual(isUnitMatch, false);
  });

  it('detects and rejects unauthorized emails', async () => {
    const raw = await readFile(join(root, 'content', 'authorized-teachers.json'), 'utf8');
    const roster = JSON.parse(raw);

    const unknownEmail = 'unregistered.teacher@karyabangsa.sch.id';
    const match = roster.find(t => t.email.toLowerCase().trim() === unknownEmail.toLowerCase().trim());
    assert.strictEqual(match, undefined, 'Unregistered email should not be found');
  });
});
