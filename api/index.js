const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const MERCADOPAGO_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL || 'https://magxormusic.vercel.app';

const COUPON_PREFIX = 'MAGXORMUSIC-';
const PRICE_FULL = 30000;
const PRICE_DISCOUNTED = 15000;

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
  const { path } = req.query;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Coupon validation
    if (path === 'validate' && req.method === 'POST') {
      const { couponCode } = req.body;
      
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
    
    // Generate new coupon
    if (path === 'generate' && req.method === 'POST') {
      const current = await redisCommand('get', 'coupon_counter') || 0;
      const couponNumber = parseInt(current) + 1;
      const couponCode = `${COUPON_PREFIX}${String(couponNumber).padStart(4, '0')}`;
      
      await redisHset(`coupon:${couponCode}`, 'used', 'false');
      await redisHset(`coupon:${couponCode}`, 'createdAt', Date.now().toString());
      await redisHset(`coupon:${couponCode}`, 'number', couponNumber.toString());
      await redisCommand('set', 'coupon_counter', couponNumber.toString());
      
      return res.status(200).json({ success: true, couponCode });
    }
    
    // Claim coupon
    if (path === 'claim' && req.method === 'POST') {
      const couponCode = req.query.code || req.body?.code;
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
    
    // Social counter
    if (path === 'social/counter') {
      const baseCount = 12847;
      const randomAdd = Math.floor(Math.random() * 150) + 50;
      return res.status(200).json({ count: baseCount + randomAdd });
    }
    
    // Create payment
    if (path === 'create-payment' && req.method === 'POST') {
      const { trackId, trackTitle, taskId, useCoupon, price } = req.body;
      
      let finalPrice = price || (useCoupon ? PRICE_DISCOUNTED : PRICE_FULL);
      let couponCode = null;
      
      if (useCoupon) {
        const current = await redisCommand('get', 'coupon_counter') || 0;
        couponCode = `${COUPON_PREFIX}${String(parseInt(current)).padStart(4, '0')}`;
        finalPrice = PRICE_DISCOUNTED;
      }
      
      // For demo purposes, return a mock response
      // In production, this would create a real MercadoPago preference
      const mockInitPoint = `https://www.mercadopago.com.ar/checkout/v1/redirect?preference-id=demo_${Date.now()}`;
      
      return res.status(200).json({
        init_point: mockInitPoint,
        preference_id: `pref_${Date.now()}`,
        price: finalPrice,
        originalPrice: PRICE_FULL,
        couponCode: useCoupon ? couponCode : null
      });
    }
    
    return res.status(404).json({ error: 'Endpoint not found' });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
