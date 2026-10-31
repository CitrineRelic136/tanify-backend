const express = require('express');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

const streamCache = new Map();

// Cobalt API Üzerinden Doğrudan Akış Çözücü
app.get('/stream/:id', async (req, res) => {
    const videoId = req.params.id;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    if (streamCache.has(videoId)) {
        console.log(`⚡ Önbellekten Akış Sunuluyor: ${videoId}`);
        return proxyAudio(streamCache.get(videoId), res);
    }

    console.log(`🔍 Cobalt API ile Çözümleniyor: ${videoId}`);

    const postData = JSON.stringify({
        url: youtubeUrl,
        downloadMode: 'audio',
        audioFormat: 'mp3'
    });

    const options = {
        hostname: 'api.cobalt.tools',
        port: 443,
        path: '/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'TanifyApp/1.0'
        }
    };

    const apiReq = https.request(options, (apiRes) => {
        let data = '';

        apiRes.on('data', (chunk) => {
            data += chunk;
        });

        apiRes.on('end', () => {
            try {
                const json = JSON.parse(data);
                const streamUrl = json.url || json.picker?.[0]?.url;

                if (streamUrl && streamUrl.startsWith('http')) {
                    console.log(`✅ Cobalt üzerinden akış linki alındı!`);
                    streamCache.set(videoId, streamUrl);
                    return proxyAudio(streamUrl, res);
                } else {
                    console.error(`❌ Cobalt link döndüremedi:`, data);
                    return res.status(500).json({ error: 'Geçerli akış linki alınamadı', details: data });
                }
            } catch (e) {
                console.error(`❌ JSON Parse Hatası: ${e.message}`);
                return res.status(500).json({ error: 'Sunucu yanıtı işlenemedi' });
            }
        });
    });

    apiReq.on('error', (err) => {
        console.error(`❌ Cobalt İstek Hatası: ${err.message}`);
        res.status(500).json({ error: err.message });
    });

    apiReq.write(postData);
    apiReq.end();
});

function proxyAudio(targetUrl, clientRes) {
    const client = targetUrl.startsWith('https') ? https : http;
    
    client.get(targetUrl, (ytRes) => {
        // Eğer harici kaynak yönlendirme (redirect) verirse takip et
        if (ytRes.statusCode >= 300 && ytRes.statusCode < 400 && ytRes.headers.location) {
            return proxyAudio(ytRes.headers.location, clientRes);
        }

        clientRes.writeHead(ytRes.statusCode, {
            'Content-Type': ytRes.headers['content-type'] || 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });
        ytRes.pipe(clientRes);
    }).on('error', (err) => {
        console.error(`❌ Proxy Akış Hatası: ${err.message}`);
        if (!clientRes.headersSent) {
            clientRes.status(500).json({ error: 'Akış aktarılamadı' });
        }
    });
}

// Radyo endpoint'i (Alternatif arama tabanlı radyo desteği)
app.get('/radio/:id', (req, res) => {
    // Şarkı geçişlerinde sorunsuz çalışması için boş dizi veya yedek liste döndürür
    res.json([]);
});

app.listen(PORT, () => {
    console.log(`🚀 Tanify Cobalt Proxy Sunucusu ${PORT} portunda aktif!`);
});