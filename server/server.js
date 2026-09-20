const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const trackerRoutes = require('./routes/tracker');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Cron-Secret']
}));

app.use(express.json());

// Routes
app.use('/api', trackerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    supabaseConfigured: !!(process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder'))
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Express Global Error]', err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error', details: err.message });
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 INE Scrapper Backend Server listening on port ${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log('====================================================');
});
