export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) return res.status(500).json({ error: 'POLLINATIONS_API_KEY belum disetel di Vercel.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = String(body.prompt || '').trim();
    const model = String(body.model || 'auto');
    const width = Number(body.width) || 1024;
    const height = Number(body.height) || 1024;
    const imageData = typeof body.imageData === 'string' ? body.imageData : '';
    const isEdit = Boolean(imageData);

    if (!prompt) return res.status(400).json({ error: 'Prompt masih kosong.' });
    if (prompt.length > 3000) return res.status(400).json({ error: 'Prompt terlalu panjang (maksimal 3000 karakter).' });

    const generateModels = new Set([
      'flux','black-forest-labs/flux.1-schnell','google/gemini-2.5-flash-image',
      'google/gemini-3.1-flash-image','x-ai/grok-imagine-image',
      'openai/gpt-image-1.5','openai/gpt-image-2','black-forest-labs/flux.2-pro'
    ]);
    const editModels = new Set([
      'black-forest-labs/flux.1-kontext-pro',
      'black-forest-labs/flux.2-klein-4b',
      'google/gemini-2.5-flash-image',
      'google/gemini-3.1-flash-image',
      'x-ai/grok-imagine-image',
      'openai/gpt-image-1.5',
      'openai/gpt-image-2',
      'prunaai/p-image-edit'
    ]);

    if (isEdit) {
      const cheapEditModels = [
        'prunaai/p-image-edit',
        'black-forest-labs/flux.2-klein-4b',
        'google/gemini-2.5-flash-image'
      ];
      let editCandidates;
      if (model === 'auto' || model === 'budget' || model === 'cheap') {
        editCandidates = cheapEditModels;
      } else {
        if (!editModels.has(model)) return res.status(400).json({ error: 'Model ini tidak diizinkan untuk Edit Foto. Pilih model Edit/Reference.' });
        editCandidates = [model, ...cheapEditModels.filter(m => m !== model)];
      }
      const match = imageData.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
      if (!match) return res.status(400).json({ error: 'Format foto referensi tidak valid. Gunakan PNG, JPG, atau WebP.' });
      const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'Foto terlalu besar. Gunakan foto maksimal 4 MB.' });

      let last402 = false;
      for (const candidate of editCandidates) {
        const form = new FormData();
        form.append('image', new Blob([bytes], { type: mime }), `reference.${mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1]}`);
        form.append('prompt', prompt);
        form.append('model', candidate);
        form.append('size', `${Math.min(2048, Math.max(512, width))}x${Math.min(2048, Math.max(512, height))}`);

        const upstream = await fetch('https://gen.pollinations.ai/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          body: form
        });
        if (upstream.ok) {
          res.setHeader('X-SX-Image-Model', candidate);
          return await sendImageResponse(upstream, res);
        }
        if (upstream.status === 402) {
          last402 = true;
          continue;
        }
        return await proxyError(upstream, res, `Edit foto (${candidate})`);
      }
      if (last402) return res.status(402).json({ error: 'Semua model edit hemat yang tersedia ditolak karena saldo/Pollen tidak cukup. Pollinations tetap membutuhkan API key dan Pollen untuk generate/edit.' });
      return res.status(502).json({ error: 'Tidak ada model edit yang berhasil.' });
    }

    const cheapGenerateModels = [
      'black-forest-labs/flux.1-schnell',
      'tongyi-mai/z-image-turbo',
      'lykon/dreamshaper-8-lcm',
      'prunaai/p-image',
      'recraft/recraft-v4.1-flash'
    ];
    let candidates;
    if (model === 'auto' || model === 'budget' || model === 'cheap') {
      candidates = cheapGenerateModels;
    } else {
      if (!generateModels.has(model)) return res.status(400).json({ error: 'Model gambar tidak didukung.' });
      candidates = [model, ...cheapGenerateModels.filter(m => m !== model)];
    }

    const w = Math.min(2048, Math.max(512, width));
    const h = Math.min(2048, Math.max(512, height));
    let last402 = false;
    for (const candidate of candidates) {
      const url = 'https://gen.pollinations.ai/image/' + encodeURIComponent(prompt) + '?model=' + encodeURIComponent(candidate) + '&width=' + w + '&height=' + h + '&nologo=true&safe=true';
      const upstream = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
      if (upstream.ok) {
        const ct = upstream.headers.get('content-type') || 'image/jpeg';
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Type', ct);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-SX-Image-Model', candidate);
        return res.status(200).send(buf);
      }
      if (upstream.status === 402) {
        last402 = true;
        continue;
      }
      return await proxyError(upstream, res, `Generate gambar (${candidate})`);
    }
    if (last402) {
      return res.status(402).json({ error: 'Semua model gambar hemat yang tersedia ditolak karena saldo/Pollen tidak cukup. Pollinations saat ini tetap membutuhkan API key dan Pollen untuk generate; isi Pollen atau gunakan akun dengan kuota/Quest Pollen.' });
    }
    return res.status(502).json({ error: 'Tidak ada model gambar yang berhasil.' });
  } catch (e) {
    console.error('AI image error:', e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}

async function proxyError(upstream, res, action) {
  const status = upstream.status;
  if (status === 402) return res.status(402).json({ error: `Pollinations membutuhkan saldo/Pollen yang cukup untuk ${action}.` });
  if (status === 401) return res.status(401).json({ error: 'POLLINATIONS_API_KEY tidak valid atau sudah dicabut.' });
  if (status === 403) return res.status(403).json({ error: 'API key tidak memiliki izin untuk model ini.' });
  let detail = '';
  try { detail = (await upstream.text()).slice(0, 300); } catch {}
  return res.status(status).json({ error: `Pollinations menolak permintaan (${status}).${detail ? ' ' + detail : ''}` });
}

async function sendImageResponse(upstream, res) {
  const ct = upstream.headers.get('content-type') || '';
  if (ct.startsWith('image/')) {
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  }
  const data = await upstream.json();
  const item = data?.data?.[0] || {};
  if (item.b64_json) {
    const buf = Buffer.from(item.b64_json, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  }
  if (item.url) {
    const img = await fetch(item.url);
    if (!img.ok) return res.status(502).json({ error: 'Hasil gambar dari Pollinations tidak dapat diambil.' });
    res.setHeader('Content-Type', img.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(await img.arrayBuffer()));
  }
  return res.status(502).json({ error: 'Pollinations tidak mengembalikan gambar yang valid.' });
}
