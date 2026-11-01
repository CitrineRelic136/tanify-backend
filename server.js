const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Invidious public instance listesi (Çalışmazsa otomatik diğerine geçer)
const INVIDIOUS_INSTANCES = [
    'https://invidious.privacyredirect.com',
    'https://inv.nadeko.net',
    'https://invidious.sethforprivacy.com',
    'https://yt.artemislena.eu'
];

async function getAudioUrlFromInvidious(videoId) {
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, {
                timeout: 5000
            });
            
            const adaptiveFormats = response.data.adaptiveFormats || [];
            // Sadece ses formatlarını filtrele (m4a veya webm)
            const audioFormats = adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
            
            if (audioFormats.length > 0) {
                // En yüksek kaliteyi seç
                return audioFormats[audioFormats.length - 1].url;
            }
        } catch (err) {
            console.log(`${instance} başarısız oldu, sıradakine geçiliyor...`);
        }
    }
    throw new Error('Hiçbir Invidious sunucusundan akış adresi alınamadı.');
}

app.get('/stream/:id', async (req, res) => {
    const videoId = req.params.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID gerekli.' });
    }

    console.log(`Invidious ile işleniyor: ${videoId}`);

    try {
        const streamUrl = await getAudioUrlFromInvidious(videoId);
        res.json({ url: streamUrl });
    } catch (error) {
        console.error('Akış hatası:', error.message);
        res.status(500).json({ error: 'Akış URL\'si alınamadı', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});