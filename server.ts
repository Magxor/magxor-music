import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Cache for task results
const taskResults = new Map<string, any>();

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// ─── API Routes ─────────────────────────────────────────────────────────────

app.post("/api/generate", async (req, res) => {
  try {
    const token = process.env.VITE_KIE_API_TOKEN;
    if (!token) return res.status(500).json({ error: "API token not configured" });

    const data = req.body;
    const publicUrl = process.env.APP_URL
      ? process.env.APP_URL.replace(/\/$/, '')
      : `https://${req.headers.host}`;

    data.callBackUrl = `${publicUrl}/api/suno-callback`;

    console.log("Sending request to Kie.ai with callback:", data.callBackUrl);

    const endpoint = data.uploadUrl
      ? 'https://api.kie.ai/api/v1/generate/upload-cover'
      : 'https://api.kie.ai/api/v1/generate';

    const kieResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    const result = await kieResponse.json();
    res.json(result);
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({ error: "Failed to initiate generation" });
  }
});

app.get("/api/task/:taskId", async (req, res) => {
  try {
    const token = process.env.VITE_KIE_API_TOKEN;
    if (!token) return res.status(500).json({ error: "API token not configured" });

    const { taskId } = req.params;
    if (taskResults.has(taskId)) return res.json(taskResults.get(taskId));

    const kieResponse = await fetch(`https://api.kie.ai/api/v1/generate/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!kieResponse.ok) return res.status(kieResponse.status).json({ error: "Failed to fetch task" });

    const result = await kieResponse.json();
    res.json(result);
  } catch (error) {
    console.error("Task polling error:", error);
    res.status(500).json({ error: "Failed to fetch task details" });
  }
});

app.post("/api/suno-callback", (req: any, res) => {
  const hmacKey = process.env.WEBHOOK_HMAC_KEY;
  const signature = req.headers['x-kie-signature'] || req.headers['signature'];

  // 1. Webhook Security: Verificar la firma HMAC para asegurar que la petición viene de Kie.ai
  if (hmacKey && signature && req.rawBody) {
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(req.rawBody);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      console.error("❌ ALERTA: Firma de Webhook inválida detectada.");
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  const { code, msg, data } = req.body;
  const taskId = data?.task_id;
  const callbackType = data?.callbackType;
  const tracks = data?.data || [];

  if (!taskId) {
    console.error("⚠️ Callback recibido sin taskId.");
    return res.status(400).json({ error: "No task_id found" });
  }

  console.log(`📡 Suno Callback [${callbackType}]: Task ${taskId} (Code: ${code})`);

  // 2. Manejo de códigos de estado según documentación
  if (code === 200) {
    // Cachear resultado para el Polling de respaldo
    taskResults.set(taskId, req.body);

    switch (callbackType) {
      case 'text':
        console.log(`📝 Letra generada para ${taskId}.`);
        break;
      case 'first':
        console.log(`🎵 Primera pista generada para ${taskId}.`);
        // Por petición del usuario, no emitimos todavía para esperar a que estén las dos
        break;
      case 'complete':
        console.log(`✅ Tarea ${taskId} completada con éxito. Notificando al cliente.`);
        io.emit("music:complete", req.body);
        break;
    }
  } else {
    // 3. Gestión de Errores (Copyright 400, Conflictos 413, Error Servidor 501, etc.)
    console.error(`🔥 Error en generación Suno (${taskId}): ${msg} (Código: ${code})`);

    const errorPayload = { taskId, code, msg };
    taskResults.set(taskId, { ...req.body, status: 'error' });
    io.emit("music:error", errorPayload);
  }

  // Responder siempre 200 rápido para evitar timeouts del servidor de callbacks
  res.status(200).json({ status: "received" });
});

// ─── AI Lyrics Orchestration (Multi-Provider Fallback) ────────────────────────

const callKieLyrics = async (prompt: string, publicUrl: string) => {
  const token = process.env.VITE_KIE_API_TOKEN;
  if (!token) throw new Error("KIE_TOKEN_MISSING");

  const response = await fetch("https://api.kie.ai/api/v1/lyrics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      prompt: prompt.substring(0, 200),
      callBackUrl: `${publicUrl}/api/suno-callback`
    })
  });

  if (!response.ok) throw new Error("KIE_API_ERROR");
  const initData: any = await response.json();
  if (initData.code !== 200 || !initData.data?.taskId) {
    throw new Error(initData.msg || "KIE_INIT_FAILED");
  }

  const taskId = initData.data.taskId;
  
  // Polling
  let attempts = 0;
  while (attempts < 12) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    attempts++;
    
    try {
      const pollRes = await fetch(`https://api.kie.ai/api/v1/lyrics/record-info?taskId=${taskId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (pollRes.ok) {
        const pollData: any = await pollRes.json();
        if (pollData.code === 200 && pollData.data?.data?.[0]?.status === 'complete') {
          return pollData.data.data[0].text;
        }
        if (pollData.data?.data?.[0]?.status === 'failed') throw new Error("KIE_GEN_FAILED");
      }
    } catch (e) {
      console.warn("Retrying lyrics polling...");
    }
  }
  throw new Error("KIE_TIMEOUT");
};

