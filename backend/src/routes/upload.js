const express = require('express');
const path = require('path');
const fs = require('fs');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const pdfService = require('../services/pdfService');

const router = express.Router();

/**
 * POST /api/upload
 * Upload a PDF file for processing.
 * Expects multipart/form-data with field "pdf".
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createError(400, 'No PDF file uploaded. Use field name "pdf".');
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
      throw createError(400, 'Only PDF files are accepted.');
    }

    // Get basic info about the PDF
    let info;
    try {
      info = await pdfService.getInfo(req.file.path);
    } catch {
      info = { pageCount: null, info: {} };
    }

    res.json({
      fileId: path.basename(req.file.filename, ext),
      filename: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      pageCount: info.pageCount,
    });
  })
);

module.exports = router;
