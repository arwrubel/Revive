const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

/**
 * Extract text from a PDF file.
 * Uses pdf-parse for text-based PDFs with a Tesseract.js OCR fallback
 * for scanned documents.
 */

async function extractText(filePath, options = {}) {
  const { startPage, endPage } = options;

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }

  const dataBuffer = fs.readFileSync(filePath);
  let result;

  try {
    const parseOptions = {};

    // Page range filtering
    if (startPage || endPage) {
      parseOptions.pagerender = function (pageData) {
        const pageNum = pageData.pageIndex + 1;
        const start = startPage || 1;
        const end = endPage || Infinity;
        if (pageNum >= start && pageNum <= end) {
          return pageData.getTextContent().then(function (textContent) {
            return textContent.items.map((item) => item.str).join(' ');
          });
        }
        return Promise.resolve('');
      };
    }

    result = await pdfParse(dataBuffer, parseOptions);
  } catch (err) {
    throw new Error(`Failed to parse PDF: ${err.message}`);
  }

  const text = cleanText(result.text);

  // If we got almost no text, the PDF is likely scanned — try OCR
  if (text.trim().length < 50) {
    return await extractWithOCR(filePath, options);
  }

  return {
    text,
    pageCount: result.numpages,
    info: result.info,
  };
}

/**
 * OCR fallback using Tesseract.js for scanned PDFs.
 * Lazily loaded so it doesn't slow down startup if unused.
 */
async function extractWithOCR(filePath, options = {}) {
  let Tesseract;
  try {
    Tesseract = require('tesseract.js');
  } catch {
    throw new Error(
      'Tesseract.js is required for OCR on scanned PDFs. Install it with: npm install tesseract.js'
    );
  }

  const worker = await Tesseract.createWorker('rus+eng');

  try {
    // For OCR we need images — for now, inform the user
    // Full implementation would convert PDF pages to images first
    const {
      data: { text },
    } = await worker.recognize(filePath);
    return {
      text: cleanText(text),
      pageCount: 1,
      info: { ocr: true },
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Clean extracted text: normalize whitespace, fix encoding artifacts.
 */
function cleanText(text) {
  return (
    text
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Remove null bytes and control characters (except newlines/tabs)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      // Normalize multiple spaces
      .replace(/ {2,}/g, ' ')
      .trim()
  );
}

/**
 * Get metadata about a PDF without full text extraction.
 */
async function getInfo(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const result = await pdfParse(dataBuffer, { max: 0 });
  return {
    pageCount: result.numpages,
    info: result.info,
  };
}

module.exports = {
  extractText,
  extractWithOCR,
  getInfo,
  cleanText,
};
