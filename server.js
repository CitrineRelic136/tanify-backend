const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Render ortamında mıyız yoksa lokalde mi? Ona göre yt-dlp yolu seçiyoruz
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
const ytDlpPath = isProduction ? path.join(__dirname, 'bin', 'yt-dlp') : 'yt-dlp';

// ⚡ Şarkı Linkleri İçin Bellek Önbelleği (Cache Map)
const streamCache = new Map();

// 1. Mevcut Ses URL Çözücü (Önbellek Destekli)
app.get('/stream/:id', (req, res) => {
    const videoId = req.params.id;

    // Eğer bu şarkı önbellekte varsa, yt-dlp'yi çalıştırmadan anında ver!
    if (streamCache.has(videoId)) {
        console.log(`⚡ Önbellekten Anında Verildi: ${videoId}`);
        return res.json({ url: streamCache.get(videoId) });
    }

    console.log(`🔍 Çözümleniyor: ${videoId}`);
    const command = `${ytDlpPath} -g -f bestaudio "https://www.youtube.com/watch?v=${videoId}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ yt-dlp Çalıştırma Hatası: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }

        const streamUrl = stdout.trim().split('\n')[0];
        if (streamUrl && streamUrl.startsWith('http')) {
            // Başarılı URL'yi gelecekteki istekler için hafızaya kaydet
            streamCache.set(videoId, streamUrl);
            console.log(`✅ Başarılı URL Alındı ve Önbelleklendi!`);
            res.json({ url: streamUrl });
        } else {
            console.log(`❌ Geçersiz URL çıktı:`, stdout);
            res.status(500).json({ error: 'Geçerli link alınamadı' });
        }
    });
});

// 2. Spotify Tarzı "Radio / Benzer Şarkılar" Endpoint'i
app.get('/radio/:id', (req, res) => {
    const videoId = req.params.id;
    console.log(`📻 Benzer Radyo Şarkıları İsteniyor: ${videoId}`);

    const command = `${ytDlpPath} --flat-playlist --print "%(id)s||%(title)s||%(uploader)s" "https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Radyo Listesi Çekme Hatası: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }

        const lines = stdout.trim().split('\n');
        const radioSongs = [];

        for (const line of lines) {
            const parts = line.split('||');
            if (parts.length >= 3) {
                const id = parts[0].trim();
                const title = parts[1].trim();
                const artist = parts[2].trim();
                
                if (id && id !== 'NA') {
                    radioSongs.push({
                        id: id,
                        title: title,
                        artist: artist,
                        coverUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
                        streamUrl: ""
                    });
                }
            }
        }

        console.log(`✅ ${radioSongs.length} benzer radyo şarkısı bulundu!`);
        res.json(radioSongs);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Tanify Sunucusu ${PORT} portunda (Cache & Radio Aktif) ayakta!`);
});