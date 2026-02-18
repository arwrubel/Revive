# CLAUDE.md - Revive Project Guide

## What is this project?
Revive is a Node.js/Express backend that converts legacy educational PDFs (especially DLPT-style Russian/English language assessments) into standalone interactive HTML quizzes. Users upload a PDF, the server extracts text, sends it to Claude API for structured question extraction, then generates a self-contained HTML quiz file.

## Project structure
```
backend/
  src/
    server.js          - Express app entry point (port 3001)
    routes/
      upload.js        - POST /api/upload (PDF upload via multer)
      process.js       - POST /api/process (extract questions via Claude)
      export.js        - POST /api/export/html, GET /api/export/download/:filename
      audio.js         - POST /api/audio/upload, GET /api/audio/stream/:filename, POST /api/audio/base64
    services/
      pdfService.js    - PDF text extraction (pdf-parse + Tesseract.js OCR fallback)
      claudeService.js - Claude API integration for question extraction
      htmlService.js   - Generate standalone HTML quiz files
      audioService.js  - Audio file validation, Base64 conversion, streaming
    middleware/
      errorHandler.js  - Error handling + asyncHandler wrapper
  uploads/pdf/         - Uploaded PDFs (gitignored)
  uploads/audio/       - Uploaded audio files (gitignored)
  exports/             - Generated HTML quiz files (gitignored)
```

## How to run
```bash
cd backend
cp .env.template .env   # Then add your ANTHROPIC_API_KEY
npm install
npm run dev             # nodemon for development
npm start               # production
```

## Key commands
- `npm run dev` — start dev server with auto-reload
- `npm start` — start production server
- `curl http://localhost:3001/health` — health check

## API flow
1. `POST /api/upload` (multipart, field: "pdf") → returns `fileId`
2. `POST /api/process` (JSON: `{fileId, addPunctuation, language, questionType}`) → returns `questions[]`
3. `POST /api/export/html` (JSON: `{title, questions, language, maxPlays}`) → returns `downloadUrl`
4. `GET /api/export/download/:filename` → downloads the HTML file

## Critical domain rules

### Russian punctuation (applied by claudeService)
- Guillemets `«»` for all quotes in Russian text — never `""` or `""`
- Em-dashes `—` for dialogue and ranges — never hyphens `-`
- Commas before subordinating conjunctions: что, который, где, когда, если, чтобы

### DLPT-style audio behavior
- Audio play limit (default 2 plays per question) — counter decrements, button disables at 0
- Transcripts are hidden until AFTER the user answers — no toggle button, automatic reveal only
- This mirrors real DLPT test conditions

### Generated HTML quizzes
- Must be 100% standalone — no external dependencies, works offline
- All CSS/JS is inline
- Audio embedded as Base64 data URIs
- UTF-8 encoding for Cyrillic support

## Code conventions
- All async route handlers wrapped with `asyncHandler()` from errorHandler.js
- Errors use `createError(statusCode, message)` pattern
- Services are stateless modules — no classes, just exported functions
- Environment config via dotenv (.env file)

## Common pitfalls
- Always use UTF-8 when writing files with Cyrillic content
- The `pdf-parse` library returns empty text for scanned PDFs — that's when OCR kicks in
- Claude API responses may include markdown fences around JSON — `parseQuestionsFromResponse` handles this
- The htmlService embeds a full JS quiz engine as a string template — be careful with quote escaping
