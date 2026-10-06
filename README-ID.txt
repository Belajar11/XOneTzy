SX-XONETZY AI - FIX HTTP 404

STRUKTUR WAJIB DI GITHUB:
index.html
vercel.json
package.json
api/image.js
api/video.js
api/health.js

LANGKAH DEPLOY VERCEL:
1. Upload SEMUA isi ZIP ini ke ROOT repository GitHub (jangan upload ZIP-nya saja sebagai satu file).
2. Pastikan folder api berisi image.js, video.js, health.js.
3. Pastikan Vercel project terhubung ke repository dan Root Directory menunjuk ke folder yang berisi index.html.
4. Vercel Environment Variables: POLLINATIONS_API_KEY = API key Pollinations kamu.
5. Setelah upload/commit, tunggu deployment selesai.
6. Tes: https://DOMAIN-KAMU/api/health
   Jika benar akan tampil JSON: {"ok":true,...}
7. Setelah /api/health berhasil, buka website dan coba AI Image Generator lagi.

KEAMANAN:
- Jangan masukkan POLLINATIONS_API_KEY ke index.html.
- Jangan commit API key ke GitHub.
- Gunakan Environment Variable di Vercel.
