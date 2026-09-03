# Assessify Question Bank & Rubrics Upload Templates

This directory contains standardized JSON templates for customizing the **Assessify Teacher Placement Assessment System**.

---

## 1. Question Bank Template: `question-bank-template.json`

The Question Bank template is structured into **5 sequential assessment sections**:

### Structure Overview
```json
{
  "id": "ielts-placement-bank-2026",
  "version": "2026.1",
  "title": "KBS Comprehensive Teacher Placement Assessment",
  "durationMinutes": 75,
  "sections": [
    { "id": "listening", "label": "Listening", "durationMinutes": 15, "questions": [...] },
    { "id": "reading", "label": "Reading", "durationMinutes": 20, "passages": [...], "questions": [...] },
    { "id": "grammar-vocabulary", "label": "Grammar & Vocabulary", "durationMinutes": 15, "questions": [...] },
    { "id": "writing", "label": "Writing", "durationMinutes": 25, "questions": [...] },
    { "id": "speaking", "label": "Speaking", "durationMinutes": 10, "questions": [...] }
  ]
}
```

### Key Features Supported
- **Listening Audio Scripts (`audioScript`)**: Individual transcript for each listening item, playable in candidate mode and previewable in admin portal.
- **Multiple Reading Passages (`passages`)**: Multi-passage array (e.g. Passages 1–3) with paragraph reference codes `[A]`, `[B]` and dedicated question ranges (1–5, 6–10, 11–15).
- **Deletion Capabilities**: Independent deletion for individual questions, passages, sections, and bulk delete.

---

## 2. Evaluation Rubrics Template: `rubrics-template.json`

The Rubrics template defines the institutional evaluation criteria and CEFR benchmark thresholds across all **5 assessment skills**:

### Structure Overview
```json
{
  "title": "Teacher English Placement Detailed CEFR Rubrics",
  "version": "2026.1",
  "bandScale": {
    "range": "A1–C1",
    "overall": "Writing and Speaking: 4–6 = A1, 7–9 = A2, 10–13 = B1, 14–17 = B2, 18–20 = C1 (1 to 5 scale per criterion across 4 criteria)."
  },
  "listening": {
    "title": "Listening Comprehension Evaluation Standard",
    "format": "15 Objective Audio Prompts (15 Mins)",
    "thresholds": "A1: 0–5 | A2: 6–8 | B1: 9–11 | B2: 12–14 | C1: 15 / 15",
    "criteria": [
      { "name": "Gist & Main Idea Identification", "description": "..." },
      { "name": "Factual Detail Extraction", "description": "..." },
      { "name": "Inferential & Contextual Comprehension", "description": "..." }
    ]
  },
  "reading": {
    "title": "Reading Comprehension Evaluation Standard",
    "format": "15 Passage Items across 3 Academic Texts (20 Mins)",
    "thresholds": "A1: 0–5 | A2: 6–8 | B1: 9–11 | B2: 12–14 | C1: 15 / 15",
    "criteria": [
      { "name": "Main Theme & Argument Analysis", "description": "..." },
      { "name": "Lexical Inference in Context", "description": "..." },
      { "name": "Textual Evidence & Fact Verification", "description": "..." }
    ]
  },
  "grammarVocabulary": {
    "title": "Grammar & Vocabulary Evaluation Standard",
    "format": "20 Contextual Objective Items (15 Mins)",
    "thresholds": "A1: 0–7 | A2: 8–11 | B1: 12–15 | B2: 16–18 | C1: 19–20",
    "criteria": [
      { "name": "Complex Syntactic Control", "description": "..." },
      { "name": "Collocational & Register Precision", "description": "..." },
      { "name": "Morphological Accuracy", "description": "..." }
    ]
  },
  "writing": {
    "title": "Academic Essay Writing Rubric",
    "format": "200–250 Word Structured Academic Essay (25 Mins)",
    "weight": "Administrator scores each of 4 criteria from 1 (A1) to 5 (C1). Total maximum score is 20.",
    "criteria": [
      { "name": "Task Achievement", "description": "..." },
      { "name": "Coherence and Cohesion", "description": "..." },
      { "name": "Lexical Resource", "description": "..." },
      { "name": "Grammatical Range and Accuracy", "description": "..." }
    ]
  },
  "speaking": {
    "title": "Speaking & Oral Interview Rubric",
    "format": "3-Part Recorded Video/Audio Interview (10 Mins)",
    "weight": "Administrator scores each of 4 criteria from 1 (A1) to 5 (C1). Total maximum score is 20.",
    "criteria": [
      { "name": "Fluency and Spontaneity", "description": "..." },
      { "name": "Lexical & Idiomatic Range", "description": "..." },
      { "name": "Grammatical Complexity & Control", "description": "..." },
      { "name": "Pronunciation & Communicative Delivery", "description": "..." }
    ]
  }
}
```

---

## 3. Writing Topics Template: `writing-topics-template.json`

A dedicated, standalone template specifically for uploading the **Writing Section selectable topics** without needing to touch other sections.

### Structure Overview
```json
{
  "id": "writing",
  "label": "Writing Placement Test",
  "durationMinutes": 20,
  "selectionType": "single_choice",
  "requiredSelections": 1,
  "instructions": "Choose ONE of these topics and write about it. Create 1 Essay based on your selected topic (20 minutes).",
  "topics": [
    {
      "id": "w-topic-1",
      "title": "Personal Profile",
      "type": "essay",
      "prompt": "Write a personal profile about yourself for a website where you can meet new Internet friends.",
      "guidingQuestions": [
        "What is your name, age, etc.?",
        "Where you are from, and what do you do?",
        "What are your interests and your likes/dislikes?"
      ]
    }
  ]
}
```

When uploaded via the Admin Portal, it seamlessly updates Section 2 (Writing) in the question bank while preserving the Grammar & Vocabulary and Oral Placement sections.

---

## 4. How to Download, Edit & Upload in Admin Portal

### Downloading Templates:
- In **Question Bank** tab:
  - Click **Download Writing Template** (`/api/admin/questions/template/writing`) to customize only writing topics.
  - Click **Download Full Bank** (`/api/admin/questions/template`) to download the complete multi-section question bank.
- In **Rubrics Management** tab: Click **Download Template** (`/api/admin/rubrics/template`).

### Uploading & Publishing:
1. Click **Choose JSON to Upload** to stage your modified template (either full question bank or writing topics template).
2. Review staged cards, topic titles, guiding points, and live audio previews.
3. Click **Approve & Publish** to instantly save and persist to MySQL database.
4. Use the **Delete** buttons on criteria, skills, questions, passages, or entire sections as needed.

