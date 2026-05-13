const supabase = require('../supabase');

// Analytics harian & mingguan
const getAnalytics = async (req, res) => {
  try {
    const merchant_id = req.merchant.id;
    const today = new Date().toISOString().split('T')[0];

    // Ambil data 7 hari terakhir
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data: entries, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('merchant_id', merchant_id)
      .gte('queue_date', startDate)
      .lte('queue_date', today);

    if (error) throw error;

    // Data hari ini
    const todayEntries = entries.filter(e => e.queue_date === today);
    const todayTotal = todayEntries.length;
    const todayDone = todayEntries.filter(e => e.status === 'done').length;
    const todaySkipped = todayEntries.filter(e => e.status === 'skipped').length;
    const todayCancelled = todayEntries.filter(e => e.status === 'cancelled').length;
    const todayWaiting = todayEntries.filter(e => e.status === 'waiting').length;

    // Rata-rata waktu tunggu (dalam menit)
    const servedEntries = todayEntries.filter(e => e.called_at && e.created_at);
    let avgWaitTime = 0;
    if (servedEntries.length > 0) {
      const totalWait = servedEntries.reduce((sum, e) => {
        const wait = (new Date(e.called_at) - new Date(e.created_at)) / 60000;
        return sum + wait;
      }, 0);
      avgWaitTime = Math.round(totalWait / servedEntries.length);
    }

    // Jam tersibuk
    const hourCounts = {};
    todayEntries.forEach(e => {
      const hour = new Date(e.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[a] > hourCounts[b] ? a : b, 0
    );

    // Grafik 7 hari terakhir
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayEntries = entries.filter(e => e.queue_date === dateStr);
      
      dailyData.push({
        date: dateStr,
        day: date.toLocaleDateString('id-ID', { weekday: 'short' }),
        total: dayEntries.length,
        done: dayEntries.filter(e => e.status === 'done').length,
        cancelled: dayEntries.filter(e => ['cancelled', 'skipped'].includes(e.status)).length
      });
    }

    res.json({
      today: {
        total: todayTotal,
        done: todayDone,
        waiting: todayWaiting,
        skipped: todaySkipped,
        cancelled: todayCancelled,
        avg_wait_minutes: avgWaitTime,
        peak_hour: peakHour ? `${peakHour}:00 - ${parseInt(peakHour) + 1}:00` : '-'
      },
      weekly: dailyData
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAnalytics };