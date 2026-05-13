const multer = require('multer');
const supabase = require('../supabase');

// Konfigurasi multer - simpan di memory
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Max 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan'));
    }
  }
});

// Upload logo merchant
const uploadLogo = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;

    if (!req.file) {
      return res.status(400).json({ error: 'File gambar wajib diupload' });
    }

    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${merchant_id}.${fileExt}`;

    // Upload ke Supabase Storage
    const { data, error } = await supabase.storage
      .from('logos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true // Overwrite jika sudah ada
      });

      console.log('Upload error:', error);
      if (error) throw error;

    // Ambil public URL
    const { data: urlData } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName);

    const logo_url = urlData.publicUrl;

    // Simpan URL ke merchant_settings
    const { error: updateError } = await supabase
      .from('merchant_settings')
      .update({ logo_url })
      .eq('merchant_id', merchant_id);

    if (updateError) throw updateError;

    res.json({ 
      message: 'Logo berhasil diupload',
      logo_url 
    });

} catch (err) {
    console.error('Upload error detail:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update custom branding (warna & tagline)
const updateBranding = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;
    const { brand_color, tagline, welcome_message } = req.body;

    const { error } = await supabase
      .from('merchant_settings')
      .update({ brand_color, tagline, welcome_message })
      .eq('merchant_id', merchant_id);

    if (error) throw error;

    res.json({ message: 'Branding berhasil diupdate' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Ambil settings merchant (public - untuk halaman toko)
const getSettings = async (req, res) => {
  try {
    const { merchant_id } = req.params;

    const { data, error } = await supabase
      .from('merchant_settings')
      .select('logo_url, brand_color, tagline, welcome_message, is_premium')
      .eq('merchant_id', merchant_id)
      .single();

    if (error) throw error;

    // Kalau bukan premium, kembalikan default saja
    if (!data.is_premium) {
      return res.json({ 
        settings: {
          logo_url: null,
          brand_color: '#22c55e',
          tagline: null,
          welcome_message: null,
          is_premium: false
        }
      });
    }

    res.json({ settings: data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { upload, uploadLogo, updateBranding, getSettings };