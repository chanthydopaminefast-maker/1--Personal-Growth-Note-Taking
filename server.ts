import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore,
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  writeBatch,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase server-side
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("Server system initialized Firestore sharing database:", firebaseConfig.firestoreDatabaseId);
  } else {
    console.error("Firebase config file not found at:", configPath);
  }
} catch (error) {
  console.error("Failed to initialize server-side Firebase client:", error);
}

// Helpers
const flattenTopicTree = (node: any, parentId: string | null = null, rootId: string = node.id): any[] => {
  let flatList: any[] = [];
  const children = node.children || [];
  const flatNode = { ...node, parentId, rootId };
  flatNode.childIds = children.map((c: any) => c.id);
  delete flatNode.children;
  flatList.push(flatNode);
  for (const child of children) {
    flatList = flatList.concat(flattenTopicTree(child, node.id, rootId));
  }
  return flatList;
};

const reconstructTopics = (docs: any[]) => {
  const nodeMap = new Map();
  const roots: any[] = [];

  docs.forEach(d => {
    nodeMap.set(d.id, { ...d, children: Array.isArray(d.children) ? [...d.children] : [] });
  });
  
  docs.forEach(d => {
    const node = nodeMap.get(d.id);
    if (d.parentId && nodeMap.has(d.parentId)) {
       const parent = nodeMap.get(d.parentId);
       const existingIdx = parent.children.findIndex((c: any) => c.id === node.id);
       if (existingIdx !== -1) {
          parent.children[existingIdx] = node;
       } else {
          parent.children.push(node);
       }
    } else {
       roots.push(node);
    }
  });

  for (const node of nodeMap.values()) {
     if (node.childIds && node.childIds.length > 0) {
        node.children = node.children.filter((c: any) => node.childIds.includes(c.id));
        node.children.sort((a: any, b: any) => node.childIds.indexOf(a.id) - node.childIds.indexOf(b.id));
     }
  }
  
  return roots;
};

const stripMassiveImages = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') && obj.length > 1000) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="8" fill="%2364748b">[Image Removed]</text></svg>';
    }
    if (obj.includes('data:image/')) {
      return obj.replace(/data:image\/[^;]+;base64,[^"\s>)]+/g, (match) => {
        if (match.length > 1000) {
          return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="8" fill="%2364748b">[Image Removed]</text></svg>';
        }
        return match;
      });
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripMassiveImages);
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = stripMassiveImages(obj[key]);
      }
    }
    return result;
  }
  return obj;
};

const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)).filter(item => item !== undefined);
  }
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value);
      }
    }
  }
  return result;
};

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

  // Create shared note (Server-side)
  app.post('/api/share/create', async (req, res) => {
    try {
      if (!db) {
        throw new Error('Database is offline');
      }

      const { userId, ownerName, type, title, payload } = req.body;
      const shareId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const shareRef = doc(db, 'sharedNotes', shareId);
      
      const lightPayload = stripMassiveImages(payload);
      const safeData = {
        id: String(shareId),
        ownerId: String(userId || 'unknown').substring(0, 120),
        ownerName: String(ownerName || 'Chanthy').substring(0, 120),
        type: String(type || 'self-learning').substring(0, 45),
        title: String(title || 'Untitled').substring(0, 250),
        payload: null as any,
        createdAt: new Date().toISOString()
      };

      if (type === 'note-taking' || type === 'self-learning') {
         safeData.payload = null;
         const batch = writeBatch(db);
         batch.set(shareRef, safeData);
         
         const flatNodes = flattenTopicTree(lightPayload);
         for (const node of flatNodes) {
            const nodeRef = doc(db, 'sharedNotes', shareId, 'nodes', node.id);
            const serialized = sanitizeForFirestore(node);
            const sizeBytes = Buffer.byteLength(JSON.stringify(serialized));
            if (sizeBytes > 950000) {
               return res.status(400).json({ error: 'PAYLOAD_TOO_LARGE' });
            }
            batch.set(nodeRef, serialized);
         }
         await batch.commit();
      } else {
         safeData.payload = sanitizeForFirestore(lightPayload || {});
         const sizeBytes = Buffer.byteLength(JSON.stringify(safeData));
         if (sizeBytes > 950000) {
           return res.status(400).json({ error: 'PAYLOAD_TOO_LARGE' });
         }
         await setDoc(shareRef, safeData);
      }

      return res.json({ shareId });
    } catch (error: any) {
      console.error("Server-side share generation failed:", error);
      return res.status(500).json({ error: error?.message || 'Internal Server Error' });
    }
  });

  // Get shared note (Server-side)
  app.get('/api/share/get/:shareId', async (req, res) => {
    try {
      if (!db) {
        throw new Error('Database is offline');
      }

      const { shareId } = req.params;
      const shareRef = doc(db, 'sharedNotes', shareId);
      
      let data: any = null;
      try {
        const docSnap = await getDocFromServer(shareRef);
        if (docSnap.exists()) {
          data = docSnap.data();
        }
      } catch (error) {
        const docSnap = await getDoc(shareRef);
        if (docSnap.exists()) {
          data = docSnap.data();
        }
      }

      if (!data) {
        return res.status(404).json({ error: 'Shared content not found' });
      }

      if (data.type === 'note-taking' || data.type === 'self-learning') {
        const nodesRef = collection(db, 'sharedNotes', shareId, 'nodes');
        const nodesSnap = await getDocs(nodesRef);
        if (!nodesSnap.empty) {
          const flatDocs = nodesSnap.docs.map(d => d.data());
          const reconstructed = reconstructTopics(flatDocs);
          if (reconstructed.length > 0) {
            data.payload = reconstructed[0];
          }
        }
      }

      return res.json(data);
    } catch (error: any) {
      console.error("Server-side share retrieval failed:", error);
      return res.status(500).json({ error: error?.message || 'Internal Server Error' });
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
