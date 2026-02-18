const express = require('express');
const path = require('path');
const fs = require('fs');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const pdfService = require('../services/pdfService');
const claudeService = require('../services/claudeService');

const router = express.Router();

/**
 * POST /api/process
 * Extract questions from an uploaded PDF using Claude AI.
 *
 * Body: {
 *   fileId: string,
 *   addPunctuation?: boolean (default true),
 *   language?: "russian" | "english" | "mixed" (default "mixed"),
 *   questionType?: "reading" | "listening" | "mixed" (default "reading"),
 *   startPage?: number,
 *   endPage?: number
 * }
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      fileId,
      addPunctuation = true,
      language = 'mixed',
      questionType = 'reading',
      startPage,
      endPage,
    } = req.body;

    if (!fileId) {
      throw createError(400, 'fileId is required.');
    }

    // Find the uploaded PDF
    const uploadsDir = path.join(__dirname, '../../uploads/pdf');
    const files = fs.readdirSync(uploadsDir);
    const pdfFile = files.find((f) => f.startsWith(fileId));

    if (!pdfFile) {
      throw createError(404, `PDF not found for fileId: ${fileId}`);
    }

    const filePath = path.join(uploadsDir, pdfFile);

    // Extract text from PDF
    const extracted = await pdfService.extractText(filePath, {
      startPage,
      endPage,
    });

    if (!extracted.text || extracted.text.trim().length === 0) {
      throw createError(
        422,
        'No text could be extracted from this PDF. It may be image-only or corrupted.'
      );
    }

    // Send to Claude for question extraction
    const questions = await claudeService.extractQuestions(extracted.text, {
      addPunctuation,
      language,
      questionType,
    });

    res.json({
      fileId,
      pageCount: extracted.pageCount,
      questionCount: questions.length,
      questions,
    });
  })
);

module.exports = router;
