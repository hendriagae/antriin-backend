const axios = require('axios');

const sendWA = async (phone, message) => {
  try {
    // Format nomor HP - hapus 0 di depan, ganti dengan 62
    let formattedPhone = phone;
    if (phone.startsWith('0')) {
      formattedPhone = '62' + phone.slice(1);
    }

    const response = await axios.post('https://api.fonnte.com/send', {
      target: formattedPhone,
      message: message,
      countryCode: '62'
    }, {
      headers: {
        Authorization: process.env.FONNTE_TOKEN
      }
    });

    console.log('WA terkirim ke:', formattedPhone);
    return response.data;

  } catch (err) {
    console.error('Gagal kirim WA:', err.message);
    return null;
  }
};

module.exports = { sendWA };