const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

// Register merchant baru
const register = async (req, res) => {
  try {
    const { name, category, phone, email, password } = req.body;

    // Validasi input
    if (!name || !category || !phone || !password) {
      return res.status(400).json({ 
        error: 'Nama, kategori, nomor HP, dan password wajib diisi' 
      });
    }

    // Cek apakah nomor HP sudah terdaftar
    const { data: existing } = await supabase
      .from('merchants')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existing) {
      return res.status(400).json({ 
        error: 'Nomor HP sudah terdaftar' 
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Simpan merchant baru
    const { data: merchant, error } = await supabase
      .from('merchants')
      .insert([{ name, category, phone, email, password_hash }])
      .select()
      .single();

    if (error) throw error;

    // Buat pengaturan default untuk merchant baru
    await supabase
      .from('merchant_settings')
      .insert([{ merchant_id: merchant.id }]);

    // Buat token JWT
    const token = jwt.sign(
      { id: merchant.id, phone: merchant.phone },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registrasi berhasil',
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        category: merchant.category,
        phone: merchant.phone
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login merchant
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ 
        error: 'Nomor HP dan password wajib diisi' 
      });
    }

    // Cari merchant berdasarkan nomor HP
    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error || !merchant) {
      return res.status(401).json({ 
        error: 'Nomor HP atau password salah' 
      });
    }

    // Cek password
    const valid = await bcrypt.compare(password, merchant.password_hash);
    if (!valid) {
      return res.status(401).json({ 
        error: 'Nomor HP atau password salah' 
      });
    }

    // Buat token JWT
    const token = jwt.sign(
      { id: merchant.id, phone: merchant.phone },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login berhasil',
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        category: merchant.category,
        phone: merchant.phone,
        is_open: merchant.is_open
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login };