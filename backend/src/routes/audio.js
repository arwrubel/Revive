const express = require('express');
const path = require('path');
const multer = require('multer');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const audioService = require('../services/audioService');

const router = express.Router();

// Audio file upload config
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/audio'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const audioUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * POST /api/audio/upload
 * Upload an audio file for use in listening comprehension questions.
 */
router.post(
  '/upload',
  audioUpload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createError(400, 'No audio file uploaded. Use field name "audio".');
    }

    const validation = audioService.validateAudioFile(req.file);
    if (!validation.valid) {
      // Clean up invalid file
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
      throw createError(400, validation.error);
    }

    const info = audioService.getAudioInfo(req.file.path);

    res.json({
      audioId: path.basename(req.file.filename, path.extname(req.file.filename)),
      filename: req.file.originalname,
      ...info,
      streamUrl: `/api/audio/stream/${req.file.filename}`,
    });
  })
);

/**
 * GET /api/audio/stream/:filename
 * Stream an audio file.
 */
router.get(
  '/stream/:filename',
  asyncHandler(async (req, res) => {
    const filename = req.params.filename;

    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      throw createError(400, 'Invalid filename.');
    }

    const filePath = path.join(__dirname, '../../uploads/audio', filename);
    const info = audioService.getAudioInfo(filePath);

    res.setHeader('Content-Type', info.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    const stream = audioService.createAudioStream(filePath);
    stream.pipe(res);
  })
);

/**
 * POST /api/audio/base64
 * Convert an uploaded audio file to Base64 data URI.
 * Body: { audioId: string }
 */
router.post(
  '/base64',
  asyncHandler(async (req, res) => {
    const { audioId } = req.body;
    if (!audioId) {
      throw createError(400, 'audioId is required.');
    }

    const fs = require('fs');
    const audioDir = path.join(__dirname, '../../uploads/audio');
    const files = fs.readdirSync(audioDir);
    const audioFile = files.find((f) => f.startsWith(audioId));

    if (!audioFile) {
      throw createError(404, `Audio file not found for audioId: ${audioId}`);
    }

    const filePath = path.join(audioDir, audioFile);
    const dataURI = audioService.toBase64DataURI(filePath);

    res.json({ audioId, dataURI });
  })
);

module.exports = router;
