const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const supabase = require('../supabase');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Request reset password
const requestReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email wajib diisi' });

    // Cek apakah email terdaftar
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, name, email')
      .eq('email', email)
      .single();

    // Selalu return success meskipun email tidak ada (keamanan)
    if (!merchant) {
      return res.json({ message: 'Jika email terdaftar, link reset akan dikirim' });
    }

    // Buat token unik
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    // Simpan token ke database
    await supabase.from('password_resets').insert([{
      merchant_id: merchant.id,
      token,
      expires_at: expires_at.toISOString()
    }]);

    // Kirim email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"Antriin" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Reset Password Antriin',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Reset Password Antriin</h2>
          <p>Halo <strong>${merchant.name}</strong>,</p>
          <p>Kami menerima permintaan reset password untuk akun kamu.</p>
          <p>Klik tombol di bawah untuk membuat password baru:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Reset Password
          </a>
          <p style="color:#6b7280;font-size:13px;">Link ini berlaku selama <strong>1 jam</strong>.</p>
          <p style="color:#6b7280;font-size:13px;">Jika kamu tidak meminta reset password, abaikan email ini.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="color:#9ca3af;font-size:12px;">Antriin — Sistem Antrian Digital</p>
        </div>
      `
    });

    res.json({ message: 'Jika email terdaftar, link reset akan dikirim' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reset password dengan token
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token dan password wajib diisi' });
    if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

    // Cek token valid
    const { data: resetData } = await supabase
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (!resetData) return res.status(400).json({ error: 'Token tidak valid atau sudah digunakan' });
    if (new Date(resetData.expires_at) < new Date()) return res.status(400).json({ error: 'Token sudah expired' });

    // Hash password baru
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password merchant
    await supabase
      .from('merchants')
      .update({ password: hashedPassword })
      .eq('id', resetData.merchant_id);

    // Tandai token sudah dipakai
    await supabase
      .from('password_resets')
      .update({ used: true })
      .eq('token', token);

    res.json({ message: 'Password berhasil direset' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { requestReset, resetPassword };