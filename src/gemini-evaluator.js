import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * Clean & extract JSON from Gemini response (even if wrapped in markdown blocks)
 */
function parseGeminiJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from Gemini');
  }

  // Remove markdown code fences if present
  let clean = rawText.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  try {
    return JSON.parse(clean);
  } catch (err) {
    // Attempt regex extraction of first JSON object
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error(`Failed to parse AI response as JSON: ${err.message}`);
  }
}

/**
 * Resolve MIME type for audio/video recordings
 */
function getRecordingMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.webm':
      return 'video/webm';
    case '.mp4':
      return 'video/mp4';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Call Google Gemini API
 */
async function callGeminiApi({ apiKey, model, contents, systemInstruction, temperature = 0.2 }) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please set your Gemini API key in the .env file or Administration Settings.');
  }

  const selectedModel = model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json'
    }
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errJson = await response.json();
          errorDetail = errJson.error?.message || JSON.stringify(errJson);
        } catch {
          errorDetail = await response.text();
        }
        if ((response.status === 503 || response.status === 429) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(`Gemini API error (${response.status}): ${errorDetail}`);
      }

      const data = await response.json();
      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) {
        throw new Error('Gemini API returned an empty completion');
      }

      return parseGeminiJsonResponse(textOutput);
    } catch (err) {
      lastError = err;
      if (attempt < 2 && (err.message.includes('503') || err.message.includes('429') || err.message.includes('high demand'))) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Test API key connectivity
 */
export async function testGeminiConnection(apiKey, model) {
  try {
    const res = await callGeminiApi({
      apiKey,
      model,
      contents: [{ role: 'user', parts: [{ text: 'Respond with JSON: {"status": "ok", "message": "Gemini API connection successful"}' }] }],
      temperature: 0
    });
    return { success: true, result: res };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Evaluate candidate Writing essays against active CEFR rubric
 */
export async function evaluateWritingWithGemini({
  apiKey,
  model,
  attempt,
  rubrics,
  questions
}) {
  const writingRubric = rubrics?.writing || {};
  const activeCriteria = (Array.isArray(writingRubric.criteria) && writingRubric.criteria.length > 0)
    ? writingRubric.criteria
    : [
        { name: 'Task Achievement', description: 'How fully the essay addresses the prompt, thesis clarity, and supporting examples.' },
        { name: 'Coherence and Cohesion', description: 'Logical structure, paragraphing, transitions, and progression.' },
        { name: 'Lexical Resource', description: 'Range, precision, style, and appropriateness of vocabulary.' },
        { name: 'Grammatical Range and Accuracy', description: 'Variety and control of grammatical structures and punctuation.' }
      ];

  const levels = writingRubric.levels || [];

  // Extract written responses from attempt
  const responses = attempt.responses || {};
  let candidateWritingText = '';

  if (responses.writing_essay) {
    candidateWritingText = responses.writing_essay;
  } else if (responses.writing_task_1 || responses.writing_task_2) {
    candidateWritingText = `[TASK 1]:\n${responses.writing_task_1 || 'No response'}\n\n[TASK 2]:\n${responses.writing_task_2 || 'No response'}`;
  } else {
    // Search responses for writing-related entries
    const writingEntries = Object.entries(responses).filter(([k]) => k.toLowerCase().includes('writing'));
    if (writingEntries.length > 0) {
      candidateWritingText = writingEntries.map(([k, v]) => `[${k}]:\n${v}`).join('\n\n');
    }
  }

  if (!candidateWritingText || candidateWritingText.trim().length === 0) {
    return {
      scores: {},
      feedback: 'No candidate writing submission was found for this assessment.',
      strengths: [],
      improvements: ['Ensure the candidate submits their written response before evaluating.']
    };
  }

  const systemInstruction = `You are an expert, certified Cambridge/CEFR English Assessment Senior Examiner at Karya Bangsa School.
Your task is to objectively evaluate a teacher candidate's written English response strictly against the institutional CEFR Rubric.
Score every single criterion with an integer rating from 1 to 6 corresponding to the CEFR levels:
1 = A1 (Beginner)
2 = A2 (Elementary)
3 = B1 (Intermediate)
4 = B2 (Upper-Intermediate)
5 = C1 (Advanced)
6 = C2 (Mastery)

You must output valid JSON following this exact structure:
{
  "scores": {
    "<Criterion Name>": <integer 1-6>
  },
  "feedback": "<concise 2-3 sentence overall evaluation of the candidate's writing performance>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<actionable recommendation 1>", "<actionable recommendation 2>"]
}
Only use the exact criterion names provided. Do not deviate from the JSON format.`;

  const prompt = `EVALUATION CRITERIA & DESCRIPTORS:
${activeCriteria.map((c, i) => `${i + 1}. "${c.name}": ${c.description}`).join('\n')}

CEFR LEVEL DESCRIPTORS:
${levels.map((l) => `Level ${l.level} (Score ${l.score}): ${Array.isArray(l.descriptors) ? l.descriptors.join('; ') : ''}`).join('\n')}

CANDIDATE INFORMATION:
Teacher: ${attempt.teacher || 'Candidate'}
School Unit: ${attempt.unit || 'Karya Bangsa School'}

CANDIDATE WRITTEN SUBMISSION:
"""
${candidateWritingText}
"""

Evaluate the candidate submission against each criterion and provide ratings (1-6) and feedback.`;

  const result = await callGeminiApi({
    apiKey,
    model,
    systemInstruction,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    temperature: 0.2
  });

  // Ensure all active criteria have an integer rating 1-6
  const normalizedScores = {};
  for (const c of activeCriteria) {
    let score = Number(result.scores?.[c.name]);
    if (!Number.isInteger(score) || score < 1 || score > 6) {
      score = 3; // sensible B1 default if missing
    }
    normalizedScores[c.name] = score;
  }

  return {
    scores: normalizedScores,
    feedback: result.feedback || 'Writing evaluation completed against CEFR rubrics.',
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    improvements: Array.isArray(result.improvements) ? result.improvements : []
  };
}

/**
 * Evaluate candidate Speaking audio/video recording against active CEFR rubric
 */
export async function evaluateSpeakingWithGemini({
  apiKey,
  model,
  attempt,
  rubrics,
  uploadsDir
}) {
  const speakingRubric = rubrics?.speaking || {};
  const activeCriteria = (Array.isArray(speakingRubric.criteria) && speakingRubric.criteria.length > 0)
    ? speakingRubric.criteria
    : [
        { name: 'Oral Fluency', description: 'Speech rate, rhythm, natural phrasing, hesitation, and self-correction.' },
        { name: 'Auditory Prompt Comprehension', description: 'Relevance, completeness, and accuracy of answer in response to audio prompts.' },
        { name: 'Grammatical Control', description: 'Accuracy and variety of grammatical structures used during speech.' },
        { name: 'Communicative Efficacy', description: 'Clarity of message, vocabulary sophistication, and pronunciation intelligibility.' }
      ];

  // Find recording file in uploads directory
  const exts = ['.webm', '.mp4', '.wav', '.ogg'];
  let recordingPath = null;
  for (const ext of exts) {
    const candidatePath = join(uploadsDir, `${attempt.id}${ext}`);
    if (existsSync(candidatePath)) {
      recordingPath = candidatePath;
      break;
    }
  }

  const systemInstruction = `You are an expert, certified Cambridge/CEFR English Assessment Senior Oral Examiner at Karya Bangsa School.
Your task is to objectively evaluate a candidate's spoken English performance strictly against the institutional CEFR Speaking Rubric.
Score every single criterion with an integer rating from 1 to 6 corresponding to the CEFR levels:
1 = A1 (Low / Beginner)
2 = A2 (Fair / Elementary)
3 = B1 (Good / Intermediate)
4 = B2 (Very Good / Upper-Intermediate)
5 = C1 (Advanced)
6 = C2 (Mastery)

You must output valid JSON following this exact structure:
{
  "scores": {
    "<Criterion Name>": <integer 1-6>
  },
  "feedback": "<concise 2-3 sentence overall evaluation of the candidate's oral performance, fluency, and pronunciation>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<actionable recommendation 1>", "<actionable recommendation 2>"]
}
Only use the exact criterion names provided. Do not deviate from the JSON format.`;

  const criteriaDescription = `EVALUATION CRITERIA:
${activeCriteria.map((c, i) => `${i + 1}. "${c.name}": ${c.description}`).join('\n')}

CANDIDATE INFORMATION:
Teacher: ${attempt.teacher || 'Candidate'}
School Unit: ${attempt.unit || 'Karya Bangsa School'}`;

  // If no recording file exists on disk
  if (!recordingPath) {
    return {
      scores: {},
      feedback: 'No audio/video recording file found for this attempt on the server.',
      strengths: [],
      improvements: ['Audio recording is required to perform AI speaking evaluation.']
    };
  }

  // Check file size (inlineData limit is ~20MB)
  const fileStat = await stat(recordingPath);
  const sizeMb = fileStat.size / (1024 * 1024);
  if (sizeMb > 20) {
    return {
      scores: {},
      feedback: `The candidate recording is ${sizeMb.toFixed(1)}MB, exceeding the inline processing limit of 20MB.`,
      strengths: [],
      improvements: ['Please review the recording manually or use a compressed recording format.']
    };
  }

  const fileBuffer = await readFile(recordingPath);
  const mimeType = getRecordingMimeType(recordingPath);

  const parts = [
    {
      inlineData: {
        mimeType,
        data: fileBuffer.toString('base64')
      }
    },
    {
      text: `${criteriaDescription}

Listen carefully to the candidate's spoken responses in this media file. Evaluate their fluency, pronunciation clarity, auditory comprehension, grammatical control, and vocabulary range. Assign a score (1-6) for each criterion and provide constructive examiner feedback in JSON format.`
    }
  ];

  const result = await callGeminiApi({
    apiKey,
    model,
    systemInstruction,
    contents: [{ role: 'user', parts }],
    temperature: 0.2
  });

  // Ensure all active criteria have an integer rating 1-6
  const normalizedScores = {};
  for (const c of activeCriteria) {
    let score = Number(result.scores?.[c.name]);
    if (!Number.isInteger(score) || score < 1 || score > 6) {
      score = 3; // sensible B1 default
    }
    normalizedScores[c.name] = score;
  }

  return {
    scores: normalizedScores,
    feedback: result.feedback || 'Speaking oral evaluation completed against CEFR rubrics.',
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    improvements: Array.isArray(result.improvements) ? result.improvements : []
  };
}
