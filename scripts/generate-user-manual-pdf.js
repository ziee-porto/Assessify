import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';

const outputPath = join(process.cwd(), 'Assessify_User_Manual.pdf');
const brainDir = 'C:\\Users\\ASUS\\.gemini\\antigravity-ide\\brain\\03ec19fb-b04d-414e-bbcf-07aea2fe02a0';

// Screenshot mapping
const screenshots = {
  teacherLogin: join(brainDir, 'teacher_login_page_1788316775938.png'),
  adminLogin: join(brainDir, 'admin_login_page_1788316804925.png'),
  diagnostics: join(brainDir, 'pre_test_diagnostics_1788317003254.png'),
  listening: join(brainDir, 'section1_listening_1788317100536.png'),
  grammar: join(brainDir, 'section2_grammar_vocab_1788317464921.png'),
  reading: join(brainDir, 'reading_section_1788322676098.png'),
  writing: join(brainDir, 'writing_section_1788322909110.png'),
  speaking: join(brainDir, 'speaking_section_1788322969986.png'),
  results: join(brainDir, 'assessment_results_1788323291751.png'),
  candidateList: join(brainDir, 'candidates_list_1788317883066.png'),
  candidateDetails: join(brainDir, 'candidate_details_modal_1788321479653.png'),
  rubricGrading: join(brainDir, 'rubric_evaluation_cards_1788318132431.png'),
  gradesFinalized: join(brainDir, 'grades_finalized_result_1788321160557.png'),
  questionBank: join(brainDir, 'question_bank_management_1788321331081.png'),
  rubricsManagement: join(brainDir, 'rubrics_standards_management_1788321351648.png')
};

