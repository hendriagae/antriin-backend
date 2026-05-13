const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  openQueue,
  closeQueue,
  takeNumber,
  callNext,
  skipEntry,
  cancelEntry,
  getStatus,
  getTodayQueue,
  doneEntry
} = require('../controllers/queueController');

// Route untuk merchant (butuh login)
router.post('/open', auth, openQueue);
router.post('/close', auth, closeQueue);
router.post('/call-next', auth, callNext);
router.post('/skip', auth, skipEntry);
router.post('/done', auth, doneEntry);
router.get('/today', auth, getTodayQueue);

// Route untuk pelanggan (tidak butuh login)
router.post('/take', takeNumber);
router.post('/cancel', cancelEntry);
router.get('/status/:id', getStatus);

module.exports = router;