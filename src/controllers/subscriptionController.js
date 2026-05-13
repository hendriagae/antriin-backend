const midtransClient = require('midtrans-client');
const supabase = require('../supabase');

// Inisialisasi Midtrans
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Buat transaksi baru
const createTransaction = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;

    // Ambil data merchant
    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('id, name, phone, email')
      .eq('id', merchant_id)
      .single();

    if (error) throw error;

    // Buat order ID unik
    const order_id = `ANTRIIN-${merchant_id.slice(0, 8)}-${Date.now()}`;
    const amount = 49000;

    // Parameter transaksi Midtrans
    const parameter = {
      transaction_details: {
        order_id,
        gross_amount: amount
      },
      customer_details: {
        first_name: merchant.name,
        phone: merchant.phone,
        email: merchant.email || 'noemail@antriin.id'
      },
      item_details: [{
        id: 'PREMIUM-1BULAN',
        price: amount,
        quantity: 1,
        name: 'Antriin Premium 1 Bulan'
      }]
    };

    // Buat transaksi di Midtrans
    const transaction = await snap.createTransaction(parameter);

    // Simpan ke database
    await supabase
      .from('subscriptions')
      .insert([{
        merchant_id,
        status: 'pending',
        plan: 'premium',
        amount,
        midtrans_order_id: order_id
      }]);

    res.json({
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      order_id
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Webhook dari Midtrans
const handleWebhook = async (req, res) => {
  try {
    const notification = await snap.transaction.notification(req.body);
    const { order_id, transaction_status, payment_type, transaction_id } = notification;

    let status = 'pending';

    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      status = 'active';
    } else if (transaction_status === 'cancel' || transaction_status === 'deny' || transaction_status === 'expire') {
      status = 'failed';
    }

    // Update subscription
    const expired_at = new Date();
    expired_at.setMonth(expired_at.getMonth() + 1);

    await supabase
      .from('subscriptions')
      .update({
        status,
        payment_type,
        midtrans_transaction_id: transaction_id,
        started_at: status === 'active' ? new Date().toISOString() : null,
        expired_at: status === 'active' ? expired_at.toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('midtrans_order_id', order_id);

    // Update is_premium di merchant_settings
    if (status === 'active') {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('merchant_id')
        .eq('midtrans_order_id', order_id)
        .single();

      await supabase
        .from('merchant_settings')
        .update({ is_premium: true })
        .eq('merchant_id', sub.merchant_id);
    }

    res.json({ status: 'ok' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cek status subscription merchant
const getStatus = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;

    const { data: settings } = await supabase
      .from('merchant_settings')
      .select('is_premium')
      .eq('merchant_id', merchant_id)
      .single();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('merchant_id', merchant_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      is_premium: settings?.is_premium || false,
      subscription: subscription || null
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createTransaction, handleWebhook, getStatus };