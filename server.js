const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Proje içindeki yerel bin klasörünü PATH'e ekle (Render uyumu için)
process.env.PATH = `${path.join(__dirname, 'bin')}:${process.env.PATH}`;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Sağlık kontrolü
app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Tanify yt-dlp backend aktif.' });
});

// 1. Akış URL'si Çözümleme
// 1. Akış URL'si Çözümleme
app.get('/stream/:id', (req, res) => {
    const videoId = req.params.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID gerekli.' });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`İstek alındı, işleniyor: ${videoUrl}`);

    const args = [];
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
        args.push('--cookies', cookiesPath);
    }

    // Yerelde çalışan kararlı argümanlar
    args.push(
        '--remote-components', 'ejs:github',
        '-g',
        '-f', 'bestaudio/best',
        videoUrl
    );

    const ytdlp = spawn('yt-dlp', args);

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
        output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    ytdlp.on('error', (err) => {
        console.error('yt-dlp başlatılamadı:', err);
        return res.status(500).json({ error: 'yt-dlp sunucuda çalıştırılamadı', details: err.message });
    });

    ytdlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp hata kodu ${code}:`, errorOutput);
            return res.status(500).json({ 
                error: 'Akış URL\'si alınamadı', 
                code: code, 
                details: errorOutput.trim() || 'Bilinmeyen yt-dlp hatası' 
            });
        }

        const streamUrl = output.trim().split('\n')[0];

        if (!streamUrl) {
            return res.status(404).json({ error: 'Geçerli akış linki bulunamadı.' });
        }

        res.json({ url: streamUrl });
    });
});

// 2. Radyo / Benzer Şarkılar Listesi
app.get('/radio/:id', (req, res) => {
    const videoId = req.params.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID gerekli.' });
    }

    const mixPlaylistUrl = `https://www.youtube.com/playlist?list=RD${videoId}`;
    
    const args = [];
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
        args.push('--cookies', cookiesPath);
    }

    args.push('--flat-playlist', '--dump-json', '--playlist-end', '15', mixPlaylistUrl);

    const ytdlp = spawn('yt-dlp', args);

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
        output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    ytdlp.on('error', (err) => {
        console.error('yt-dlp radyo hatası:', err);
        return res.status(500).json({ error: 'yt-dlp çalıştırılamadı' });
    });

    ytdlp.on('close', (code) => {
        if (code !== 0 && !output.trim()) {
            console.error(`yt-dlp radyo hata kodu ${code}:`, errorOutput);
            return res.status(500).json({ error: 'Radyo listesi alınamadı', details: errorOutput.trim() });
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