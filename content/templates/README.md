# Assessify JSON Templates Guide

This directory contains standard JSON templates for importing **Question Banks** and **CEFR Rubrics** into Assessify.

---

## 1. Question Bank Template (`question-bank-template.json`)

Used by the **Question Bank** upload feature (`POST /api/admin/questions/upload`).

### Root Schema:
- `id` *(string)*: Unique identifier for this test package.
- `version` *(string)*: Version identifier (e.g., `"2026.1"`).
- `title` *(string)*: Display title of the assessment.
- `durationMinutes` *(number)*: Total overall duration in minutes.
- `sections` *(array)*: List of test sections.

### Section Object:
- `id` *(string)*: Section ID (e.g., `"grammar-vocabulary"`, `"reading"`, `"listening"`, `"writing"`, `"speaking"`).
- `label` *(string)*: Title displayed to candidates.
- `durationMinutes` *(number)*: Suggested time limit for this section.
- `instructions` *(string)*: Instructions displayed on the section header.
- `passage` *(string, optional)*: For Reading sections, the full text passage.
- `questions` *(array)*: List of questions.

### Question Formats:
- **Multiple Choice (Grammar, Reading, Listening)**:
  ```json
  {
    "id": "q-1",
    "type": "multiple-choice",
    "prompt": "Question text goes here...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Option B",
    "audioScript": "Optional text-to-speech script for listening questions."
  }
  ```
- **Writing Task (Essay / Short Essay)**:
  ```json
  {
    "id": "writing-1",
    "type": "essay",
    "prompt": "Essay prompt...",
    "rubric": {
      "criteria": ["Task Response", "Coherence and Cohesion", "Lexical Resource", "Grammatical Range and Accuracy"],
      "weight": "equal"
    }
  }
  ```
- **Speaking Task**:
  ```json
  {
    "id": "speaking-1",
    "type": "speaking-prompt",
    "part": "Part 1: Introduction",
    "prompt": "Speaking prompt...",
    "guidance": "Speak clearly for 1–2 minutes.",
    "rubric": {
      "criteria": ["Fluency", "Vocabulary", "Grammar", "Communication"],
      "weight": "equal"
    }
  }
  ```

---

## 2. Rubrics Template (`rubrics-template.json`)

Used by the **Rubrics** upload feature (`POST /api/admin/rubrics/upload`).

### Root Schema:
- `title` *(string)*: Title of the rubric.
- `version` *(string)*: Version string.
- `bandScale` *(object)*: Range mapping (e.g. `4–6 = A1, 7–9 = A2, 10–13 = B1, 14–16 = B2`).
- `writing` *(object)*: Writing criteria list and instructions.
- `speaking` *(object)*: Speaking criteria list and instructions.
