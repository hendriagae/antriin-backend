const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./cron');

const authRoutes = require('./routes/auth');
const queueRoutes = require('./routes/queue');
const merchantRoutes = require('./routes/merchant');
const uploadRoutes = require('./routes/upload');
const subscriptionRoutes = require('./routes/subscription');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: 'Antriin API berjalan!',
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`Antriin backend berjalan di port ${PORT}`);
});