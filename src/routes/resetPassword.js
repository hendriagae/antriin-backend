const express = require('express');
const router = express.Router();
const { requestReset, resetPassword } = require('../controllers/resetPasswordController');

router.post('/request', requestReset);
router.post('/reset', resetPassword);

module.exports = router;