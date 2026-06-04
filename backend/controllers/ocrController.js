const multer = require('multer');
const path = require('path');
const tesseract = require('tesseract.js');
const fs = require('fs');

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'backend/uploads/receipts/');
  },
  filename: function (req, file, cb) {
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images Only (jpeg, jpg, png)!');
    }
  }
});

// @desc    Upload and parse receipt via OCR
// @route   POST /api/ocr/scan
// @access  Private
const scanReceipt = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const imagePath = req.file.path;
    
    // Perform OCR
    const { data: { text } } = await tesseract.recognize(imagePath, 'eng');
    
    // Simple Regex patterns to extract amount and date (Basic implementation)
    const amountMatch = text.match(/\$?\d+(\.\d{2})?/); // Basic amount regex
    const dateMatch = text.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/); // Basic date regex MM/DD/YYYY or similar

    const amount = amountMatch ? parseFloat(amountMatch[0].replace('$', '')) : null;
    const date = dateMatch ? dateMatch[0] : null;

    res.json({
      success: true,
      text: text, // full text for debugging/confirmation
      extracted: {
        amount,
        date
      },
      fileUrl: `/${imagePath.replace(/\\/g, '/')}`
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  upload,
  scanReceipt
};
