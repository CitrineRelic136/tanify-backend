const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Sağlık kontrolü endpoint'i
app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Tanify yt-dlp backend çalışıyor.' });
});

// İndirme / Akış (Stream) endpoint'i
app.get('/download', (req, res) => {
    const videoUrl = req.query.url;
    const format = req.query.format || 'mp3'; // 'mp3' veya 'mp4'

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL parametresi gerekli.' });
    }

    // yt-dlp argümanları
    let ytdlArgs = [];

    if (format === 'mp3') {
        ytdlArgs = [
            '-x', // Sadece ses
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '-o', '-', // Çıktıyı standart çıktıya (stdout) yönlendir
            videoUrl
        ];
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
    } else {
        ytdlArgs = [
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '-o', '-',
            videoUrl
        ];
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
    }

    // yt-dlp işlemini başlat
    const ytdlpProcess = spawn('yt-dlp', ytdlArgs);

    // Veriyi istemciye (client) akıt
    ytdlpProcess.stdout.pipe(res);

    // Hata yönetimi
    let errorOutput = '';
    ytdlpProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    ytdlpProcess.on('close', (code) => {
        if (code !== 0 && !res.headersSent) {
            console.error(`yt-dlp hata kodu ${code}:`, errorOutput);
            res.status(500).json({ error: 'Medya işlenirken bir hata oluştu.', details: errorOutput });
        }
    });

    // İstemci bağlantıyı kestiğinde süreci sonlandır
    req.on('close', () => {
        ytdlpProcess.kill('SIGKILL');
    });
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda ayakta.`);
});