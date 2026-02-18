# Bilingual Support (Russian/English)

## Overview

Revive handles bilingual educational content where reading passages are in Russian (Cyrillic) and questions/options are in English.

## Encoding

All text processing uses UTF-8 throughout the pipeline:
- PDF text extraction preserves Cyrillic characters
- Claude API handles multilingual content natively
- Generated HTML uses `<meta charset="UTF-8">`
- JSON responses use proper Unicode encoding

## Russian Punctuation Rules

The Claude API prompt enforces these rules on all Russian text:

### Guillemets «»
Russian text uses guillemets instead of straight or curly quotes:
```
"Radio Lumiere"  →  «Radio Lumiere»
"Время"          →  «Время»
```

### Em-dashes —
Used for dialogue, attributive constructions, and ranges:
```
- Здравствуйте   →  — Здравствуйте
1941-1945        →  1941—1945
Москва - столица →  Москва — столица
```

### Comma placement
Commas are required before subordinating conjunctions:
```
выяснили что     →  выяснили, что
сказал что       →  сказал, что
знает где        →  знает, где
```

Conjunctions that require preceding commas:
- что, который, которая, которое, которые
- где, когда, если, чтобы
- потому что, так как, хотя, пока, как только

## UI Language

The generated HTML supports three UI language modes:

| Mode | Passage labels | Buttons | Score text |
|------|---------------|---------|------------|
| `russian` | «Текст для чтения» | Назад / Далее | Результаты |
| `english` | Reading Passage | Previous / Next | Results |
| `mixed` | «Текст для чтения» (Russian passages), Reading Passage (English) | Previous / Next | Results |

## Language Detection

The `passageLanguage` and `questionLanguage` fields on each question object indicate the language of each component. The HTML renderer uses these to set the `lang` attribute on DOM elements for proper font rendering.
