const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const MERCADOPAGO_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL || 'https://magxormusic.vercel.app';
const KIE_API_TOKEN = process.env.VITE_KIE_API_TOKEN;
const WEBHOOK_HMAC_KEY = process.env.WEBHOOK_HMAC_KEY;

const COUPON_PREFIX = 'MAGXORMUSIC-';
const PRICE_FULL = 30000;
const PRICE_DISCOUNTED = 15000;

const taskResults = new Map();

async function redisCommand(cmd, ...args) {
  const url = `${UPSTASH_URL}/${cmd}${args.length ? '/' + args.map(a => encodeURIComponent(a)).join('/') : ''}`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Redis error:', error);
    return null;
  }
}

async function redisHgetall(key) {
  try {
    const response = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cmd: ['HGETALL', key] })
    });
    const data = await response.json();
    if (data.result && typeof data.result === 'object') {
      const result = {};
      for (let i = 0; i < data.result.length; i += 2) {
        result[data.result[i]] = data.result[i + 1];
      }
      return result;
    }
    return null;
  } catch (error) {
    console.error('Redis HGETALL error:', error);
    return null;
  }
}

async function redisHset(key, field, value) {
  try {
    await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cmd: ['HSET', key, field, value] })
    });
    return true;
  } catch (error) {
    console.error('Redis HSET error:', error);
    return false;
  }
}

