import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper reproduction for isolated testing of rubric & placement logic
const cefrOrder = ['A1', 'A2', 'B1', 'B2'];

const cefrFromCorrect = (correct, total) => {
  if (total <= 15) {
    if (correct >= 13) return 'B2';
    if (correct >= 9) return 'B1';
    if (correct >= 6) return 'A2';
    return 'A1';
  }
  if (total <= 18) {
    if (correct >= 15) return 'B2';
    if (correct >= 11) return 'B1';
    if (correct >= 7) return 'A2';
    return 'A1';
  }
  if (correct >= 16) return 'B2';
  if (correct >= 12) return 'B1';
  if (correct >= 8) return 'A2';
  return 'A1';
};

const computeFinalPlacement = (sectionScores) => {
  const levels = Object.values(sectionScores).filter((v) => cefrOrder.includes(v));
  if (levels.length < 3) return null;
  const count = (l) => levels.filter((v) => v === l).length;
  const writingLevel = sectionScores.Writing || null;
  const speakingLevel = sectionScores.Speaking || null;
  if (count('B2') >= 3 && cefrOrder.indexOf(writingLevel) >= 2 && cefrOrder.indexOf(speakingLevel) >= 2) return 'B2';
  if (count('B1') + count('B2') >= 3 && cefrOrder.indexOf(writingLevel) >= 1 && cefrOrder.indexOf(speakingLevel) >= 1) return 'B1';
  if (count('A1') >= 3) return 'A1';
  return 'A2';
};

const rubricLevel = (criteria) => {
  const values = Object.values(criteria || {}).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value) || value < 1 || value > 4)) {
    throw new Error('Each rubric criterion must be a whole number from 1 to 4');
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return { criteria, total, level: total <= 6 ? 'A1' : total <= 9 ? 'A2' : total <= 13 ? 'B1' : 'B2' };
};

describe('CEFR Scoring Engine', () => {
  it('correctly maps raw scores to CEFR levels for 20-item sections', () => {
    assert.equal(cefrFromCorrect(18, 20), 'B2');
    assert.equal(cefrFromCorrect(16, 20), 'B2');
    assert.equal(cefrFromCorrect(14, 20), 'B1');
    assert.equal(cefrFromCorrect(10, 20), 'A2');
    assert.equal(cefrFromCorrect(5, 20), 'A1');
  });

  it('correctly maps raw scores to CEFR levels for 15-item sections (Listening & Reading)', () => {
    assert.equal(cefrFromCorrect(14, 15), 'B2');
    assert.equal(cefrFromCorrect(13, 15), 'B2');
    assert.equal(cefrFromCorrect(11, 15), 'B1');
    assert.equal(cefrFromCorrect(7, 15), 'A2');
    assert.equal(cefrFromCorrect(3, 15), 'A1');
  });

  it('validates 4-criteria rubric calculations correctly', () => {
    const b2Result = rubricLevel({ taskAchievement: 4, organization: 4, lexicalResource: 4, grammaticalRangeAccuracy: 4 });
    assert.equal(b2Result.total, 16);
    assert.equal(b2Result.level, 'B2');

    const b1Result = rubricLevel({ taskAchievement: 3, organization: 3, lexicalResource: 3, grammaticalRangeAccuracy: 3 });
    assert.equal(b1Result.total, 12);
    assert.equal(b1Result.level, 'B1');

    const a2Result = rubricLevel({ fluency: 2, vocabulary: 2, grammar: 2, communication: 2 });
    assert.equal(a2Result.total, 8);
    assert.equal(a2Result.level, 'A2');

    const a1Result = rubricLevel({ fluency: 1, vocabulary: 1, grammar: 1, communication: 2 });
    assert.equal(a1Result.total, 5);
    assert.equal(a1Result.level, 'A1');
  });

  it('rejects invalid rubric values', () => {
    assert.throws(() => rubricLevel({ a: 0, b: 2, c: 3, d: 4 }));
    assert.throws(() => rubricLevel({ a: 5, b: 2, c: 3, d: 4 }));
    assert.throws(() => rubricLevel({ a: 2, b: 2, c: 2 }));
  });

  it('computes overall composite CEFR placement accurately', () => {
    const highScores = {
      'Grammar & Vocabulary': 'B2',
      Reading: 'B2',
      Listening: 'B2',
      Writing: 'B2',
      Speaking: 'B2'
    };
    assert.equal(computeFinalPlacement(highScores), 'B2');

    const intermediateScores = {
      'Grammar & Vocabulary': 'B1',
      Reading: 'B2',
      Listening: 'B1',
      Writing: 'B1',
      Speaking: 'B1'
    };
    assert.equal(computeFinalPlacement(intermediateScores), 'B1');
  });
});
