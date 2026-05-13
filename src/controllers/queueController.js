const { sendWA } = require('../services/whatsapp');
const supabase = require('../supabase');

// Merchant buka antrian hari ini
const openQueue = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;
    const today = new Date().toISOString().split('T')[0];

    // Cek apakah sesi hari ini sudah ada
    const { data: existing } = await supabase
      .from('queue_sessions')
      .select('*')
      .eq('merchant_id', merchant_id)
      .eq('session_date', today)
      .single();

    if (existing) {
      // Kalau sudah ada, aktifkan kembali
      const { data, error } = await supabase
        .from('queue_sessions')
        .update({ is_active: true, closed_at: null })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      // Update status merchant jadi open
      await supabase
        .from('merchants')
        .update({ is_open: true })
        .eq('id', merchant_id);

      return res.json({ message: 'Antrian dibuka kembali', session: data });
    }

    // Buat sesi baru
    const { data: session, error } = await supabase
      .from('queue_sessions')
      .insert([{ merchant_id, session_date: today }])
      .select()
      .single();

    if (error) throw error;

    // Update status merchant jadi open
    await supabase
      .from('merchants')
      .update({ is_open: true })
      .eq('id', merchant_id);

    res.status(201).json({ message: 'Antrian berhasil dibuka', session });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Merchant tutup antrian hari ini
