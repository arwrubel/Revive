# Revive

Convert legacy educational PDFs into modern, interactive HTML quizzes.

Built for DLPT (Defense Language Proficiency Test) preparation materials — supports bilingual Russian/English content, audio listening comprehension, and generates standalone offline-capable quiz files.

## Features

- **PDF to Quiz** — Upload a PDF, extract questions with AI, download an interactive HTML quiz
- **Bilingual Support** — Russian reading passages with English questions, proper Cyrillic punctuation
- **Audio Support** — Upload audio for listening comprehension with configurable play limits
- **Standalone Output** — Generated HTML files work offline with no external dependencies
- **DLPT-style** — Play counters, transcript-after-answer, timed conditions

## Quick Start

```bash
cd backend
cp .env.template .env
# Edit .env and add your ANTHROPIC_API_KEY
npm install
npm run dev
```

Server starts on `http://localhost:3001`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/upload` | Upload a PDF (multipart, field: `pdf`) |
| POST | `/api/process` | Extract questions from uploaded PDF |
| POST | `/api/export/html` | Generate interactive HTML quiz |
| GET | `/api/export/download/:filename` | Download generated quiz |
| POST | `/api/audio/upload` | Upload audio file (field: `audio`) |
| GET | `/api/audio/stream/:filename` | Stream audio file |
| POST | `/api/audio/base64` | Get Base64 data URI for audio |

## Example Workflow

```bash
# 1. Upload a PDF
curl -X POST http://localhost:3001/api/upload \
  -F "pdf=@my-quiz.pdf"
# → { "fileId": "1234567890-..." }

# 2. Extract questions
curl -X POST http://localhost:3001/api/process \
  -H "Content-Type: application/json" \
  -d '{"fileId": "1234567890-...", "addPunctuation": true, "language": "mixed"}'
# → { "questions": [...] }

# 3. Generate HTML quiz
curl -X POST http://localhost:3001/api/export/html \
  -H "Content-Type: application/json" \
  -d '{"title": "Russian Reading Quiz", "questions": [...]}'
# → { "downloadUrl": "/api/export/download/quiz-abc123.html" }

# 4. Download
curl -O http://localhost:3001/api/export/download/quiz-abc123.html
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required for AI question extraction |
| `PORT` | 3001 | Server port |
| `NODE_ENV` | development | Environment |
| `MAX_FILE_SIZE_MB` | 50 | Max upload size |

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **PDF Parsing:** pdf-parse (+ Tesseract.js OCR fallback)
- **AI:** Claude API via @anthropic-ai/sdk
- **Audio:** Native file handling, Base64 encoding

## License

MIT
