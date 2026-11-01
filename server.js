const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Basit ana sayfa kontrolü
app.get('/', (req, res) => {
    res.json({ status: "online", message: "Tanify yt-dlp backend aktif." });
});

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

    // YouTube'un datacenter IP'si ve web bot engellerini aşmak için 
    // en agresif mobil/tv istemci taklit (spoof) ve ejs argümanları:
    args.push(
        '--remote-components', 'ejs:github',
        '--extractor-args', 'youtube:player-client=android,web',
        '-g',
        '-f', 'bestaudio/best',
        videoUrl
    );

    const ytdlp = spawn('bin/yt-dlp', args);

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

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});