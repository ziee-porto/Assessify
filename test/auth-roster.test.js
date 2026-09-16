import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('Teacher Roster & Unit Authentication Engine', () => {
  it('loads and validates all official teachers across KB-TK, SD, SMP, SMA, and SMK', async () => {
    const raw = await readFile(join(root, 'content', 'authorized-teachers.json'), 'utf8');
    const roster = JSON.parse(raw);
    assert.ok(roster.length >= 50, 'Should have at least 50 registered teachers');

    const kbtkCount = roster.filter(t => t.unit === 'KB-TK GOLDEN BEE').length;
    const sdCount = roster.filter(t => t.unit === 'SD KARYA BANGSA').length;
    const smpCount = roster.filter(t => t.unit === 'SMP KARYA BANGSA').length;
    const smaCount = roster.filter(t => t.unit === 'SMA KARYA BANGSA').length;
    const smkCount = roster.filter(t => t.unit === 'SMK KARYA BANGSA').length;

    assert.ok(kbtkCount >= 10, 'KB-TK should have at least 10 teachers');
    assert.ok(sdCount >= 10, 'SD should have at least 10 teachers');
    assert.ok(smpCount >= 9, 'SMP should have at least 9 teachers');
    assert.ok(smaCount >= 10, 'SMA should have at least 10 teachers');
    assert.ok(smkCount >= 11, 'SMK should have at least 11 teachers');

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
