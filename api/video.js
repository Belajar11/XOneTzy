const ALLOWED_MODELS = new Set([
  'google/veo-3.1-fast',
  'google/gemini-omni-1.1-flash',
  'bytedance/seedance-1-pro-fast',
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-mini',
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.5',
  'alibaba/wan-2.2-fast',
  'alibaba/wan-2.6',
  'alibaba/wan-2.7',
  'alibaba/wan-3.0',
  'x-ai/grok-imagine-video',
  'x-ai/grok-imagine-video-1.5',
  'alibaba/happyhorse-1.1',
  'minimax/minimax-h3',
  'minimax/minimax-h3-max',
  'minimax/minimax-h3-max-turbo',
  'prunaai/p-video',
  'amazon/nova-reel-v1'
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI Video belum dikonfigurasi di server. Tambahkan POLLINATIONS_API_KEY di Vercel Environment Variables, lalu Redeploy.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = String(body.prompt || '').trim();
    const model = String(body.model || 'google/veo-3.1-fast');
    const duration = Number(body.duration || 4);
    if (!prompt) return res.status(400).json({ error: 'Prompt video kosong.' });
    if (prompt.length > 2000) return res.status(400).json({ error: 'Prompt terlalu panjang (maksimal 2000 karakter).' });
    if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Model video tidak tersedia/diizinkan. Pilih model dari daftar terbaru di website.' });
    if (![4, 5, 6, 8].includes(duration)) return res.status(400).json({ error: 'Durasi tidak valid. Pilih 4, 5, 6, atau 8 detik.' });

    const endpoint = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&duration=${duration}`;
    const upstream = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'video/mp4,video/*,*/*'
      }
    });

    if (!upstream.ok) {
      const status = upstream.status;
      if (status === 402) return res.status(402).json({ error: 'Pollinations membutuhkan saldo/Pollen yang cukup untuk generate video. Tambahkan saldo/kuota pada akun yang memiliki POLLINATIONS_API_KEY.' });
      if (status === 401) return res.status(401).json({ error: 'POLLINATIONS_API_KEY tidak valid atau sudah dicabut. Periksa Environment Variables Vercel dan Redeploy.' });
      if (status === 403) return res.status(403).json({ error: 'API key tidak memiliki izin untuk model ini.' });
      if (status === 404) return res.status(404).json({ error: 'Model video tidak ditemukan. Gunakan model terbaru dari katalog Pollinations.' });
      let detail = '';
      try { detail = (await upstream.text()).slice(0, 300); } catch {}
      return res.status(status).json({ error: `Pollinations menolak permintaan (${status}).${detail ? ' ' + detail : ''}` });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('video') && !contentType.includes('octet-stream')) {
      const text = await upstream.text();
      return res.status(502).json({ error: 'Pollinations tidak mengembalikan file video yang valid.' });
    }

    res.setHeader('Content-Type', contentType || 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="xonetzy-ai-video.mp4"');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    return res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.error('AI video proxy error:', err);
    return res.status(500).json({ error: 'Gagal menghubungi layanan AI video. Periksa deployment Vercel dan coba lagi.' });
  }
}

