# Assessify — Comprehensive System User Manual
**Teacher Placement Assessment & Administrative Evaluation Platform**  
*Yayasan Karya Bangsa (TK · SD · SMP · SMA · SMK)*  
*Document Version: 2026.3 | Standard: CEFR & IELTS Aligned*

---

## Table of Contents
1. [Introduction & System Overview](#1-introduction--system-overview)
2. [System Requirements & Pre-Requisites](#2-system-requirements--pre-requisites)
3. [Teacher / Candidate User Manual](#3-teacher--candidate-user-manual)
   - [3.1 Authentication & School Unit Selection](#31-authentication--school-unit-selection)
   - [3.2 Hardware Diagnostics & Device Readiness](#32-hardware-diagnostics--device-readiness)
   - [3.3 Navigating the 75-Minute Assessment](#33-navigating-the-75-minute-assessment)
     - [Section 1: Listening Comprehension](#section-1-listening-comprehension)
     - [Section 2: Grammar & Vocabulary](#section-2-grammar--vocabulary)
     - [Section 3: Reading Comprehension](#section-3-reading-comprehension)
     - [Section 4: Writing Assessment](#section-4-writing-assessment)
     - [Section 5: Speaking Assessment & Video Recording](#section-5-speaking-assessment--video-recording)
   - [3.4 Assessment Submission & Provisional Results](#34-assessment-submission--provisional-results)
4. [Administrator & Evaluator User Manual](#4-administrator--evaluator-user-manual)
   - [4.1 Administrative Access & Security](#41-administrative-access--security)
   - [4.2 Assessment Results Dashboard](#42-assessment-results-dashboard)
   - [4.3 Multi-Unit Filtering & Candidate Search](#43-multi-unit-filtering--candidate-search)
   - [4.4 Candidate Inspection & Recording Playback](#44-candidate-inspection--recording-playback)
   - [4.5 Interactive Rubric Grading Matrix (Writing & Speaking)](#45-interactive-rubric-grading-matrix-writing--speaking)
   - [4.6 Data Exports (Styled Excel & PDF Certificates)](#46-data-exports-styled-excel--pdf-certificates)
   - [4.7 Question Bank Management & JSON Configuration](#47-question-bank-management--json-configuration)
   - [4.8 Rubrics & Standards Management](#48-rubrics--standards-management)
5. [CEFR Scoring Methodology & Decision Engine](#5-cefr-scoring-methodology--decision-engine)
6. [Troubleshooting & Frequently Asked Questions (FAQ)](#6-troubleshooting--frequently-asked-questions-faq)

---

## 1. Introduction & System Overview

**Assessify** is an institutional-grade English proficiency assessment and placement system developed specifically for the educational staff of **Yayasan Karya Bangsa**.

The platform evaluates candidates across **5 core communicative competencies** mapped directly to the **Common European Framework of Reference for Languages (CEFR: A1, A2, B1, B2, C1)**:
- **Listening Comprehension**: 15 audio-based objective items (15 minutes).
- **Grammar & Vocabulary**: 20 contextual multiple-choice items (15 minutes).
- **Reading Comprehension**: 15 passage-based analytical items (20 minutes).
- **Writing Assessment**: Open-ended pedagogical essay prompt (15 minutes).
- **Speaking Assessment**: Video/audio recorded response evaluated on a 4-criteria rubric (10 minutes).

Assessify operates with a **dual-layer evaluation engine**:
1. **Automated Objective Scoring**: Instantly benchmarks receptive skills (Listening, Grammar, Reading) against verified answer keys.
2. **Administrative Qualitative Rubrics**: Provides evaluators with an interactive 4-criteria matrix (1–5 scale) for productive skills (Writing, Speaking).

---

## 2. System Requirements & Pre-Requisites

### Hardware & Peripherals
- **Computer / Laptop**: Windows 10/11, macOS 11+, or modern Linux.
- **Audio Output**: Functional headphones or speakers (required for the Listening section and diagnostic check).
- **Microphone**: Built-in or external microphone (required for Speaking audio recording).
- **Camera (Webcam)**: Built-in or USB webcam (required for Speaking video verification).
- **Display Resolution**: Minimum $1280 \times 720$ (Recommended: $1920 \times 1080$).

### Supported Web Browsers
- **Google Chrome** (v110+) — *Recommended*
- **Microsoft Edge** (v110+) — *Recommended*
- **Mozilla Firefox** (v115+)
- **Apple Safari** (v16+)

### Network Requirements
- Stable broadband internet connection (Minimum 5 Mbps upload/download).
- Unrestricted access to local application port (`http://localhost:3000` or `http://localhost:3001`).

---

## 3. Teacher / Candidate User Manual

### 3.1 Authentication & School Unit Selection
1. Open your web browser and navigate to the Assessify application URL (e.g., `http://localhost:3001`).
2. Ensure the **Workspace Selector** is set to **"Teacher Placement Assessment"**.
3. Enter your details into the login form:
   - **Full Name with Academic Titles**: (e.g., `Anita Wijaya, S.Pd.` or `Dr. Hendra Gunawan, M.Pd.`).
   - **School Email Address**: Must use the institutional school domain (`@karyabangsa.sch.id`).
   - **School Unit**: Select your active teaching assignment:
     - `TK KARYA BANGSA`
     - `SD KARYA BANGSA`
     - `SMP KARYA BANGSA`
     - `SMA KARYA BANGSA`
     - `SMK KARYA BANGSA`
4. Click **"Continue Securely"** or **"Begin Assessment Workspace"**.

> [!IMPORTANT]
> Entering an email without the `@karyabangsa.sch.id` domain or omitting the School Unit will trigger a validation alert and block assessment access.

---

### 3.2 Hardware Diagnostics & Device Readiness
Upon successful sign-in, you are presented with the **Pre-Flight Hardware Diagnostics Suite**. This ensures your hardware is working before the timed assessment starts:

1. **Speaker / Audio Test**: Click **"Play Test Sound"**. Verify that you hear the chime clearly through your headphones/speakers.
2. **Microphone Level Meter**: Speak into your microphone. Observe the live animated audio level meter. A green bar moving across indicates active vocal input.
3. **Camera Check**: When prompted by your browser, click **"Allow"** to grant camera and microphone permissions. Verify that your camera feed is active.
4. **Assessment Rules Review**: Read the 75-minute proctoring rules, integrity guidelines, and section breakdown.
5. Click **"Begin 75-Minute Assessment"** to initialize your official test attempt.

---

### 3.3 Navigating the 75-Minute Assessment

The assessment interface features a **top progress bar**, a **live countdown timer**, and **section navigation controls**.

#### Section 1: Listening Comprehension
- **Format**: 15 multiple-choice questions based on spoken academic dialogue and announcements.
- **Audio Playback**: Click the **"Play Question Audio"** button to hear the audio prompt via the browser's speech synthesis engine.
- **Answering**: Select the radio button corresponding to the best option (A, B, C, or D).
- **Navigation**: Click **"Next Section"** at the bottom of the page when finished.

#### Section 2: Grammar & Vocabulary
- **Format**: 20 multiple-choice contextual items evaluating syntactic complexity, collocations, and tense consistency.
- **Answering**: Click your chosen option for each sentence completion item.
- **Auto-Saving**: Your selected choices are automatically cached in local storage and synced to the server.

#### Section 3: Reading Comprehension
- **Format**: 15 passage-based analytical items testing main ideas, factual scanning, and lexical inference.
- **Layout**: The reading passage is displayed with distinct paragraph indicators alongside corresponding questions.
- **Answering**: Read each paragraph carefully and select the best answer for items 1 through 15.

#### Section 4: Writing Assessment
- **Format**: Extended response essay prompt addressing a pedagogical or educational scenario.
- **Word Count Target**: 150 to 250 words.
- **Live Counter**: A real-time word counter below the text editor displays your active word count.
- **Integrity**: Responses are periodically auto-saved to prevent data loss.

#### Section 5: Speaking Assessment & Video Recording
- **Format**: Spoken response to an oral interview prompt.
- **Recording Procedure**:
  1. Position yourself in front of the camera with your face clearly visible.
  2. Click **"Start Recording"** (the recording indicator turns red and the timer begins).
  3. Speak clearly for 1 to 2 minutes addressing the prompt questions.
  4. Observe the live Web Audio voice visualizer to confirm audio capture.
  5. Click **"Stop Recording"** when finished.
  6. You can play back your recording to verify video and audio quality.

---

### 3.4 Assessment Submission & Provisional Results

1. Once all 5 sections are complete, click **"Submit Completed Assessment"**.
2. Confirm the submission prompt.
3. The **Assessment Results Summary Screen** will display:
   - **Unique Attempt Reference ID** (e.g., `ATT-1046`).
   - **Candidate Full Name & School Unit**.
   - **Objective Section Scores & Levels** (Listening, Grammar, Reading).
   - **Provisional CEFR Placement Estimate**.
   - **Review Notice**: Explains that Writing and Speaking responses are queued for official administrative rubric evaluation.
4. Click **"Sign out"** in the top navigation bar to conclude your session.

---

## 4. Administrator & Evaluator User Manual

### 4.1 Administrative Access & Security
1. Navigate to the Assessify login screen.
2. In the **Workspace Selector**, choose **"School Administration Portal"**.
3. Enter administrator credentials:
   - **Username**: `azzikra` (or designated administrator ID).
   - **Password**: Secure administrator password.
4. Click **"Access Admin Workspace"**.

---

### 4.2 Assessment Results Dashboard
The **Results Dashboard** is the central command center for evaluating teacher candidates.

- **Statistics Cards**:
  - **Total Candidates**: Total number of registered assessment attempts.
  - **Completed Assessments**: Tests submitted and ready for review.
  - **Pending Reviews**: Submissions awaiting manual rubric evaluation.
- **Primary Actions**:
  - **Export to Excel (.xlsx)**: Downloads an institutional grade spreadsheet.
  - **Export to PDF (.pdf)**: Generates centered placement certificates.
  - **Bulk Delete**: Removes selected candidate records after confirmation.

---

### 4.3 Multi-Unit Filtering & Candidate Search
Administrators can isolate candidate cohorts with zero latency:
- **Unit Filter Tabs**: Click `All Units`, `TK KARYA BANGSA`, `SD KARYA BANGSA`, `SMP KARYA BANGSA`, or `SMA KARYA BANGSA` to instantly filter the table.
- **Live Search Bar**: Type candidate names, email addresses, or Attempt IDs into the search box to filter results in real time.

---

### 4.4 Candidate Inspection & Recording Playback
1. In the candidate table, locate the desired candidate row.
2. Click the **"View Details"** button (Eye icon).
3. The **Candidate Details Modal** provides:
   - Complete candidate metadata, school unit, and timestamps.
   - Breakdown of scores and CEFR levels across all 5 skill areas.
   - Full transcript of the submitted Writing essay.
   - **Integrated Media Player**: Streams the recorded Speaking video/audio with full seek and playback controls via HTTP 206 partial streaming.
4. Click **"Close"** to dismiss the modal.

---

### 4.5 Interactive Rubric Grading Matrix (Writing & Speaking)

1. In the candidate table, click **"Evaluate / Grade"** (Pencil icon) for a candidate with "Review required" status.
2. The **Rubric Grading Modal** will open displaying two 4-criteria evaluation cards:

#### Writing Evaluation Rubric (Max 20 Points)
- **Task Achievement** (1–5 scale): Prompt coverage, thesis development, evidence.
- **Coherence & Cohesion** (1–5 scale): Paragraphing, logical sequencing, transitions.
- **Lexical Resource** (1–5 scale): Vocabulary range, precision, academic idiom.
- **Grammar Range & Accuracy** (1–5 scale): Sentence variety, structural accuracy.

#### Speaking Evaluation Rubric (Max 20 Points)
- **Fluency & Coherence** (1–5 scale): Spontaneous flow, pacing, minimal hesitation.
- **Lexical Resource** (1–5 scale): Spoken vocabulary, conversational & academic register.
- **Grammar Range & Accuracy** (1–5 scale): Spontaneous syntactic control.
- **Interactive Communication / Pronunciation** (1–5 scale): Intelligibility, articulation, stress.

#### Real-Time Scoring & Finalization
- As you click the score buttons (1 through 5), the system automatically updates the total score and CEFR band badge in real time:
  - **4–6 pts** $\rightarrow$ **A1 (Beginner)**
  - **7–9 pts** $\rightarrow$ **A2 (Elementary)**
  - **10–13 pts** $\rightarrow$ **B1 (Intermediate)**
  - **14–17 pts** $\rightarrow$ **B2 (Upper-Intermediate)**
  - **18–20 pts** $\rightarrow$ **C1 (Advanced)**
- Click **"Save & Finalize Assessment"**.
- The candidate's status transitions to **"Teacher reviewed"** and their official composite placement is locked in.

---

### 4.6 Data Exports (Styled Excel & PDF Certificates)

#### Single Candidate Certificate
- In the candidate row, click **"Export PDF"** to generate an official, high-resolution placement certificate featuring the candidate's name, school unit, unique certificate number (e.g. `KBS-EN-2026-1046`), color-coded CEFR badges, and performance analysis.

#### Bulk Export
- Use the **"Export PDF"** button in the dashboard toolbar to download a multi-page certificate compilation for all filtered candidates.
- Click **"Export Excel"** to download a formatted spreadsheet (`.xlsx`) complete with headers, cell alignments, CEFR level columns, and auto-filters.

---

### 4.7 Question Bank Management & JSON Configuration
1. Click the **"Question Bank"** tab in the top navigation bar.
2. **View Active Items**: Inspect the active question bank structure, section timers, question prompts, audio scripts, and answer keys.
3. **Download Current JSON**: Click **"Download Active Question Bank (.json)"** to back up the current test dataset.
4. **Upload New Question Bank**:
   - Prepare a validated JSON file conforming to the schema in `content/templates/question-bank-template.json`.
   - Click **"Choose Question Bank JSON"** and select your file.
   - The platform validates the file structure and applies updates instantly.

---

### 4.8 Rubrics & Standards Management
1. Click the **"Rubrics & Standards"** tab in the top navigation bar.
2. **Review CEFR Descriptors**: View official descriptors and score conversion thresholds for Listening, Grammar, Reading, Writing, and Speaking.
3. **Upload Custom Rubrics**: Click **"Choose Rubrics JSON"** to upload updated institutional rubrics conforming to `content/templates/rubrics-template.json`.

---

## 5. CEFR Scoring Methodology & Decision Engine

### Objective Item Thresholds

| Skill / Section | Total Items | A1 | A2 | B1 | B2 | C1 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Listening Comprehension** | 15 Items | 0–5 | 6–8 | 9–11 | 12–14 | 15 / 15 |
| **Grammar & Vocabulary** | 20 Items | 0–7 | 8–11 | 12–15 | 16–18 | 19–20 / 20 |
| **Reading Comprehension** | 15 Items | 0–5 | 6–8 | 9–11 | 12–14 | 15 / 15 |

### Qualitative Rubric Thresholds (Writing & Speaking)

| Criteria Total Score | CEFR Band | Proficiency Description |
| :---: | :---: | :--- |
| **18 – 20 Points** | **C1** | **Advanced / Mastery**: Sophisticated control, academic precision, fluent delivery. |
| **14 – 17 Points** | **B2** | **Upper-Intermediate**: Effective operational proficiency, clear argument structure. |
| **10 – 13 Points** | **B1** | **Intermediate**: Independent communication on familiar pedagogical topics. |
| **7 – 9 Points** | **A2** | **Elementary**: Basic sentences, simple grammatical patterns. |
| **4 – 6 Points** | **A1** | **Beginner**: Formulaic phrases, very limited structural control. |

### Overall Composite CEFR Placement Algorithm
The platform applies a multi-skill composite decision rule:
- **C1 (Advanced)**: At least **3 skills at C1**, with Writing $\ge$ B2 and Speaking $\ge$ B2.
- **B2 (Upper-Intermediate)**: At least **3 skills at B2 or C1**, with Writing $\ge$ B1 and Speaking $\ge$ B1.
- **B1 (Intermediate)**: At least **3 skills at B1 or higher**, with Writing $\ge$ A2 and Speaking $\ge$ A2.
- **A2 (Elementary)**: At least **3 skills at A2 or higher**.
- **A1 (Beginner)**: Default baseline.

---

## 6. Troubleshooting & Frequently Asked Questions (FAQ)

### For Teacher Candidates

#### Q1: Why does the system say "Use your Karya Bangsa School account"?
**A**: Assessify requires an official institutional email address ending with `@karyabangsa.sch.id`. Personal email domains (e.g., `@gmail.com`, `@yahoo.com`) are rejected for security and accreditation compliance.

#### Q2: What should I do if my camera or microphone is not detected?
**A**:
1. Check that your webcam and microphone are physically plugged in and turned on.
2. In your browser's address bar, click the **Padlock / Site Settings** icon.
3. Ensure **Camera** and **Microphone** permissions are set to **"Allow"**.
4. Refresh the page and rerun the hardware diagnostics check.

#### Q3: What happens if my internet connection drops during the test?
**A**: Assessify caches your answers in local browser storage. Reconnect your internet and refresh the page. Your progress will be restored as long as your 75-minute assessment window has not expired.

---

### For Administrators & Evaluators

#### Q1: Where are the Speaking video/audio files stored?
**A**: Media recordings are saved in `uploads/recordings/` on the server and indexed by Attempt ID. They can be streamed directly in the admin console or downloaded for archiving.

#### Q2: Can an administrator regrade a candidate's rubric?
**A**: Yes. Administrators can click **"Evaluate / Grade"** on any completed candidate record at any time to revise individual criterion scores. The system will recompute the overall placement band immediately.

#### Q3: How do I back up test data?
**A**: 
1. Export the complete candidate database to Excel (`.xlsx`) from the Results tab.
2. Download active Question Banks and Rubrics via the respective management tabs.
3. Backup MySQL database tables `attempts` and `settings`.

---
*Assessify Platform Documentation · Yayasan Karya Bangsa © 2026. All rights reserved.*