const callGemini = async (prompt: string, model: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_KEY_MISSING");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const aiModel = genAI.getGenerativeModel({ model });
  const result = await aiModel.generateContent(prompt);
  return result.response.text().trim();
};

const callOpenAI = async (prompt: string, model: string) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_KEY_MISSING");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error("OPENAI_API_ERROR");
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
};

app.post("/api/ai/lyrics", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const publicUrl = process.env.APP_URL 
    ? process.env.APP_URL.replace(/\/$/, '') 
    : `https://${req.headers.host}`;

  const providers = [
    { id: 'kie', model: 'suno-lyrics' },
    { id: 'google', model: 'gemini-2.5-flash' },
    { id: 'google', model: 'gemini-2.0-flash' },
    { id: 'google', model: 'gemini-2.5-pro' },
    { id: 'openai', model: 'gpt-4o' },
    { id: 'openai', model: 'gpt-4o-mini' }
  ];

  for (const p of providers) {
    try {
      console.log(`🤖 [Backend] Intentando con ${p.id}:${p.model}...`);
      let text = "";
      
      if (p.id === 'kie') {
        text = await callKieLyrics(prompt, publicUrl);
      } else if (p.id === 'google') {
        text = await callGemini(prompt, p.model);
      } else if (p.id === 'openai') {
        text = await callOpenAI(prompt, p.model);
      }

      if (text) {
        console.log(`✅ [Backend] Exito con ${p.id}:${p.model}`);
        return res.json({ text });
      }
    } catch (error: any) {
      console.warn(`⚠️ [Backend] Fallo con ${p.id}:${p.model}:`, error.message);
      if (p.model === 'gpt-4o-mini') {
        return res.status(500).json({ error: "All AI providers failed", details: error.message });
      }
    }
  }
});

app.post("/api/create-payment", async (req, res) => {
  const { trackId, trackTitle, taskId, price = 5 } = req.body;
  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!mpAccessToken) return res.status(500).json({ error: "MercadoPago token not configured" });

  const publicUrl = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, '')
    : `https://${req.headers.host}`;

  try {
    const preference = {
      items: [{
        id: trackId,
        title: `Magxor Music · ${trackTitle || 'Canción'}`,
        description: "Descarga permanente",
        quantity: 1,
        currency_id: "USD",
        unit_price: price,
      }],
      back_urls: {
        success: `${publicUrl}/?payment=success&trackId=${trackId}&taskId=${taskId}`,
        failure: `${publicUrl}/?payment=failure&trackId=${trackId}&taskId=${taskId}`,
        pending: `${publicUrl}/?payment=pending&trackId=${trackId}&taskId=${taskId}`,
      },
      auto_return: "approved",
      external_reference: `${taskId}:${trackId}`,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpResponse.json();
    res.json({ init_point: mpData.init_point, preference_id: mpData.id });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ error: "Internal payment error" });
  }
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

// Export app for Vercel
export { app };

// ─── Local Development Server ───────────────────────────────────────────────

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const startLocalServer = async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    const PORT = 3000;
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`\n🎵 Local dev server: http://localhost:${PORT}`);
      if (!process.env.APP_URL) {
        console.warn(`⚠️  Kie.ai needs a public URL. Set APP_URL with ngrok.\n`);
      }
    });
  };
  startLocalServer();
} else if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  // Static serving for standard Node.js production (not Vercel)
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Production server running on port ${PORT}`);
  });
}