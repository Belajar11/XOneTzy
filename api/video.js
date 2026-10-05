const ALLOWED_MODELS = new Set([
  'google/veo-3.1-fast',
  'bytedance/seedance-2.0-fast',
  'alibaba/wan-2.2-fast',
  'x-ai/grok-imagine-video'
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI Video belum dikonfigurasi di server. Tambahkan POLLINATIONS_API_KEY di Vercel Environment Variables.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = String(body.prompt || '').trim();
    const model = String(body.model || 'google/veo-3.1-fast');
    const duration = Number(body.duration || 4);
    if (!prompt) return res.status(400).json({ error: 'Prompt video kosong.' });
    if (prompt.length > 2000) return res.status(400).json({ error: 'Prompt terlalu panjang (maksimal 2000 karakter).' });
    if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Model video tidak diizinkan.' });
    if (![4, 5, 6, 8].includes(duration)) return res.status(400).json({ error: 'Durasi tidak valid.' });

    const endpoint = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&duration=${duration}`;
    const upstream = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'video/mp4,video/*,*/*' } });
    if (!upstream.ok) return res.status(upstream.status).json({ error: `Pollinations menolak permintaan (${upstream.status}). Coba model atau durasi lain.` });

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="xonetzy-ai-video.mp4"');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    return res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.error('AI video proxy error:', err);
    return res.status(500).json({ error: 'Gagal menghubungi layanan AI video. Coba lagi.' });
  }
}
