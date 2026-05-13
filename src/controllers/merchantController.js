const supabase = require('../supabase');

// Ambil info merchant by ID (public)
const getMerchant = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('id, name, category, is_open, operating_hours_start, operating_hours_end')
      .eq('id', id)
      .single();

    if (error || !merchant) {
      return res.status(404).json({ error: 'Toko tidak ditemukan' });
    }

    res.json({ merchant });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getMerchant };