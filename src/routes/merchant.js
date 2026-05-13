const express = require('express');
const router = express.Router();
const { getMerchant } = require('../controllers/merchantController');

router.get('/:id', getMerchant);

module.exports = router;