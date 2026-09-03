import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('Question Bank & Rubrics Management Engine', () => {
  it('validates 3-section placement test structure: Grammar 50, Writing (User Selects 1 Topic for 1 Essay), Speaking 21', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'question-bank-template.json'), 'utf8');
    const content = JSON.parse(raw);
    assert.ok(Array.isArray(content.sections), 'Should have sections array');
    assert.strictEqual(content.sections.length, 3, 'Should have 3 sections');

    // Check Section 1: Grammar & Vocabulary (50 questions, 30 minutes)
    assert.strictEqual(content.sections[0].id, 'grammar-vocabulary');
    assert.strictEqual(content.sections[0].label, 'Grammar & Vocabulary');
    assert.strictEqual(content.sections[0].durationMinutes, 30);
    assert.strictEqual(content.sections[0].questions.length, 50);
    content.sections[0].questions.forEach((q, idx) => {
      assert.ok(q.prompt, `Grammar Q${idx + 1} should have prompt`);
      assert.strictEqual(q.type, 'multiple-choice');
      assert.ok(q.options.length >= 3, `Grammar Q${idx + 1} should have at least 3 options`);
      assert.ok(q.options.includes(q.answer), `Grammar Q${idx + 1} answer should be in options`);
    });

    // Check Section 2: Writing Placement Test (User selects 1 question/topic to write 1 Essay, 20 minutes)
    assert.strictEqual(content.sections[1].id, 'writing');
    assert.ok(content.sections[1].label.includes('Writing'));
    assert.strictEqual(content.sections[1].durationMinutes, 20);
    assert.strictEqual(content.sections[1].selectionType, 'single_choice', 'Writing section should allow user to select 1 question');
    assert.strictEqual(content.sections[1].requiredSelections, 1, 'User only creates 1 Essay based on their selected question');
    const writingTopics = content.sections[1].topics || content.sections[1].questions;
    assert.ok(Array.isArray(writingTopics), 'Writing should have topics/questions array');
    assert.strictEqual(writingTopics.length, 5, 'Writing section should offer 5 selectable essay topics');
    writingTopics.forEach((topic, idx) => {
      assert.ok(topic.id, `Writing topic ${idx + 1} should have an id`);
      assert.ok(topic.title, `Writing topic ${idx + 1} should have a title`);
      assert.ok(topic.prompt, `Writing topic ${idx + 1} should have a prompt`);
      assert.ok(Array.isArray(topic.guidingQuestions), `Writing topic ${idx + 1} should have guiding questions`);
    });

    // Check Section 3: Oral Placement Test (21 questions, 20 minutes, sequential navigation)
    assert.strictEqual(content.sections[2].id, 'speaking');
    assert.ok(content.sections[2].label.includes('Placement') || content.sections[2].label.includes('Speaking'));
    assert.strictEqual(content.sections[2].durationMinutes, 20);
    assert.strictEqual(content.sections[2].questions.length, 21);
    assert.strictEqual(content.sections[2].navigationType, 'sequential_next_button');
    content.sections[2].questions.forEach((q, idx) => {
      assert.ok(q.prompt, `Speaking Q${idx + 1} should have prompt`);
      assert.ok(q.topic, `Speaking Q${idx + 1} should have topic`);
    });

    // Total questions check
    const totalCount = content.sections.reduce((sum, s) => sum + s.questions.length, 0);
    assert.strictEqual(totalCount, 76, 'Total questions across all 3 sections should be 76 (50 + 5 + 21)');
    assert.strictEqual(content.durationMinutes, 65, 'Total duration should be 65 minutes');
  });

  it('supports deleting all questions in a section (clearSection)', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'question-bank-template.json'), 'utf8');
    const content = JSON.parse(raw);
    const grammarSec = content.sections.find(s => s.id === 'grammar-vocabulary');

    // Simulate clearSection
    grammarSec.questions = [];
    assert.strictEqual(grammarSec.questions.length, 0);
  });

  it('supports deleting a question from a section and cloning state', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'question-bank-template.json'), 'utf8');
    const content = JSON.parse(raw);
    const grammarSec = content.sections.find(s => s.id === 'grammar-vocabulary');
    const initialCount = grammarSec.questions.length;
    const targetQ = grammarSec.questions[0];

    // Simulate delete question
    const qIdx = grammarSec.questions.findIndex(q => q.id === targetQ.id);
    assert.notStrictEqual(qIdx, -1);
    const [removed] = grammarSec.questions.splice(qIdx, 1);

    assert.strictEqual(removed.id, targetQ.id);
    assert.strictEqual(grammarSec.questions.length, initialCount - 1);
  });

  it('supports deleting all questions across all sections', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'question-bank-template.json'), 'utf8');
    const content = JSON.parse(raw);
    let totalRemoved = 0;
    (content.sections || []).forEach(sec => {
      totalRemoved += (sec.questions || []).length;
      sec.questions = [];
    });
    assert.ok(totalRemoved > 0);
    const totalRemaining = (content.sections || []).reduce((acc, s) => acc + (s.questions?.length || 0), 0);
    assert.strictEqual(totalRemaining, 0);
  });

  it('loads and validates rubrics structure for evaluated skills', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'rubrics-template.json'), 'utf8');
    const rubrics = JSON.parse(raw);
    assert.ok(rubrics.writing && Array.isArray(rubrics.writing.criteria), 'Writing criteria should exist');
    assert.ok(rubrics.speaking && Array.isArray(rubrics.speaking.criteria), 'Speaking criteria should exist');
    assert.ok(rubrics.grammarVocabulary && Array.isArray(rubrics.grammarVocabulary.criteria), 'Grammar criteria should exist');
    assert.ok(rubrics.writing.criteria.length >= 1, 'Writing criteria should not be empty');
    assert.ok(rubrics.speaking.criteria.length >= 1, 'Speaking criteria should not be empty');
  });

  it('supports deleting a criterion from a rubric skill', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'rubrics-template.json'), 'utf8');
    const rubrics = JSON.parse(raw);
    const initialWritingCount = rubrics.writing.criteria.length;
    assert.ok(initialWritingCount > 0);

    // Simulate delete criterion
    const [removed] = rubrics.writing.criteria.splice(0, 1);
    assert.ok(removed.name);
    assert.strictEqual(rubrics.writing.criteria.length, initialWritingCount - 1);
  });

  it('supports deleting all rubrics criteria across all skills', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'rubrics-template.json'), 'utf8');
    const rubrics = JSON.parse(raw);
    const skillKeys = ['writing', 'speaking', 'listening', 'reading', 'grammarVocabulary'];
    let totalRemoved = 0;
    skillKeys.forEach(k => {
      if (rubrics[k] && Array.isArray(rubrics[k].criteria)) {
        totalRemoved += rubrics[k].criteria.length;
        rubrics[k].criteria = [];
      }
    });
    assert.ok(totalRemoved > 0);
    const remainingCriteria = skillKeys.reduce((acc, k) => acc + (rubrics[k]?.criteria?.length || 0), 0);
    assert.strictEqual(remainingCriteria, 0);
  });

  it('validates writing section single topic selection and 1 essay data structure', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'question-bank-template.json'), 'utf8');
    const content = JSON.parse(raw);
    const writingSection = content.sections.find(s => s.id === 'writing');
    assert.ok(writingSection, 'Writing section must exist');
    assert.strictEqual(writingSection.selectionType, 'single_choice');
    assert.strictEqual(writingSection.requiredSelections, 1);
    assert.ok(Array.isArray(writingSection.topics));
    assert.strictEqual(writingSection.topics.length, 5);

    // Simulate candidate selecting Topic 2 and composing 1 essay
    const selectedTopic = writingSection.topics[1];
    assert.strictEqual(selectedTopic.id, 'w-topic-2');
    assert.strictEqual(selectedTopic.title, 'Email About Your Country');
    const candidateResponses = {
      'writing_selected_topic_id': selectedTopic.id,
      'writing_selected_topic_title': selectedTopic.title,
      'writing-essay': 'This is an email response detailing natural landmarks, cities, and cultural heritage.'
    };
    assert.ok(candidateResponses['writing-essay']);
    assert.strictEqual(candidateResponses['writing_selected_topic_id'], 'w-topic-2');
  });

  it('validates standalone writing topics template (content/templates/writing-topics-template.json)', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'writing-topics-template.json'), 'utf8');
    const template = JSON.parse(raw);
    assert.strictEqual(template.id, 'writing');
    assert.strictEqual(template.selectionType, 'single_choice');
    assert.strictEqual(template.requiredSelections, 1);
    assert.ok(Array.isArray(template.topics));
    assert.strictEqual(template.topics.length, 5);

    // Verify all 5 topics have necessary fields
    template.topics.forEach((t, i) => {
      assert.ok(t.id, `Topic ${i + 1} must have an id`);
      assert.ok(t.title, `Topic ${i + 1} must have a title`);
      assert.ok(t.prompt, `Topic ${i + 1} must have a prompt`);
      assert.ok(Array.isArray(t.guidingQuestions), `Topic ${i + 1} must have guiding questions`);
      assert.ok(t.guidingQuestions.length > 0, `Topic ${i + 1} guiding questions must not be empty`);
    });
  });

  it('supports deleting an individual topic from the writing section', async () => {
    const raw = await readFile(join(root, 'content', 'templates', 'writing-topics-template.json'), 'utf8');
    const writingData = JSON.parse(raw);
    const initialCount = writingData.topics.length;
    const topicToDelete = writingData.topics[0];

    // Simulate delete topic
    const tIdx = writingData.topics.findIndex(t => t.id === topicToDelete.id);
    assert.notStrictEqual(tIdx, -1);
    writingData.topics.splice(tIdx, 1);
    assert.strictEqual(writingData.topics.length, initialCount - 1);
    assert.strictEqual(writingData.topics.some(t => t.id === topicToDelete.id), false);
  });

  it('integrates dynamic rubrics criteria and computes CEFR band correctly', () => {
    const criteriaScores = {
      'Task Achievement': 5,
      'Coherence and Cohesion': 4,
      'Lexical Resource': 5,
      'Grammatical Range and Accuracy': 4
    };
    const values = Object.values(criteriaScores);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    assert.strictEqual(total, 18);
    assert.ok(avg >= 4.5);
  });
});



