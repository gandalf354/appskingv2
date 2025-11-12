const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('📊 Environment variables loaded');

const app = express();
const PORT = process.env.PORT || 5001;

// Basic middleware
// Allow CORS from frontend origin(s). In development allow any origin to support Simple Browser / VSCode webviews.
if (process.env.NODE_ENV === 'production') {
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));
} else {
  // In dev, allow requests from any origin (helps Simple Browser / extension webviews)
  app.use(cors({
    origin: true,
    credentials: true
  }));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/payment-methods', require('./routes/paymentMethods'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
// Debug routes (local/dev only)
app.use('/api/debug', require('./routes/debug'));

// Health check
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 AppsKing Finance API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  
  // Test database connection on startup - DISABLED
  // try {
  //   const { testConnection } = require('./config/database');
  //   await testConnection();
  // } catch (error) {
  //   console.error('⚠️  Database connection test failed on startup');
  // }
});

module.exports = app;