async function redisIncr(key) {
  try {
    const response = await fetch(`${UPSTASH_URL}/incr/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Redis INCR error:', error);
    return 1;
  }
}

async function redisExists(key) {
  try {
    const response = await fetch(`${UPSTASH_URL}/exists/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Redis EXISTS error:', error);
    return 0;
  }
}

module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname.replace('/api/', '');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ==================== SUNO GENERATE ====================
    if (path === 'generate' && req.method === 'POST') {
      if (!KIE_API_TOKEN) {
        return res.status(500).json({ error: "API token not configured" });
      }

      const data = req.body || {};
      data.callBackUrl = `${APP_URL}/api/suno-callback`;

      console.log("Sending request to Kie.ai with callback:", data.callBackUrl);

      const endpoint = data.uploadUrl
        ? 'https://api.kie.ai/api/v1/generate/upload-cover'
        : 'https://api.kie.ai/api/v1/generate';

      const kieResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KIE_API_TOKEN}`
        },
        body: JSON.stringify(data)
      });

      const result = await kieResponse.json();
      return res.status(200).json(result);
    }

    // ==================== SUNO TASK STATUS ====================
    if (path.startsWith('task/') && req.method === 'GET') {
      const taskId = path.split('/')[1];
      
      if (!KIE_API_TOKEN) {
        return res.status(500).json({ error: "API token not configured" });
      }

      if (taskResults.has(taskId)) {
        return res.status(200).json(taskResults.get(taskId));
      }

      const kieResponse = await fetch(`https://api.kie.ai/api/v1/generate/record-info?taskId=${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${KIE_API_TOKEN}` }
      });

      if (!kieResponse.ok) {
        return res.status(kieResponse.status).json({ error: "Failed to fetch task" });
      }

      const result = await kieResponse.json();
      return res.status(200).json(result);
    }

    // ==================== SUNO CALLBACK ====================
    if (path === 'suno-callback' && req.method === 'POST') {
      const signature = req.headers['x-kie-signature'] || req.headers['signature'];
      
      const { code, msg, data: callbackData } = req.body || {};
      const taskId = callbackData?.task_id;
      const callbackType = callbackData?.callbackType;
      const tracks = callbackData?.data || [];

      if (!taskId) {
        console.error("⚠️ Callback received without taskId");
        return res.status(400).json({ error: "No task_id found" });
      }

      console.log(`📡 Suno Callback [${callbackType}]: Task ${taskId} (Code: ${code})`);

      if (code === 200) {
        taskResults.set(taskId, req.body);

        switch (callbackType) {
          case 'complete':
            console.log(`✅ Task ${taskId} completed`);
            break;
          case 'first':
            console.log(`🎵 First track generated for ${taskId}`);
            break;
          case 'text':
            console.log(`📝 Lyrics generated for ${taskId}`);
            break;
        }
      } else {
        console.error(`🔥 Error in Suno generation (${taskId}): ${msg} (Code: ${code})`);
        taskResults.set(taskId, { ...req.body, status: 'error' });
      }

      return res.status(200).json({ status: "received" });
    }

    // ==================== AI LYRICS ====================
    if (path === 'ai/lyrics' && req.method === 'POST') {
      const { prompt } = req.body || {};
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt required" });
      }

      // Usar Kie.ai para generar letras
      if (KIE_API_TOKEN) {
        try {
          const kieResponse = await fetch('https://api.kie.ai/api/v1/lyrics', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${KIE_API_TOKEN}`
            },
            body: JSON.stringify({
              prompt: prompt.substring(0, 200),
              callBackUrl: `${APP_URL}/api/lyrics-callback`
            })
          });

          const kieData = await kieResponse.json();
          
          if (kieData.code === 200 && kieData.data?.taskId) {
            // Polling para obtener letras
            const taskId = kieData.data.taskId;
            let attempts = 0;
            
            while (attempts < 24) { // 2 minutos máximo
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              const pollResponse = await fetch(`https://api.kie.ai/api/v1/lyrics/record-info?taskId=${taskId}`, {
                headers: { 'Authorization': `Bearer ${KIE_API_TOKEN}` }
              });
              
              const pollData = await pollResponse.json();
              
              if (pollData.code === 200) {
                const lyricsData = pollData.data?.data?.[0];
                
                if (lyricsData?.status === 'complete' && lyricsData?.text) {
                  return res.status(200).json({ text: lyricsData.text });
                }
                
                if (lyricsData?.status === 'failed') {
                  throw new Error('Lyrics generation failed');
                }
              }
              
              attempts++;
            }
            
            throw new Error('Lyrics generation timeout');
          }
        } catch (error) {
          console.error('Kie lyrics error:', error);
        }
      }

      // Fallback si Kie falla
      const fallbackLyrics = `[Intro]
${prompt.substring(0, 30)}...

[Verso 1]
Cada momento es especial,
como una melodía que empieza a sonar.
Tus palabras son mi inspiración,
tu presencia mi mejor canción.

[Coro]
Esta es nuestra historia,
escrita con notas de amor.
Juntos creamos algo único,
que nadie más podrá borrar.

[Verso 2]
Las notas fluyen en el aire,
como recuerdos que nunca mueren.
Construimos sueños paso a paso,
esta canción es nuestra herencia.

[Coro]
Esta es nuestra historia,
escrita con notas de amor...`;

      return res.status(200).json({ text: fallbackLyrics });
    }

    // ==================== COUPON VALIDATION ====================
    if (path === 'validate' && req.method === 'POST') {
      const { couponCode } = req.body || {};
      
      if (!couponCode) {
        return res.status(400).json({ success: false, error: 'Código requerido' });
      }
      
      const upperCode = couponCode.toUpperCase().trim();
      
      if (!upperCode.startsWith(COUPON_PREFIX)) {
        return res.status(400).json({ success: false, error: 'Código inválido' });
      }
      
      const couponData = await redisHgetall(`coupon:${upperCode}`);
      
      if (couponData && couponData.used === 'true') {
        return res.status(400).json({ success: false, error: 'Este cupón ya fue utilizado' });
      }
      
      return res.status(200).json({ success: true, discount: 50 });
    }

    // ==================== COUPON GENERATE ====================
    if (path === 'generate-coupon' && req.method === 'POST') {
      const current = await redisCommand('get', 'coupon_counter') || 0;
      const couponNumber = parseInt(current) + 1;
      const couponCode = `${COUPON_PREFIX}${String(couponNumber).padStart(4, '0')}`;
      
      await redisHset(`coupon:${couponCode}`, 'used', 'false');
      await redisHset(`coupon:${couponCode}`, 'createdAt', Date.now().toString());
      await redisHset(`coupon:${couponCode}`, 'number', couponNumber.toString());
      await redisCommand('set', 'coupon_counter', couponNumber.toString());
      
      return res.status(200).json({ success: true, couponCode });
    }

    // ==================== COUPON CLAIM ====================
    if (path === 'claim' && req.method === 'POST') {
      const couponCode = url.searchParams.get('code') || req.body?.code;
      
      if (!couponCode) {
        return res.status(400).json({ success: false, error: 'Código requerido' });
      }
      
      const upperCode = couponCode.toUpperCase();
      const exists = await redisExists(`coupon:${upperCode}`);
      
      if (!exists) {
        return res.status(404).json({ success: false, error: 'Cupón no encontrado' });
      }
      
      await redisHset(`coupon:${upperCode}`, 'used', 'true');
      await redisHset(`coupon:${upperCode}`, 'usedAt', Date.now().toString());
      
      return res.status(200).json({ success: true });
    }

    // ==================== SOCIAL COUNTER ====================
    if (path === 'social/counter') {
      const baseCount = 12847;
      const randomAdd = Math.floor(Math.random() * 150) + 50;
      return res.status(200).json({ count: baseCount + randomAdd });
    }

    // ==================== CREATE PAYMENT ====================
    if (path === 'create-payment' && req.method === 'POST') {
      const { trackId, trackTitle, taskId, price = PRICE_FULL } = req.body || {};

      let finalPrice = price;

      if (MERCADOPAGO_TOKEN) {
        try {
          const preference = {
            items: [{
              id: trackId || `track_${Date.now()}`,
              title: `Magxor Music · ${trackTitle || 'Canción'}`,
              description: "Descarga permanente",
              quantity: 1,
              currency_id: "ARS",
              unit_price: finalPrice,
            }],
            back_urls: {
              success: `${APP_URL}/?payment=success&trackId=${trackId}&taskId=${taskId}`,
              failure: `${APP_URL}/?payment=failure&trackId=${trackId}&taskId=${taskId}`,
              pending: `${APP_URL}/?payment=pending&trackId=${trackId}&taskId=${taskId}`,
            },
            auto_return: "approved",
            external_reference: `${taskId}:${trackId}`,
          };

          const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: 'POST',
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${MERCADOPAGO_TOKEN}`,
            },
            body: JSON.stringify(preference),
          });

          const mpData = await mpResponse.json();
          
          return res.status(200).json({
            init_point: mpData.init_point,
            preference_id: mpData.id,
            price: finalPrice,
            originalPrice: PRICE_FULL
          });
        } catch (error) {
          console.error('MercadoPago error:', error);
        }
      }

      const mockInitPoint = `https://www.mercadopago.com.ar/checkout/v1/redirect?preference-id=demo_${Date.now()}`;
      
      return res.status(200).json({
        init_point: mockInitPoint,
        preference_id: `pref_${Date.now()}`,
        price: finalPrice,
        originalPrice: PRICE_FULL
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
