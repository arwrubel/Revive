# Audio Support

## Supported Formats

| Format | Extension | MIME Type |
|--------|-----------|-----------|
| MP3 | .mp3 | audio/mpeg |
| WAV | .wav | audio/wav |
| OGG | .ogg | audio/ogg |
| M4A | .m4a | audio/mp4 |
| WebM | .webm | audio/webm |

## Upload

```bash
curl -X POST http://localhost:3001/api/audio/upload \
  -F "audio=@listening-passage.mp3"
```

Returns:
```json
{
  "audioId": "1234567890-...",
  "filename": "listening-passage.mp3",
  "mimeType": "audio/mpeg",
  "sizeMB": "2.45",
  "streamUrl": "/api/audio/stream/1234567890-....mp3"
}
```

## Embedding in Quizzes

Audio is embedded in generated HTML as Base64 data URIs. This makes the quiz file completely self-contained — no server needed to play audio.

For large audio files, streaming via URL is also supported during development, but the exported HTML always uses Base64 embedding.

## DLPT-style Play Limits

The generated quiz enforces play limits on audio:

- **Default**: 2 plays per question (configurable via `maxPlays`)
- **Behavior**: Play counter decrements each time audio is played
- **At zero**: Play button is disabled, no more plays allowed
- **On reset**: Play counter resets to the configured maximum

This mirrors the real DLPT testing environment where candidates can only hear audio a limited number of times.

## Transcript Behavior

Transcripts follow strict DLPT rules:

1. **Before answering**: Transcript is completely hidden — not visible, no toggle button
2. **After answering**: Transcript automatically appears below the feedback
3. **No toggle**: There is no button to show/hide the transcript — it either shows or doesn't based on whether the question has been answered

This prevents test-takers from reading the transcript before attempting to comprehend the audio, which would defeat the purpose of a listening comprehension test.
