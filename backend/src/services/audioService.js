const fs = require('fs');
const path = require('path');

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.webm'];
const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/wave',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
];

const MIME_MAP = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
};

/**
 * Validate that the uploaded file is an accepted audio format.
 */
function validateAudioFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported audio format: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Unsupported MIME type: ${file.mimetype}`,
    };
  }

  return { valid: true };
}

/**
 * Convert an audio file to a Base64 data URI for embedding in HTML.
 */
function toBase64DataURI(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] || 'audio/mpeg';
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');

  return `data:${mimeType};base64,${base64}`;
}

/**
 * Get metadata about an audio file.
 */
function getAudioInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  return {
    filename: path.basename(filePath),
    extension: ext,
    mimeType: MIME_MAP[ext] || 'audio/mpeg',
    sizeBytes: stats.size,
    sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
  };
}

/**
 * Create a read stream for audio file streaming.
 */
function createAudioStream(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }
  return fs.createReadStream(filePath);
}

module.exports = {
  validateAudioFile,
  toBase64DataURI,
  getAudioInfo,
  createAudioStream,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MIME_MAP,
};
