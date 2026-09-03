import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper reproduction for isolated testing of rubric & placement logic
const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const cefrFromCorrect = (correct, total, activeRubrics = null) => {
  // 1. Dynamic Score Mapping from active rubrics (e.g. { score: "47 – 50 points", level: "C2 (Higher Level Series Recommended)" })
  const scoreMapping = activeRubrics?.grammarVocabulary?.scoreMapping;
  if (Array.isArray(scoreMapping) && scoreMapping.length > 0) {
    for (const item of scoreMapping) {
      const levelMatch = String(item.level || '').match(/\b(C2|C1|B2|B1|A2|A1)\b/i);
      const scoreStr = String(item.score || '');
      const rangeMatch = scoreStr.match(/(\d+)\s*[-–—]\s*(\d+)/);
      if (levelMatch && rangeMatch) {
        const min = Number(rangeMatch[1]);
        const max = Number(rangeMatch[2]);
        if (correct >= min && correct <= max) {
          return levelMatch[1].toUpperCase();
        }
      }
    }
  }

  // 2. Dynamic Thresholds string from active rubrics
  const thresholds = activeRubrics?.grammarVocabulary?.thresholds;
  if (typeof thresholds === 'string' && thresholds.trim()) {
    const parts = thresholds.split('|');
    for (const part of parts) {
      const levelMatch = part.match(/\b(C2|C1|B2|B1|A2|A1)\b/i);
      const rangeMatch = part.match(/(\d+)\s*[-–—]\s*(\d+)/);
      if (levelMatch && rangeMatch) {
        const min = Number(rangeMatch[1]);
        const max = Number(rangeMatch[2]);
        if (correct >= min && correct <= max) {
          return levelMatch[1].toUpperCase();
        }
      }
    }
  }

  // 3. Scale-level detection: check if active rubric supports C2
  const isScaleUpToC2 = Boolean(
    activeRubrics?.bandScale?.range?.includes('C2') ||
    activeRubrics?.grammarVocabulary?.thresholds?.includes('C2') ||
    activeRubrics?.writing?.levels?.some((l) => l.level === 'C2') ||
    (Array.isArray(activeRubrics?.grammarVocabulary?.scoreMapping) &&
      activeRubrics.grammarVocabulary.scoreMapping.some((m) => String(m.level || '').includes('C2')))
  );

  if (isScaleUpToC2) {
    if (total >= 45 || total === 50) {
      if (correct >= 47) return 'C2';
      if (correct >= 40) return 'C1';
      if (correct >= 33) return 'B2';
      if (correct >= 26) return 'B1';
      if (correct >= 19) return 'A2';
      return 'A1';
    }
    if (total <= 15) {
      if (correct >= 15) return 'C2';
      if (correct >= 13) return 'C1';
      if (correct >= 11) return 'B2';
      if (correct >= 8) return 'B1';
      if (correct >= 5) return 'A2';
      return 'A1';
    }
    if (total <= 20) {
      if (correct >= 19) return 'C2';
      if (correct >= 16) return 'C1';
      if (correct >= 13) return 'B2';
      if (correct >= 10) return 'B1';
      if (correct >= 7) return 'A2';
      return 'A1';
    }
    const ratio = total > 0 ? correct / total : 0;
    if (ratio >= 0.94) return 'C2';
    if (ratio >= 0.80) return 'C1';
    if (ratio >= 0.66) return 'B2';
    if (ratio >= 0.52) return 'B1';
    if (ratio >= 0.38) return 'A2';
    return 'A1';
  }

  // 4. Fallback when C2 is not enabled (up to C1)
  if (total >= 45 || total === 50) {
    if (correct >= 45) return 'C1';
    if (correct >= 37) return 'B2';
    if (correct >= 28) return 'B1';
    if (correct >= 18) return 'A2';
    return 'A1';
  }
  if (total <= 15) {
    if (correct >= 15) return 'C1';
    if (correct >= 12) return 'B2';
    if (correct >= 9) return 'B1';
    if (correct >= 6) return 'A2';
    return 'A1';
  }
  if (total <= 18) {
    if (correct >= 18) return 'C1';
    if (correct >= 15) return 'B2';
    if (correct >= 11) return 'B1';
    if (correct >= 7) return 'A2';
    return 'A1';
  }
  if (correct >= 19) return 'C1';
  if (correct >= 16) return 'B2';
  if (correct >= 12) return 'B1';
  if (correct >= 8) return 'A2';
  return 'A1';
};

