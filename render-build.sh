#!/usr/bin/env bash
set -o errexit

# Node bağımlılıklarını kur
npm install

# yt-dlp binary'sini en güncel haliyle indir
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod a+rx bin/yt-dlp