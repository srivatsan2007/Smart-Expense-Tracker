require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./db');

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/backend/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/salaries', require('./routes/salaryRoutes'));
app.use('/api/savings', require('./routes/savingsRoutes'));
app.use('/api/budget', require('./routes/budgetRoutes'));
app.use('/api/ocr', require('./routes/ocrRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/bills', require('./routes/billRoutes'));

// Serve frontend static files
const distPath = path.join(__dirname, '../frontend-react/dist');
const indexPath = path.join(distPath, 'index.html');

app.use(express.static(distPath));

// Fallback to index.html for client-side SPA routing (excluding API routes)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>RupeeRise - Building Application</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
        .card { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; max-width: 520px; text-align: center; }
        h1 { color: #38bdf8; font-size: 22px; margin: 0 0 12px; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
        code { background: #0f172a; padding: 6px 12px; border-radius: 6px; color: #38bdf8; font-family: monospace; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Frontend Build in Progress</h1>
        <p>The static assets are being compiled or were not generated. On Render, set your <b>Build Command</b> to:</p>
        <p><code>npm run build</code></p>
      </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
