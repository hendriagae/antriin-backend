const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createTransaction, handleWebhook, getStatus } = require('../controllers/subscriptionController');

// Buat transaksi baru (butuh login)
router.post('/create', auth, createTransaction);

// Webhook dari Midtrans (tidak butuh login)
router.post('/webhook', handleWebhook);

// Cek status subscription (butuh login)
router.get('/status', auth, getStatus);

module.exports = router;