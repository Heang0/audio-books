const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ========== EASY CORS SETTINGS ==========
app.use(cors({
  origin: '*', // Allow ALL origins (easy mode)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: false
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/audio-articles')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB error:', err.message));

// ========== API ROUTES ==========
app.use('/api/auth', require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/upload', require('./routes/upload'));

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    time: new Date().toLocaleTimeString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ========== PAGES ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/article', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/article.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/upload.html'));
});

app.get('/manage-categories', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/manage-categories.html'));
});

// For any other route, serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server started!');
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📱 Phone: http://YOUR_IP:${PORT} (replace YOUR_IP)`);
  console.log(`✅ API: http://localhost:${PORT}/api/health`);
});