function buildUserManualPDF() {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, bottom: 0, left: 42, right: 42 },
    bufferPages: true
  });

  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  const colors = {
    navy: '#0f274a',
    navyLight: '#1e3a8a',
    blue: '#2563eb',
    blueLight: '#eff6ff',
    blueBorder: '#bfdbfe',
    ink: '#0f172a',
    slateDark: '#1e293b',
    slateMid: '#334155',
    muted: '#64748b',
    line: '#e2e8f0',
    green: '#059669',
    greenLight: '#ecfdf5',
    greenBorder: '#a7f3d0',
    purple: '#7c3aed',
    purpleLight: '#f5f3ff',
    purpleBorder: '#ddd6fe',
    amber: '#d97706',
    amberLight: '#fffbeb',
    amberBorder: '#fde68a',
    red: '#c0392b',
    redLight: '#fef2f2',
    cardBg: '#f8fafc',
    white: '#ffffff'
  };

  // Helper: Header bar
  function drawHeader(pageTitle) {
    doc.rect(0, 0, 595, 32).fill(colors.navy);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
      .text('ASSESSIFY', 42, 10);
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
      .text(' · OFFICIAL USER MANUAL (TK · SD · SMP · SMA · SMK)', 96, 10);
    doc.fillColor('#cbd5e1').fontSize(7.5).font('Helvetica-Bold')
      .text(pageTitle.toUpperCase(), 330, 10, { align: 'right', width: 223 });
    doc.y = 44;
  }

  // Helper: Section Title
  function drawSectionTitle(number, title, color = colors.navy) {
    const y = doc.y;
    doc.rect(42, y, 4, 18).fill(color);
    doc.fillColor(color).fontSize(11.5).font('Helvetica-Bold')
      .text(` ${number}. ${title}`, 50, y + 2.5);
    doc.y = y + 23;
  }

  // Helper: Sub-section Title
  function drawSubTitle(title, color = colors.slateDark) {
    doc.fillColor(color).fontSize(9).font('Helvetica-Bold').text(title);
    doc.y += 2;
  }

  // Helper: Text paragraph
  function drawParagraph(text, lineGap = 2) {
    doc.fillColor(colors.slateMid).fontSize(8.2).font('Helvetica').lineGap(lineGap).text(text, { align: 'justify' });
    doc.y += 3;
  }

  // Helper: Dynamic Step Instruction Box
  function drawStep(stepNum, title, desc, actionItems = []) {
    const startY = doc.y;
    const boxW = 511;

    doc.fontSize(7.4).font('Helvetica').lineGap(1.5);
    let itemsH = 0;
    actionItems.forEach(it => {
      itemsH += doc.heightOfString(it, { width: 440 }) + 3;
    });
    const boxH = 26 + (actionItems.length > 0 ? itemsH + 6 : 0);

    doc.rect(42, startY, boxW, boxH).fillAndStroke(colors.cardBg, colors.line);
    doc.rect(42, startY, 22, boxH).fill(colors.blue);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(String(stepNum), 48, startY + 6);
    doc.fillColor(colors.navy).fontSize(8.5).font('Helvetica-Bold').text(title, 70, startY + 5);
    doc.fillColor(colors.slateMid).fontSize(7.6).font('Helvetica').text(desc, 70, startY + 16, { width: 475 });

    if (actionItems.length > 0) {
      let itemY = startY + 28;
      actionItems.forEach((it) => {
        doc.fillColor(colors.blue).fontSize(7.5).font('Helvetica-Bold').text('•', 72, itemY);
        doc.fillColor(colors.slateMid).fontSize(7.4).font('Helvetica').lineGap(1.2).text(it, 80, itemY, { width: 460 });
        itemY += doc.heightOfString(it, { width: 460 }) + 3;
      });
    }

    doc.y = startY + boxH + 5;
  }

  // Helper: Screenshot with Title Bar
  function drawScreenshot(imagePath, caption, width = 511, height = 110) {
    const startY = doc.y;
    const boxWidth = width;
    const boxHeight = height + 20;

    doc.rect(42, startY, boxWidth, boxHeight).fillAndStroke('#ffffff', colors.line);
    doc.rect(42, startY, boxWidth, 15).fill('#f1f5f9');
    doc.fillColor(colors.slateDark).fontSize(7.5).font('Helvetica-Bold')
      .text(`INTERFACE REFERENCE: ${caption}`, 48, startY + 3.5);

    if (existsSync(imagePath)) {
      try {
        doc.image(imagePath, 44, startY + 17, { fit: [boxWidth - 4, height], align: 'center', valign: 'center' });
      } catch (err) {
        doc.fillColor(colors.red).fontSize(7.5).text(`[Image load error: ${err.message}]`, 50, startY + 25);
      }
    } else {
      doc.fillColor(colors.muted).fontSize(7.5).text('[Screenshot placeholder]', 50, startY + 25);
    }

    doc.y = startY + boxHeight + 6;
  }

  // Helper: Dynamic Two-column Box
  function drawTwoColBox(leftTitle, leftText, rightTitle, rightText) {
    const startY = doc.y;
    const colW = 250;
    const gap = 11;

    doc.fontSize(7.4).font('Helvetica').lineGap(1.5);
    const leftH = doc.heightOfString(leftText, { width: colW - 14 });
    const rightH = doc.heightOfString(rightText, { width: colW - 14 });
    const contentH = Math.max(leftH, rightH);
    const boxHeight = contentH + 24;

    // Left Box
    doc.rect(42, startY, colW, boxHeight).fillAndStroke(colors.cardBg, colors.line);
    doc.rect(42, startY, colW, 15).fill('#e2e8f0');
    doc.fillColor(colors.navy).fontSize(8).font('Helvetica-Bold').text(leftTitle, 48, startY + 3.5);
    doc.fillColor(colors.slateMid).fontSize(7.4).font('Helvetica').lineGap(1.5).text(leftText, 48, startY + 19, { width: colW - 14 });

    // Right Box
    const rightX = 42 + colW + gap;
    doc.rect(rightX, startY, colW, boxHeight).fillAndStroke(colors.cardBg, colors.line);
    doc.rect(rightX, startY, colW, 15).fill('#e2e8f0');
    doc.fillColor(colors.navy).fontSize(8).font('Helvetica-Bold').text(rightTitle, rightX + 6, startY + 3.5);
    doc.fillColor(colors.slateMid).fontSize(7.4).font('Helvetica').lineGap(1.5).text(rightText, rightX + 6, startY + 19, { width: colW - 14 });

    doc.y = startY + boxHeight + 6;
  }

  // =========================================================================
  // PAGE 1: USER MANUAL COVER & INTRODUCTION
  // =========================================================================
  drawHeader('System Manual & Operating Guidelines');

  // Title Banner
  doc.rect(42, 44, 511, 68).fill(colors.blueLight);
  doc.rect(42, 44, 511, 68).stroke(colors.blueBorder);
  doc.fillColor(colors.navy).fontSize(15).font('Helvetica-Bold')
    .text('Assessify: Comprehensive Platform User Manual', 54, 54, { width: 485 });
  doc.fillColor(colors.blue).fontSize(9).font('Helvetica-Bold')
    .text('Teacher Placement Assessment & Administrative Evaluation Operating Guide', 54, 76);
  doc.fillColor(colors.muted).fontSize(7.5).font('Helvetica')
    .text('Yayasan Karya Bangsa (TK, SD, SMP, SMA, SMK) · Edition 2026.3 | Standard: CEFR Aligned', 54, 90);

  doc.y = 120;

  drawSectionTitle('1', 'Introduction & Purpose of Assessify');
  drawParagraph(
    'This User Manual provides step-by-step operating instructions for candidates taking the English Placement Assessment ' +
    'and school administrators managing candidate evaluations, scoring rubrics, and reporting across all 5 school units: TK, SD, SMP, SMA, and SMK Karya Bangsa.'
  );

  drawSubTitle('System Assessment Architecture:');
  drawTwoColBox(
    '1. Examinee Placement Flow',
    '• Domain Authentication (@karyabangsa.sch.id)\n• Automated Hardware Diagnostics Check\n• 5 Assessment Modules (Listening, Grammar, Reading, Writing, Speaking)\n• 75-Minute Server-Enforced Time Limit\n• Immediate Provisional Score Summary',
    '2. Administrator Governance Flow',
    '• Secure Role-Based Administration Access\n• Real-Time Results Console with 5-Unit Filters\n• Candidate Inspection & Video Recording Stream\n• 4-Criteria Interactive Rubric Evaluation\n• Official PDF & Excel (.xlsx) Report Exports'
  );

  drawSectionTitle('2', 'Hardware, Software & Environmental Requirements');
  drawTwoColBox(
    'Candidate Device & Browser Standards',
    '• Google Chrome (v110+) or Microsoft Edge (v110+)\n• Functional Headphones / Speakers for Listening\n• Functional Microphone & Webcam for Speaking\n• Minimum Screen Resolution: 1280 × 720 px\n• Stable Internet (Min 5 Mbps upload/download)',
    'Administrative Workstation Standards',
    '• Chrome / Edge / Firefox desktop browser\n• Enabled JavaScript & Cookie Storage\n• Minimum 1080p display recommended for split evaluation\n• Local audio device for candidate speech playback\n• Spreadsheet reader for .xlsx export verification'
  );

  // =========================================================================
  // PAGE 2: TEACHER MANUAL - AUTHENTICATION & DIAGNOSTICS
  // =========================================================================
  doc.addPage();
  drawHeader('Teacher Guide: Authentication & Hardware Checks');

  drawSectionTitle('3', 'Step-by-Step Teacher Assessment Flow');
  
  drawStep(
    '1',
    'Candidate Authentication & School Unit Selection',
    'Access the platform and sign in with your official institutional identity.',
    [
      'Navigate to http://localhost:3001 in Google Chrome or Microsoft Edge.',
      'Ensure the Workspace dropdown is set to "Teacher Placement Assessment".',
      'Enter your Full Name with academic titles (e.g., Anita Wijaya, S.Pd.).',
      'Enter your institutional school email ending with @karyabangsa.sch.id.',
      'Select your teaching assignment: TK, SD, SMP, SMA, or SMK KARYA BANGSA.',
      'Click "Continue Securely" or "Begin Assessment Workspace".'
    ]
  );

  drawScreenshot(screenshots.teacherLogin, 'Teacher Sign-In & School Unit Selection Screen (TK, SD, SMP, SMA, SMK)', 511, 105);

  drawStep(
    '2',
    'Pre-Flight Hardware Diagnostics Suite',
    'Verify your audio, microphone, and camera before starting the timed assessment.',
    [
      'Audio Output: Click "Play Test Sound" to confirm clear chime playback.',
      'Microphone Meter: Speak into your microphone to verify live vocal input meter.',
      'Camera Permissions: Click "Allow" on browser prompt to enable video feed.',
      'Read the 75-minute assessment rules, then click "Begin 75-Minute Assessment".'
    ]
  );

  drawScreenshot(screenshots.diagnostics, 'Pre-Flight Hardware Diagnostics & Assessment Rules Screen', 511, 105);

  // =========================================================================
  // PAGE 3: TEACHER MANUAL - ASSESSMENT SECTIONS (LISTENING & READING)
  // =========================================================================
  doc.addPage();
  drawHeader('Teacher Guide: Listening & Reading Modules');

  drawSectionTitle('4', 'Navigating Receptive Skills Assessment');

  drawStep(
    '3',
    'Section 1: Listening Comprehension (15 Items · 15 Minutes)',
    'Listen to spoken academic dialogues and announcements, then answer multiple-choice questions.',
    [
      'Click "Play Question Audio" to trigger text-to-speech spoken prompts.',
      'Select the radio button corresponding to the best answer option (A, B, C, or D).',
      'Answers are saved automatically as you make your selections.',
      'Scroll to the bottom of the section and click "Next Section" to proceed.'
    ]
  );

  drawScreenshot(screenshots.listening, 'Listening Comprehension Interface with TTS Audio Playback', 511, 110);

  drawStep(
    '4',
    'Section 3: Reading Comprehension (15 Items · 20 Minutes)',
    'Analyze passage context and answer passage-based multiple choice items.',
    [
      'Review the pinned reading passage with paragraph reference numbers.',
      'Answer questions testing main themes, specific details, and lexical meaning.',
      'Use the top timer to pace yourself across the 15 reading items.'
    ]
  );

  drawScreenshot(screenshots.reading, 'Reading Comprehension Module with Passage Context', 511, 110);

  // =========================================================================
  // PAGE 4: TEACHER MANUAL - WRITING, SPEAKING & SUBMISSION
  // =========================================================================
  doc.addPage();
  drawHeader('Teacher Guide: Writing, Speaking & Submission');

  drawSectionTitle('5', 'Productive Skills Assessment & Official Submission');

  drawStep(
    '5',
    'Section 4: Writing Essay (1 Item · 15 Minutes)',
    'Compose an essay addressing the educational prompt using clear pedagogical arguments.',
    [
      'Read prompt requirements and target word threshold (150–250 words).',
      'Type your essay into the editor; observe the dynamic word count counter.',
      'Drafts are auto-saved in local cache and synchronized with the server periodically.'
    ]
  );

  drawScreenshot(screenshots.writing, 'Writing Assessment Editor with Dynamic Word Count', 511, 105);

  drawStep(
    '6',
    'Section 5: Speaking Interview (2 Prompts · 10 Minutes)',
    'Record your spoken response using the integrated video/audio recorder.',
    [
      'Position yourself in front of the camera and click "Start Recording".',
      'Speak clearly for 1–2 minutes; monitor the live Web Audio voice wave visualizer.',
      'Click "Stop Recording" and play back your video to verify audio clarity.'
    ]
  );

  drawScreenshot(screenshots.speaking, 'Speaking Assessment Interface with Video Stream & Audio Visualizer', 511, 105);

  drawStep(
    '7',
    'Submitting the Assessment & Viewing Provisional Results',
    'Finalize your test attempt and receive immediate provisional feedback.',
    [
      'Click "Submit Completed Assessment" and confirm in the submission dialog.',
      'Review your provisional score breakdown, unique Attempt ID (e.g. ATT-1046), and completion notice.'
    ]
  );

  // =========================================================================
  // PAGE 5: ADMINISTRATOR MANUAL - DASHBOARD & CANDIDATE MANAGEMENT
  // =========================================================================
  doc.addPage();
  drawHeader('Admin Guide: Results Dashboard & Governance');

  drawSectionTitle('6', 'Administrative Workspace Access & Navigation');

  drawStep(
    '1',
    'Administrator Sign-In',
    'Access the administrative governance console.',
    [
      'On login screen, set Workspace to "School Administration Portal".',
      'Enter administrator username (e.g. azzikra) and administrative password.',
      'Click "Access Admin Workspace".'
    ]
  );

  drawStep(
    '2',
    'Results Dashboard & Multi-Unit Filtering',
    'Monitor candidate completion metrics and filter records by school unit.',
    [
      'View summary cards: Total Candidates, Completed Tests, Pending Reviews.',
      'Click School Unit filter pills: All Units, TK, SD, SMP, SMA, SMK Karya Bangsa.',
      'Use the live search bar to locate candidates by name, email, or Attempt ID.',
      'Use checkboxes for candidate selection and bulk delete operations.'
    ]
  );

  drawScreenshot(screenshots.candidateList, 'Administrator Results Console with Real-Time Search & Unit Filters', 511, 105);

  drawStep(
    '3',
    'Candidate Detailed Inspection & Media Playback',
    'Audit individual candidate submissions and review recorded speaking responses.',
    [
      'In the candidate table, click "View Details" (Eye icon).',
      'Inspect objective item breakdown and read the submitted Writing essay.',
      'Play back candidate Speaking video/audio with full HTTP 206 streaming scrubber controls.'
    ]
  );

  drawScreenshot(screenshots.candidateDetails, 'Candidate Details Modal with Objective Breakdown & Video Stream', 511, 105);

  // =========================================================================
  // PAGE 6: ADMINISTRATOR MANUAL - QUALITATIVE RUBRIC EVALUATION
  // =========================================================================
  doc.addPage();
  drawHeader('Admin Guide: Qualitative Rubric Grading');

  drawSectionTitle('7', 'Interactive 4-Criteria Rubric Grading Matrix');
  drawParagraph(
    'Administrators evaluate qualitative performance in Writing and Speaking using a standardized 4-criteria matrix (1–5 point scale). ' +
    'The system computes criteria totals and assigns official CEFR bands in real time.'
  );

  drawStep(
    '4',
    'Conducting Rubric Evaluation for Writing & Speaking',
    'Grade candidate responses across the 8 qualitative competencies.',
    [
      'Click "Evaluate / Grade" (Pencil icon) on any candidate with "Review required" status.',
      'Writing Criteria (1–5 pts): Task Achievement, Coherence, Lexical Resource, Grammar Accuracy.',
      'Speaking Criteria (1–5 pts): Fluency, Lexical Resource, Grammar Flexibility, Communication/Pronunciation.',
      'Observe the live calculated total points and CEFR band badge (A1–C1).',
      'Click "Save & Finalize Grades" to lock in the candidate’s official placement.'
    ]
  );

  drawScreenshot(screenshots.rubricGrading, 'Interactive 4-Criteria Rubric Grading Modal (Writing & Speaking)', 511, 105);

  drawScreenshot(screenshots.gradesFinalized, 'Finalized Assessment Result with Updated C1 Band and "Teacher Reviewed" Status', 511, 105);

  // =========================================================================
  // PAGE 7: ADMINISTRATOR MANUAL - EXPORTS & CONFIGURATION
  // =========================================================================
  doc.addPage();
  drawHeader('Admin Guide: Exports, Question Bank & Rubrics');

  drawSectionTitle('8', 'Data Exports & Institutional Reporting');
  drawTwoColBox(
    'Single Candidate PDF Certificate',
    '• Click "Export PDF" in any candidate row.\n• Generates centered placement certificate with school branding, certificate serial number (e.g. KBS-EN-2026-1046), CEFR color-coded badge, and placement analysis.',
    'Bulk Excel & PDF Compilation',
    '• Click "Export Excel" in dashboard toolbar for styled .xlsx spreadsheet with formulas & auto-filters across TK, SD, SMP, SMA, SMK.\n• Click "Export PDF" in dashboard toolbar to export a multi-page compilation of all filtered candidate certificates.'
  );

  drawSectionTitle('9', 'Question Bank & Rubric Schema Management');

  drawStep(
    '5',
    'Managing Assessment Content & Question Banks',
    'Update question banks and rubrics without code deployment.',
    [
      'Navigate to "Question Bank" tab to inspect active questions, timing, and keys.',
      'Click "Download Active Question Bank (.json)" for offline backups.',
      'Upload new test packages via "Choose Question Bank JSON" (schema validated).'
    ]
  );

  drawScreenshot(screenshots.questionBank, 'Question Bank Management Interface & JSON Schema Editor', 511, 105);

  drawScreenshot(screenshots.rubricsManagement, 'Rubrics & Standards Management Interface with CEFR Scale Descriptors', 511, 105);

  // =========================================================================
  // PAGE 8: SCORING METHODOLOGY & TROUBLESHOOTING FAQ
  // =========================================================================
  doc.addPage();
  drawHeader('Scoring Methodology & Troubleshooting FAQ');

  drawSectionTitle('10', 'CEFR Scoring Matrix & Placement Rules');

  // Scoring table
  const tableX = 42;
  const tableY = doc.y;
  const colWidths = [125, 80, 80, 110, 116];
  const rowH = 17;

  doc.rect(tableX, tableY, 511, rowH).fill(colors.navy);
  doc.fillColor('#ffffff').fontSize(7.8).font('Helvetica-Bold')
    .text('Skill / Section', tableX + 6, tableY + 4.5)
    .text('Items / Scale', tableX + colWidths[0], tableY + 4.5)
    .text('Scoring Mode', tableX + colWidths[0] + colWidths[1], tableY + 4.5)
    .text('B2 Threshold', tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY + 4.5)
    .text('C1 Threshold', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableY + 4.5);

  const scoreMatrix = [
    ['Listening Comprehension', '15 Items', 'Automated Answer Key', '12–14 / 15 correct', '15 / 15 correct'],
    ['Grammar & Vocabulary', '20 Items', 'Automated Answer Key', '16–18 / 20 correct', '19–20 / 20 correct'],
    ['Reading Comprehension', '15 Items', 'Automated Answer Key', '12–14 / 15 correct', '15 / 15 correct'],
    ['Writing Assessment', '4 Criteria (1–5)', 'Manual Admin Rubric', '14–17 / 20 points', '18–20 / 20 points'],
    ['Speaking Assessment', '4 Criteria (1–5)', 'Manual Admin Rubric', '14–17 / 20 points', '18–20 / 20 points']
  ];

  scoreMatrix.forEach((r, idx) => {
    const ry = tableY + rowH + idx * rowH;
    doc.rect(tableX, ry, 511, rowH).fill(idx % 2 === 0 ? colors.cardBg : '#ffffff');
    doc.rect(tableX, ry, 511, rowH).stroke(colors.line);
    doc.fillColor(colors.slateDark).fontSize(7.2).font('Helvetica-Bold').text(r[0], tableX + 6, ry + 4.5);
    doc.font('Helvetica').fillColor(colors.slateMid)
      .text(r[1], tableX + colWidths[0], ry + 4.5)
      .text(r[2], tableX + colWidths[0] + colWidths[1], ry + 4.5)
      .text(r[3], tableX + colWidths[0] + colWidths[1] + colWidths[2], ry + 4.5)
      .text(r[4], tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], ry + 4.5);
  });
  doc.y = tableY + rowH + scoreMatrix.length * rowH + 8;

  drawSectionTitle('11', 'Frequently Asked Questions & Troubleshooting (FAQ)');
  
  const faqs = [
    ['Q: Camera or microphone permissions blocked?', 'A: Click the lock icon in the browser address bar, toggle Camera and Microphone to "Allow", and refresh the diagnostic page.'],
    ['Q: Network interrupted during examination?', 'A: Assessify caches answers in browser localStorage. Simply reconnect and refresh; your session will restore automatically.'],
    ['Q: How to modify a finalized rubric grade?', 'A: Administrators can open "Evaluate / Grade" at any time to adjust criteria. The overall CEFR band will recompute immediately.'],
    ['Q: How to back up candidate records?', 'A: Export the complete database to Excel (.xlsx) from the Results tab and download active Question Banks/Rubrics JSON files.']
  ];

  faqs.forEach(([q, a]) => {
    doc.rect(42, doc.y, 511, 24).fillAndStroke(colors.cardBg, colors.line);
    doc.rect(42, doc.y, 3, 24).fill(colors.blue);
    doc.fillColor(colors.navy).fontSize(7.8).font('Helvetica-Bold').text(q, 50, doc.y + 3.5);
    doc.fillColor(colors.slateMid).fontSize(7.2).font('Helvetica').text(a, 50, doc.y + 13, { width: 495 });
    doc.y += 27;
  });

  // Number all pages without creating extra blank pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.rect(0, 816, 595, 26).fill(colors.cardBg);
    doc.rect(0, 816, 595, 0.5).fill(colors.line);
    doc.fillColor(colors.muted).fontSize(7.5).font('Helvetica')
      .text('Assessify Official System User Manual · Yayasan Karya Bangsa (TK, SD, SMP, SMA, SMK)', 42, 824);
    doc.fillColor(colors.navy).fontSize(8).font('Helvetica-Bold')
      .text(`Page ${i + 1} of ${totalPages}`, 450, 824, { width: 103, align: 'right' });
  }

  doc.end();
  console.log(`✅ Successfully generated User Manual PDF: ${outputPath} (${totalPages} pages)`);
}

buildUserManualPDF();
