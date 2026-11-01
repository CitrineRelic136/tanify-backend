const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Invidious ve Piped public instance havuzu
const INSTANCES = [
    { type: 'invidious', url: 'https://invidious.privacyredirect.com' },
    { type: 'invidious', url: 'https://inv.nadeko.net' },
    { type: 'invidious', url: 'https://yt.artemislena.eu' },
    { type: 'piped', url: 'https://pipedapi.kavin.rocks' },
    { type: 'piped', url: 'https://api.piped.privacy.com.de' }
];

async function getAudioUrl(videoId) {
    for (const instance of INSTANCES) {
        try {
            if (instance.type === 'invidious') {
                const res = await axios.get(`${instance.url}/api/v1/videos/${videoId}`, { timeout: 4000 });
                const adaptiveFormats = res.data.adaptiveFormats || [];
                const audioFormats = adaptiveFormats.filter(f => f.type && f.type.includes('audio'));
                if (audioFormats.length > 0) {
                    return audioFormats[audioFormats.length - 1].url;
                }
            } else if (instance.type === 'piped') {
                const res = await axios.get(`${instance.url}/streams/${videoId}`, { timeout: 4000 });
                const audioStreams = res.data.audioStreams || [];
                if (audioStreams.length > 0) {
                    // En yüksek kaliteli ses akışını seç
                    return audioStreams[audioStreams.length - 1].url;
                }
            }
        } catch (err) {
            console.log(`${instance.url} başarısız oldu, sıradakine geçiliyor...`);
        }
    }
    throw new Error('Hiçbir alternatif sunucudan akış adresi alınamadı.');
}

app.get('/stream/:id', async (req, res) => {
    const videoId = req.params.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID gerekli.' });
    }

    console.log(`İşleniyor: ${videoId}`);

    try {
        const streamUrl = await getAudioUrl(videoId);
        res.json({ url: streamUrl });
    } catch (error) {
        console.error('Akış hatası:', error.message);
        res.status(500).json({ error: 'Akış URL\'si alınamadı', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});