const computeFinalPlacement = (sectionScores) => {
  const levels = Object.values(sectionScores).filter((v) => cefrOrder.includes(v));
  if (levels.length === 0) return null;
  const count = (l) => levels.filter((v) => v === l).length;
  const grammarLevel = sectionScores['Grammar & Vocabulary'] || null;

  if (levels.length >= 3) {
    if (count('C2') >= 2) return 'C2';
    if ((count('C2') + count('C1')) >= 2 && cefrOrder.indexOf(grammarLevel) >= 3) return count('C2') >= 2 ? 'C2' : 'C1';
    if (count('C1') >= 2 && cefrOrder.indexOf(grammarLevel) >= 3) return 'C1';
    if ((count('C2') + count('C1') + count('B2')) >= 2 && cefrOrder.indexOf(grammarLevel) >= 2) return 'B2';
    if ((count('B1') + count('B2') + count('C1') + count('C2')) >= 2 && cefrOrder.indexOf(grammarLevel) >= 1) return 'B1';
    if (count('A1') >= 2) return 'A1';
    return 'A2';
  }
  if (grammarLevel) return grammarLevel;
  return levels[0] || null;
};

const rubricLevel = (criteria, isC2 = false) => {
  const values = Object.values(criteria || {}).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value) || value < 1 || value > (isC2 ? 6 : 5))) {
    throw new Error(`Each rubric criterion must be a whole number from 1 to ${isC2 ? 6 : 5}`);
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  const avg = total / 4;
  if (isC2) {
    return {
      criteria,
      total,
      level: avg >= 5.5 ? 'C2' : avg >= 4.5 ? 'C1' : avg >= 3.5 ? 'B2' : avg >= 2.5 ? 'B1' : avg >= 1.5 ? 'A2' : 'A1'
    };
  }
  return { criteria, total, level: total <= 6 ? 'A1' : total <= 9 ? 'A2' : total <= 13 ? 'B1' : total <= 17 ? 'B2' : 'C1' };
};

