# Revive — Project Plan

## Architecture

```
User → [Upload PDF] → Express Server → [pdf-parse / Tesseract OCR]
                                      → [Claude API] → Structured Questions JSON
                                      → [HTML Generator] → Standalone Quiz File
```

### Data Flow

1. **Upload**: PDF file saved to `uploads/pdf/`, assigned a `fileId`
2. **Process**: Text extracted from PDF, chunked if large, sent to Claude API for structured question extraction
3. **Export**: Questions array fed into HTML template engine, producing a single self-contained `.html` file
4. **Download**: User downloads the HTML file — works offline, no server needed

### Services

| Service | Responsibility |
|---------|---------------|
| `pdfService` | Text extraction from PDF (text-layer + OCR fallback) |
| `claudeService` | AI-powered question extraction with Russian punctuation |
| `htmlService` | Standalone HTML quiz generation with embedded CSS/JS |
| `audioService` | Audio file validation, Base64 encoding, streaming |

## Roadmap

### Phase 1 — Core Backend (current)
- [x] Express server with REST API
- [x] PDF upload and text extraction
- [x] Claude API integration for question extraction
- [x] HTML quiz generation
- [x] Audio file support

### Phase 2 — Frontend UI
- [ ] Web-based upload interface
- [ ] Real-time processing status
- [ ] Quiz preview before download
- [ ] Question editor (manual corrections)

### Phase 3 — Enhancements
- [ ] Batch PDF processing
- [ ] Question bank management
- [ ] Multiple export formats (PDF quiz, SCORM)
- [ ] User accounts and quiz history
