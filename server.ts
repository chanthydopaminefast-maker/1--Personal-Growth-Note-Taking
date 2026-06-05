import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // AI Proxy Route
  app.post('/api/ai/generate', async (req, res) => {
    const { prompt, systemInstruction, model } = req.body;
    const rawKeys = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEYS || "";
    const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (apiKeys.length === 0) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set in the server environment.' });
    }

    const isRetryableError = (error: any) => {
      const msg = error?.message?.toLowerCase() || "";
      const status = error?.status || error?.code || 500;
      return msg.includes("quota") || msg.includes("429") || msg.includes("high demand") || 
             msg.includes("unavailable") || status === 429 || status === 503;
    };

    for (let i = 0; i < apiKeys.length; i++) {
        let retries = 2;
        const currentKey = apiKeys[i];
        
        while (retries >= 0) {
            try {
                const ai = new GoogleGenAI({ apiKey: currentKey });
                const response = await ai.models.generateContent({
                  model: model || 'gemini-3-flash-preview',
                  contents: prompt,
                  config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.7,
                  }
                });

                return res.json({ text: response.text });
            } catch (error: any) {
                if (isRetryableError(error)) {
                    if (retries > 0) {
                        console.warn(`Server AI Proxy: Retryable error on key #${i+1}, retries left: ${retries}`);
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        continue;
                    } else if (i < apiKeys.length - 1) {
                        console.warn(`Server AI Proxy: Key #${i+1} failed after retries. Rotating...`);
                        break; // Exit while, move to next key in for loop
                    }
                }
                
                // If it's the last key and last retry, or not retryable
                if (i === apiKeys.length - 1 && (retries <= 0 || !isRetryableError(error))) {
                    console.error('AI Proxy Final Error:', error);
                    return res.status(500).json({ error: error.message });
                }
                
                if (!isRetryableError(error)) {
                     return res.status(500).json({ error: error.message });
                }
                break; // move to next key
            }
        }
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
