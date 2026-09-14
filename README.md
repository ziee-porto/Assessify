# Assessify

Assessify is an placement test application for teachers at Karya Bangsa School.

## Features

- Four test sections: Grammar & Vocabulary, Reading, Listening, Writing, and Speaking
- IELTS-aligned scoring rubrics in `content/ielts-rubrics.json`
- Server-enforced 60-minute assessment window
- JSON question content in `content/ielts-placement.json`
- Teacher test-taking flow with autosave status
- Role-protected admin results dashboard
- Admin exports in Excel (`.xlsx`) and PDF (`.pdf`)
- School-domain session login with teacher/admin roles
- MySQL / MariaDB repository adapter with an automatic in-memory development fallback (no Docker required)
- Staged video & audio recording storage: saves to MySQL database buffer, uploads to Google Drive, and purges binary data from the database

## Run

```powershell
npm install
npm run check
npm run dev # or npm start
```

Open http://localhost:3000. Sign in with a school-domain email. The current local role selector stands in for Google Workspace/OIDC until provider credentials are configured. Set `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` in `.env` to connect to MySQL; without them, the app automatically runs in-memory with zero setup required.

Teacher test data is saved in MySQL database `assessify`, tables `attempts` and `attempt_recordings`. Each attempt contains the teacher identity, answers, section scores, rubric criterion scores, overall band, Speaking transcript, and recording metadata.

Admins can download the complete teacher results report from the dashboard using the Excel and PDF buttons.

When a teacher reaches Speaking, Assessify requests camera/microphone permission, starts a browser `MediaRecorder` video/audio capture, and runs browser speech recognition when supported. Listening prompts have a Play question audio action using browser text-to-speech. Submission buffers the recording directly into MySQL, uploads the file to Google Drive, purges the heavy binary payload from MySQL, and calculates provisional bands for all sections.

The question bank uses original practice content modeled on official IELTS task formats, including objective Reading/Listening items, Writing task-response prompts, and Speaking prompts.

## Automated Writing and Speaking scoring

Assessify uses four equally weighted IELTS-aligned criteria for each skill:

- Writing: Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy
- Speaking: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation

The current implementation produces a **provisional placement estimate** from the submitted text/transcript, rounded to half bands. It is not an official IELTS score. Pronunciation cannot be reliably assessed from typed text; production Speaking scoring should accept an audio recording and use a validated speech assessment service or trained teacher review.

Reference: [IELTS scoring in detail](https://ielts.org/organisations/ielts-for-organisations/ielts-scoring-in-detail), including the official criterion definitions and the rule that overall scores are the average of four section bands rounded to the nearest half band.

## Google Workspace & Google Drive setup

Enable the Google Drive API in Google Cloud and create a Web application OAuth client. Add its callback URL to the client's authorized redirect URIs, then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Optionally, set `GOOGLE_DRIVE_FOLDER_ID` to direct uploads into a specific folder. Sign in as an Assessify admin and open `/api/admin/google-workspace/connect` once to authorize Google Drive file storage (`https://www.googleapis.com/auth/drive.file`). Candidate speaking video and audio recordings will automatically be buffered to MySQL, uploaded to Google Drive, and purged from MySQL, with direct preview links available in the Admin inspection portal.

## Next implementation slice

Replace the local login selector with Google Workspace/OIDC, add object storage for audio and recordings, and add teacher review forms for Writing and Speaking.
