require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50) * 1024 * 1024;

// Ensure upload/export directories exist
const dirs = [
  path.join(__dirname, '../uploads/pdf'),
  path.join(__dirname, '../uploads/audio'),
  path.join(__dirname, '../exports'),
];
for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// PDF upload configuration
const pdfStorage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/pdf'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted.'));
    }
  },
});

// Inject multer middleware into upload route
app.use('/api/upload', pdfUpload.single('pdf'));

// Routes
app.use('/api/upload', require('./routes/upload'));
app.use('/api/process', require('./routes/process'));
app.use('/api/export', require('./routes/export'));
app.use('/api/audio', require('./routes/audio'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
  });
});

// Serve exports directory for downloads
app.use('/exports', express.static(path.join(__dirname, '../exports')));

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Revive server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set. PDF processing will fail.');
  }
});

module.exports = app;
