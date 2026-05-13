const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { upload, uploadLogo, updateBranding, getSettings } = require('../controllers/uploadController');

// Upload logo (butuh login)
router.post('/logo', auth, upload.single('logo'), uploadLogo);

// Update branding (butuh login)
router.put('/branding', auth, updateBranding);

// Ambil settings toko (public)
router.get('/settings/:merchant_id', getSettings);

module.exports = router;