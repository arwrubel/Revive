const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_CHUNK_SIZE = 12000; // characters per chunk to stay within context limits

/**
 * Extract structured quiz questions from PDF text using Claude.
 *
 * @param {string} text - Raw text extracted from a PDF
 * @param {object} options
 * @param {boolean} options.addPunctuation - Apply Russian punctuation rules
 * @param {string} options.language - "russian", "english", or "mixed"
 * @param {string} options.questionType - "reading", "listening", or "mixed"
 * @returns {Promise<Array>} Array of question objects
 */
async function extractQuestions(text, options = {}) {
  const { addPunctuation = true, language = 'mixed', questionType = 'reading' } = options;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your .env file.'
    );
  }

  const chunks = chunkText(text, MAX_CHUNK_SIZE);
  const allQuestions = [];

  for (let i = 0; i < chunks.length; i++) {
    const questions = await processChunk(chunks[i], {
      addPunctuation,
      language,
      questionType,
      chunkIndex: i,
      totalChunks: chunks.length,
    });
    allQuestions.push(...questions);
  }

  // Re-number questions sequentially
  return allQuestions.map((q, idx) => ({
    ...q,
    id: idx + 1,
  }));
}

/**
 * Process a single chunk of text through Claude.
 */
async function processChunk(text, options) {
  const { addPunctuation, language, questionType, chunkIndex, totalChunks } = options;

  const systemPrompt = buildSystemPrompt({ addPunctuation, language, questionType });
  const userPrompt = buildUserPrompt(text, { chunkIndex, totalChunks });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return parseQuestionsFromResponse(responseText);
}

/**
 * Build the system prompt for question extraction.
 */
function buildSystemPrompt({ addPunctuation, language, questionType }) {
  let prompt = `You are an expert educational content processor specializing in bilingual (Russian/English) assessment materials, particularly DLPT-style tests.

TASK: Extract questions from the provided text and return them as structured JSON.

OUTPUT FORMAT: Return ONLY a valid JSON array. No markdown, no explanation, no wrapping.

Each question object must have:
{
  "id": <number>,
  "type": "reading" | "listening",
  "passage": "<the reading passage, if any>",
  "passageLanguage": "russian" | "english",
  "question": "<the question text>",
  "questionLanguage": "english",
  "options": [
    { "label": "A", "text": "<option text>" },
    { "label": "B", "text": "<option text>" },
    { "label": "C", "text": "<option text>" },
    { "label": "D", "text": "<option text>" }
  ],
  "correctAnswer": "<A|B|C|D or null if unknown>",
  "explanation": "<brief explanation or empty string>"
}`;

  if (addPunctuation) {
    prompt += `

RUSSIAN PUNCTUATION RULES (apply to all Russian text):
- Use guillemets «» for quotes and titles, never straight quotes "" or typographic quotes ""
  Example: "Radio Lumiere" → «Radio Lumiere»
- Use em-dashes — (not hyphens -) for dialogue, attributive constructions, and ranges
  Example: "- Здравствуйте" → "— Здравствуйте"
  Example: "1941-1945" → "1941—1945"
- Insert commas before subordinating conjunctions: что, который, где, когда, если, чтобы, потому что, так как, хотя, пока, как
  Example: "выяснили что" → "выяснили, что"
- Insert commas around participial and adverbial phrases
- Use a comma before "и" only when it joins independent clauses`;
  }

  if (language === 'mixed') {
    prompt += `

LANGUAGE HANDLING:
- Preserve the ORIGINAL language of each text segment — do NOT translate
- Reading passages are typically in Russian (Cyrillic)
- Questions and answer options are typically in English
- Set passageLanguage and questionLanguage fields accordingly`;
  }

  if (questionType === 'listening') {
    prompt += `

LISTENING QUESTIONS:
- Mark type as "listening"
- The passage field may contain a transcript (or be empty if audio-only)
- Include any context clues about the audio content`;
  }

  return prompt;
}

/**
 * Build the user-facing prompt with the text chunk.
 */
function buildUserPrompt(text, { chunkIndex, totalChunks }) {
  let prompt = `Extract all questions from the following educational text and return them as a JSON array.\n\n`;

  if (totalChunks > 1) {
    prompt += `(This is chunk ${chunkIndex + 1} of ${totalChunks}. Continue numbering from previous chunks.)\n\n`;
  }

  prompt += `--- BEGIN TEXT ---\n${text}\n--- END TEXT ---`;

  return prompt;
}

/**
 * Parse the JSON question array from Claude's response.
 */
function parseQuestionsFromResponse(responseText) {
  // Strip markdown code fences if present
  let cleaned = responseText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
    return parsed;
  } catch (err) {
    // Try to find a JSON array in the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    throw new Error(
      `Failed to parse Claude response as JSON: ${err.message}\nResponse: ${cleaned.substring(0, 200)}...`
    );
  }
}

/**
 * Split text into chunks that fit within context limits.
 */
function chunkText(text, maxSize) {
  if (text.length <= maxSize) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }

    // Try to break at a paragraph boundary
    let breakPoint = remaining.lastIndexOf('\n\n', maxSize);
    if (breakPoint < maxSize * 0.5) {
      // Fallback: break at sentence boundary
      breakPoint = remaining.lastIndexOf('. ', maxSize);
    }
    if (breakPoint < maxSize * 0.3) {
      // Fallback: break at space
      breakPoint = remaining.lastIndexOf(' ', maxSize);
    }
    if (breakPoint <= 0) {
      breakPoint = maxSize;
    }

    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}

/**
 * Apply Russian punctuation rules to a text string (standalone utility).
 */
function applyRussianPunctuation(text) {
  let result = text;

  // Straight/typographic quotes → guillemets
  result = result.replace(/[""\u201C\u201D]([^""\u201C\u201D]+)[""\u201C\u201D]/g, '«$1»');

  // Hyphen at start of dialogue line → em-dash
  result = result.replace(/^- /gm, '— ');
  result = result.replace(/ - /g, ' — ');

  // Comma before subordinating conjunctions (when missing)
  const conjunctions = ['что', 'который', 'которая', 'которое', 'которые', 'где', 'когда', 'если', 'чтобы', 'потому что', 'так как', 'хотя', 'пока', 'как только'];
  for (const conj of conjunctions) {
    const regex = new RegExp(`([а-яА-ЯёЁ])\\s+(${conj})\\b`, 'g');
    result = result.replace(regex, `$1, $2`);
  }

  return result;
}

module.exports = {
  extractQuestions,
  applyRussianPunctuation,
  parseQuestionsFromResponse,
  chunkText,
};