const closeQueue = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;
    const today = new Date().toISOString().split('T')[0];

    // Tutup sesi
    const { error } = await supabase
      .from('queue_sessions')
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq('merchant_id', merchant_id)
      .eq('session_date', today);

    if (error) throw error;

    // Update semua antrian waiting jadi expired
    await supabase
      .from('queue_entries')
      .update({ status: 'expired' })
      .eq('merchant_id', merchant_id)
      .eq('queue_date', today)
      .eq('status', 'waiting');

    // Update status merchant jadi closed
    await supabase
      .from('merchants')
      .update({ is_open: false })
      .eq('id', merchant_id);

    res.json({ message: 'Antrian berhasil ditutup' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Pelanggan ambil nomor antrian
const takeNumber = async (req, res) => {
  try {
    const { merchant_id, customer_name, customer_phone } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Cek apakah toko buka
    const { data: merchant } = await supabase
      .from('merchants')
      .select('is_open, name')
      .eq('id', merchant_id)
      .single();

    if (!merchant || !merchant.is_open) {
      return res.status(400).json({ error: 'Toko sedang tutup' });
    }

    // Ambil sesi aktif hari ini
    const { data: session } = await supabase
      .from('queue_sessions')
      .select('*')
      .eq('merchant_id', merchant_id)
      .eq('session_date', today)
      .eq('is_active', true)
      .single();

    if (!session) {
      return res.status(400).json({ error: 'Antrian belum dibuka' });
    }

    // Cek batas antrian harian (paket gratis: 20)
    const { data: settings } = await supabase
      .from('merchant_settings')
      .select('max_queue_per_day')
      .eq('merchant_id', merchant_id)
      .single();

    const { count } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    if (count >= settings.max_queue_per_day) {
      return res.status(400).json({ 
        error: `Antrian penuh. Maksimal ${settings.max_queue_per_day} per hari` 
      });
    }

    // Hitung display number berikutnya
    const { data: lastEntry } = await supabase
      .from('queue_entries')
      .select('display_number')
      .eq('session_id', session.id)
      .order('display_number', { ascending: false })
      .limit(1)
      .single();

    const display_number = lastEntry ? lastEntry.display_number + 1 : 1;

    // Hitung estimasi tunggu (jumlah waiting x 15 menit)
    const { count: waitingCount } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .in('status', ['waiting', 'called']);

    const estimasi_menit = waitingCount * 15;

    // Simpan entry antrian
    const { data: entry, error } = await supabase
      .from('queue_entries')
      .insert([{
        session_id: session.id,
        merchant_id,
        queue_date: today,
        display_number,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        status: 'waiting'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Nomor antrian berhasil diambil',
      entry: {
        id: entry.id,
        display_number: entry.display_number,
        customer_name: entry.customer_name,
        status: entry.status,
        merchant_name: merchant.name,
        estimasi_menit,
        created_at: entry.created_at
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Merchant panggil nomor berikutnya
const callNext = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;
    const today = new Date().toISOString().split('T')[0];

    // Ambil nomor waiting pertama
    const { data: next, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('merchant_id', merchant_id)
      .eq('queue_date', today)
      .eq('status', 'waiting')
      .order('display_number', { ascending: true })
      .limit(1)
      .single();

    if (error || !next) {
      return res.status(404).json({ error: 'Tidak ada antrian tersisa' });
    }

    // Update status jadi called
    const { data: updated } = await supabase
      .from('queue_entries')
      .update({ status: 'called', called_at: new Date().toISOString() })
      .eq('id', next.id)
      .select()
      .single();

// Kirim notifikasi WA jika pelanggan punya nomor HP
if (updated && updated.customer_phone) {
  const { data: settings } = await supabase
    .from('merchant_settings')
    .select('is_premium')
    .eq('merchant_id', merchant_id)
    .single();

  if (settings?.is_premium) {
    const merchantRes = await supabase
      .from('merchants')
      .select('name')
      .eq('id', merchant_id)
      .single();

    const message = `Halo ${updated.customer_name || 'Pelanggan'}! 👋\n\nNomor antrian *${String(updated.display_number).padStart(3, '0')}* kamu sekarang dipanggil di *${merchantRes.data.name}*.\n\nSegera menuju ke kasir ya! ✅`;

    await sendWA(updated.customer_phone, message);
  }
}
    res.json({
      message: `Nomor ${next.display_number} dipanggil`,
      entry: updated
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Merchant skip pelanggan
const skipEntry = async (req, res) => {
  try {
    const { entry_id } = req.body;
    const merchant_id = req.merchant.id;

    // Ambil setting skip policy
    const { data: settings } = await supabase
      .from('merchant_settings')
      .select('skip_policy')
      .eq('merchant_id', merchant_id)
      .single();

    const new_status = settings.skip_policy === 'second_chance' ? 'waiting' : 'skipped';

    const { data: updated, error } = await supabase
      .from('queue_entries')
      .update({ status: new_status })
      .eq('id', entry_id)
      .eq('merchant_id', merchant_id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: settings.skip_policy === 'second_chance' 
        ? 'Pelanggan diberi kesempatan kedua' 
        : 'Antrian di-skip',
      entry: updated
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Pelanggan cancel antrian
const cancelEntry = async (req, res) => {
  try {
    const { entry_id } = req.body;

    const { data: updated, error } = await supabase
      .from('queue_entries')
      .update({ 
        status: 'cancelled', 
        cancelled_at: new Date().toISOString() 
      })
      .eq('id', entry_id)
      .eq('status', 'waiting')
      .select()
      .single();

    if (error || !updated) {
      return res.status(400).json({ 
        error: 'Antrian tidak ditemukan atau sudah tidak bisa dibatalkan' 
      });
    }

    res.json({ message: 'Antrian berhasil dibatalkan', entry: updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cek status antrian realtime (untuk pelanggan)
const getStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: entry, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !entry) {
      return res.status(404).json({ error: 'Antrian tidak ditemukan' });
    }

    // Hitung berapa orang di depan
    const { count: ahead } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', entry.session_id)
      .eq('status', 'waiting')
      .lt('display_number', entry.display_number);

    res.json({
      entry: {
        id: entry.id,
        display_number: entry.display_number,
        status: entry.status,
        customer_name: entry.customer_name,
        ahead: ahead || 0,
        estimasi_menit: (ahead || 0) * 15
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Merchant lihat semua antrian hari ini
const getTodayQueue = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;
    const today = new Date().toISOString().split('T')[0];

    const { data: entries, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('merchant_id', merchant_id)
      .eq('queue_date', today)
      .order('display_number', { ascending: true });

    if (error) throw error;

const waiting = entries.filter(e => e.status === 'waiting').length;
const called = entries.filter(e => e.status === 'called').length;
const done = entries.filter(e => e.status === 'done').length;
const skipped = entries.filter(e => e.status === 'skipped').length;
const cancelled = entries.filter(e => e.status === 'cancelled').length;

res.json({
  date: today,
  summary: { total: entries.length, waiting, called, done, skipped, cancelled },
  entries
});

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Merchant tandai pelanggan selesai dilayani
const doneEntry = async (req, res) => {
  try {
    const { entry_id } = req.body;
    const merchant_id = req.merchant.id;

    const { data: updated, error } = await supabase
      .from('queue_entries')
      .update({ 
        status: 'done',
        done_at: new Date().toISOString()
      })
      .eq('id', entry_id)
      .eq('merchant_id', merchant_id)
      .select()
      .single();

    if (error || !updated) {
      return res.status(400).json({ error: 'Antrian tidak ditemukan' });
    }

    res.json({ message: 'Pelanggan selesai dilayani', entry: updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { 
  openQueue, 
  closeQueue, 
  takeNumber, 
  callNext, 
  skipEntry, 
  cancelEntry, 
  getStatus, 
  getTodayQueue,
  doneEntry
};