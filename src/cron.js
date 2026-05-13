const cron = require('node-cron');
const supabase = require('./supabase');

// Jalankan setiap hari jam 00:00 tengah malam
cron.schedule('0 0 * * *', async () => {
  console.log('Menjalankan reset antrian harian...');

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Tutup semua sesi yang masih aktif dari kemarin
    const { error: sessionError } = await supabase
      .from('queue_sessions')
      .update({ 
        is_active: false, 
        closed_at: new Date().toISOString() 
      })
      .eq('session_date', yesterdayStr)
      .eq('is_active', true);

    if (sessionError) throw sessionError;

    // Expire semua antrian yang masih waiting dari kemarin
    const { error: queueError } = await supabase
      .from('queue_entries')
      .update({ status: 'expired' })
      .eq('queue_date', yesterdayStr)
      .in('status', ['waiting', 'called']);

    if (queueError) throw queueError;

    // Reset semua merchant jadi tutup
    const { error: merchantError } = await supabase
      .from('merchants')
      .update({ is_open: false })
      .eq('is_open', true);

    if (merchantError) throw merchantError;

    console.log(`Reset antrian ${yesterdayStr} selesai`);

  } catch (err) {
    console.error('Error reset antrian:', err.message);
  }
}, {
  timezone: 'Asia/Jakarta'
});

console.log('Cron job reset antrian harian aktif');