describe('CEFR Scoring Engine', () => {
  it('correctly maps raw scores to CEFR levels for 50-item Grammar & Vocabulary section up to C1', () => {
    assert.equal(cefrFromCorrect(50, 50), 'C1');
    assert.equal(cefrFromCorrect(46, 50), 'C1');
    assert.equal(cefrFromCorrect(45, 50), 'C1');
    assert.equal(cefrFromCorrect(44, 50), 'B2');
    assert.equal(cefrFromCorrect(37, 50), 'B2');
    assert.equal(cefrFromCorrect(36, 50), 'B1');
    assert.equal(cefrFromCorrect(28, 50), 'B1');
    assert.equal(cefrFromCorrect(27, 50), 'A2');
    assert.equal(cefrFromCorrect(18, 50), 'A2');
    assert.equal(cefrFromCorrect(17, 50), 'A1');
    assert.equal(cefrFromCorrect(5, 50), 'A1');
  });

  it('correctly maps raw scores to CEFR levels for 20-item sections up to C1', () => {
    assert.equal(cefrFromCorrect(20, 20), 'C1');
    assert.equal(cefrFromCorrect(19, 20), 'C1');
    assert.equal(cefrFromCorrect(18, 20), 'B2');
    assert.equal(cefrFromCorrect(16, 20), 'B2');
    assert.equal(cefrFromCorrect(14, 20), 'B1');
    assert.equal(cefrFromCorrect(10, 20), 'A2');
    assert.equal(cefrFromCorrect(5, 20), 'A1');
  });

  it('correctly maps raw scores to CEFR levels for 15-item sections up to C1', () => {
    assert.equal(cefrFromCorrect(15, 15), 'C1');
    assert.equal(cefrFromCorrect(14, 15), 'B2');
    assert.equal(cefrFromCorrect(12, 15), 'B2');
    assert.equal(cefrFromCorrect(10, 15), 'B1');
    assert.equal(cefrFromCorrect(7, 15), 'A2');
    assert.equal(cefrFromCorrect(3, 15), 'A1');
  });

  it('validates 4-criteria rubric calculations correctly up to C1', () => {
    const c1Result = rubricLevel({ taskAchievement: 5, organization: 5, lexicalResource: 4, grammaticalRangeAccuracy: 5 });
    assert.equal(c1Result.total, 19);
    assert.equal(c1Result.level, 'C1');

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
    assert.throws(() => rubricLevel({ a: 6, b: 2, c: 3, d: 4 }));
    assert.throws(() => rubricLevel({ a: 2, b: 2, c: 2 }));
  });

  it('computes composite CEFR placement for 3-skill placement structure', () => {
    const advancedScores = {
      'Grammar & Vocabulary': 'C1',
      Writing: 'C1',
      Speaking: 'B2'
    };
    assert.equal(computeFinalPlacement(advancedScores), 'C1');

    const highScores = {
      'Grammar & Vocabulary': 'B2',
      Writing: 'B2',
      Speaking: 'B2'
    };
    assert.equal(computeFinalPlacement(highScores), 'B2');

    const intermediateScores = {
      'Grammar & Vocabulary': 'B1',
      Writing: 'B1',
      Speaking: 'B1'
    };
    assert.equal(computeFinalPlacement(intermediateScores), 'B1');

    const elementaryScores = {
      'Grammar & Vocabulary': 'A2',
      Writing: 'A2',
      Speaking: 'A1'
    };
    assert.equal(computeFinalPlacement(elementaryScores), 'A2');

    const beginnerScores = {
      'Grammar & Vocabulary': 'A1',
      Writing: 'A1',
      Speaking: 'A1'
    };
    assert.equal(computeFinalPlacement(beginnerScores), 'A1');
  });

  it('correctly maps raw scores using active uploaded rubric with A1–C2 range and scoreMapping', () => {
    const uploadedRubric = {
      bandScale: { range: 'A1–C2' },
      grammarVocabulary: {
        thresholds: 'A1: 0–18 | A2: 19–25 | B1: 26–32 | B2: 33–39 | C1: 40–46 | C2: 47–50',
        scoreMapping: [
          { score: '0 – 18 points', level: 'A1 (Elementary)' },
          { score: '19 – 25 points', level: 'A2 (Pre-Intermediate)' },
          { score: '26 – 32 points', level: 'B1 (Intermediate)' },
          { score: '33 – 39 points', level: 'B2 (Upper Intermediate)' },
          { score: '40 – 46 points', level: 'C1 (Advanced)' },
          { score: '47 – 50 points', level: 'C2 (Higher Level Series Recommended)' }
        ]
      }
    };

    // 50/50 correct must be C2
    assert.equal(cefrFromCorrect(50, 50, uploadedRubric), 'C2');
    assert.equal(cefrFromCorrect(48, 50, uploadedRubric), 'C2');
    assert.equal(cefrFromCorrect(47, 50, uploadedRubric), 'C2');
    assert.equal(cefrFromCorrect(46, 50, uploadedRubric), 'C1');
    assert.equal(cefrFromCorrect(40, 50, uploadedRubric), 'C1');
    assert.equal(cefrFromCorrect(39, 50, uploadedRubric), 'B2');
    assert.equal(cefrFromCorrect(33, 50, uploadedRubric), 'B2');
    assert.equal(cefrFromCorrect(32, 50, uploadedRubric), 'B1');
    assert.equal(cefrFromCorrect(26, 50, uploadedRubric), 'B1');
    assert.equal(cefrFromCorrect(25, 50, uploadedRubric), 'A2');
    assert.equal(cefrFromCorrect(19, 50, uploadedRubric), 'A2');
    assert.equal(cefrFromCorrect(18, 50, uploadedRubric), 'A1');
    assert.equal(cefrFromCorrect(0, 50, uploadedRubric), 'A1');
  });

  it('computes composite C2 placement when candidate excels in multiple skills', () => {
    const masteryScores = {
      'Grammar & Vocabulary': 'C2',
      Writing: 'C2',
      Speaking: 'C1'
    };
    assert.equal(computeFinalPlacement(masteryScores), 'C2');

    const singleSkillScores = {
      'Grammar & Vocabulary': 'C2'
    };
    assert.equal(computeFinalPlacement(singleSkillScores), 'C2');
  });
});
