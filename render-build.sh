#!/usr/bin/env bash
set -o errexit

# Node modüllerini kur
npm install

# yt-dlp aracını doğrudan bulut sunucusuna indir ve çalıştırma izni ver
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod a+rx bin/yt-dlp