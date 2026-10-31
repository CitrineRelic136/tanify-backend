const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Sağlık kontrolü (Ping)
app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Tanify yt-dlp backend aktif.' });
});

// 1. Akış URL'si Çözümleme (Android uygulamasının beklediği /stream/:id endpoint'i)
app.get('/stream/:id', (req, res) => {
    const videoId = req.params.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID gerekli.' });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // yt-dlp -g komutu ile doğrudan en iyi ses akış linkini alıyoruz
    const ytdlp = spawn('yt-dlp', ['-g', '-f', 'bestaudio/best', videoUrl]);

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
        output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp hata kodu ${code}:`, errorOutput);
            return res.status(500).json({ error: 'Akış URL\'si alınamadı', details: errorOutput });
        }

        const streamUrl = output.trim().split('\n')[0];

        if (!streamUrl) {
            return res.status(404).json({ error: 'Geçerli akış linki bulunamadı.' });
        }

        // Android tarafındaki JSONObject(responseStr).getString("url") yapısıyla birebir uyumlu
        res.json({ url: streamUrl });
    });
});

// 2. Benzer Şarkılar / Radyo Listesi (Android uygulamasının beklediği /radio/:id endpoint'i)
app.get('/radio/:id', (req, res) => {
    const videoId = req.params.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID gerekli.' });
    }

    // YouTube'un resmi otomatik Mix / Radyo çalma listesi
    const mixPlaylistUrl = `https://www.youtube.com/playlist?list=RD${videoId}`;
    
    const ytdlp = spawn('yt-dlp', ['--flat-playlist', '--dump-json', '--playlist-end', '20', mixPlaylistUrl]);

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
        output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
        if (code !== 0 && !output.trim()) {
            console.error(`yt-dlp radyo hata kodu ${code}:`, errorOutput);
            return res.status(500).json({ error: 'Radyo listesi alınamadı', details: errorOutput });
        }

        try {
            const lines = output.trim().split('\n').filter(Boolean);
            const songs = lines.map(line => {
                try {
                    const item = JSON.parse(line);
                    const id = item.id || item.url;
                    const title = item.title || 'Bilinmeyen Şarkı';
                    const artist = item.uploader || item.channel || 'Bilinmeyen Sanatçı';
                    const coverUrl = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
                    return { id, title, artist, coverUrl };
                } catch (e) {
                    return null;
                }
            }).filter(song => song && song.id);

            res.json(songs);
        } catch (e) {
            console.error('JSON parse hatası:', e);
            res.status(500).json({ error: 'Radyo verisi işlenemedi.' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});