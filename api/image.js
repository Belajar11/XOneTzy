export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) return res.status(500).json({ error: 'POLLINATIONS_API_KEY belum disetel di Vercel.' });
  try {
    const { prompt, model='flux', width=1024, height=1024 } = req.body || {};
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'Prompt masih kosong.' });
    const allowed = new Set([
      'flux','black-forest-labs/flux.1-schnell','google/gemini-2.5-flash-image',
      'google/gemini-3.1-flash-image','x-ai/grok-imagine-image',
      'openai/gpt-image-1.5','openai/gpt-image-2','black-forest-labs/flux.2-pro'
    ]);
    if (!allowed.has(model)) return res.status(400).json({ error: 'Model gambar tidak didukung.' });
    const w=Math.min(2048,Math.max(512,Number(width)||1024));
    const h=Math.min(2048,Math.max(512,Number(height)||1024));
    const url='https://gen.pollinations.ai/image/'+encodeURIComponent(String(prompt).trim())+'?model='+encodeURIComponent(model)+'&width='+w+'&height='+h+'&nologo=true&safe=true';
    const upstream=await fetch(url,{headers:{Authorization:`Bearer ${key}`}});
    if(!upstream.ok){
      let detail='Pollinations HTTP '+upstream.status;
      try{const t=await upstream.text(); if(t) detail += ': '+t.slice(0,300)}catch{}
      return res.status(upstream.status).json({error:detail});
    }
    const ct=upstream.headers.get('content-type')||'image/jpeg';
    const buf=Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type',ct);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(buf);
  } catch(e) {
    return res.status(500).json({error:e?.message||'Server error'});
  }
}
