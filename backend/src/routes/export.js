const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const htmlService = require('../services/htmlService');

const router = express.Router();

/**
 * POST /api/export/html
 * Generate a standalone interactive HTML quiz.
 *
 * Body: {
 *   title?: string,
 *   questions: Array,
 *   language?: "russian" | "english" | "mixed",
 *   maxPlays?: number (audio play limit, default 2)
 * }
 */
router.post(
  '/html',
  asyncHandler(async (req, res) => {
    const {
      title = 'Interactive Quiz',
      questions,
      language = 'mixed',
      maxPlays = 2,
    } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw createError(400, 'questions array is required and must not be empty.');
    }

    const html = htmlService.generateQuizHTML({
      title,
      questions,
      language,
      maxPlays,
      audioFiles: {}, // Audio files would be resolved from uploaded audio
    });

    const id = crypto.randomBytes(8).toString('hex');
    const filename = `quiz-${id}.html`;
    const filePath = htmlService.saveQuizHTML(html, filename);

    res.json({
      filename,
      downloadUrl: `/api/export/download/${filename}`,
      questionCount: questions.length,
    });
  })
);

/**
 * GET /api/export/download/:filename
 * Download a generated quiz HTML file.
 */
router.get(
  '/download/:filename',
  asyncHandler(async (req, res) => {
    const filename = req.params.filename;

    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      throw createError(400, 'Invalid filename.');
    }

    const filePath = path.join(__dirname, '../../exports', filename);

    res.download(filePath, filename, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: { message: 'File not found.' } });
      }
    });
  })
);

module.exports = router;
