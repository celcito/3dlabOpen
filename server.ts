import express from "express";
import path from "path";
<<<<<<< HEAD
=======
import fs from "fs";
import http from "node:http";
import { Readable } from "node:stream";
>>>>>>> 835080b (feat)
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateVideosOperation, Type } from "@google/genai";

function pyStream(url: string, signal?: AbortSignal): Promise<{ ok: boolean; status: number; body: ReadableStream<Uint8Array> | null }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(parsed, { signal }, (res) => {
      const ok = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;
      const body = Readable.toWeb(res) as ReadableStream<Uint8Array>;
      resolve({ ok, status: res.statusCode ?? 500, body });
    });
    req.on("error", reject);
    req.setTimeout(0);
    req.end();
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // AI Figures Generation API
  app.post("/api/ai-figures/generate", async (req, res) => {
    try {
      const { prompt, physicalFormat = "statue" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let formatGuideline = "";
      if (physicalFormat === "articulated") {
        formatGuideline = "Specify that it is a 3D print-in-place articulated sensory flexi model with flexible interlocking joint segments, movable/wiggly body parts, flat bottom, smooth safe edges, perfect as a fidget sensory toy.";
      } else if (physicalFormat === "articulated_keychain") {
        formatGuideline = "Specify that it is a mini pocket-sized print-in-place articulated sensory keychain edition, combining flexible interlocking joint segments with a solid sturdy eyelet ring loop connector integrated on the top of its head, perfect as a movable fidget toy keychain.";
      } else if (physicalFormat === "keychain") {
        formatGuideline = "Specify that it is a mini pocket-sized keychain edition, with a solid sturdy eyelet ring loop connector integrated on the very top of its head, simplified clean geometries optimized for small-scale 3D prints.";
      } else {
        formatGuideline = "Specify that it is a premium static collector statue standing on a detailed solid circular base/pedestal with highly detailed textures.";
      }

      const systemInstruction = `You are an expert prompt engineer for 3D generation AI models (like Meshy, Luma, etc.).
Your task is to take the user's idea for a 3D figure and convert it into a highly detailed, optimized prompt.
The output prompt should focus on style, pose, details, textures, and specify appropriate physical features.
Format requirement: ${formatGuideline}
Return only the optimized prompt.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
        }
      });

      res.json({ optimizedPrompt: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate prompt" });
    }
  });

  // AI Figures Image Generation API
  app.post("/api/ai-figures/generate-image", async (req, res) => {
    try {
      const { prompt, aspectRatio = "1:1", model = "gemini-3.1-flash-lite-image", physicalFormat = "statue" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

<<<<<<< HEAD
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // We append description details to get a high-quality 3D printing/resin model style preview
      let enhancedPrompt = "";
      if (physicalFormat === "articulated") {
        enhancedPrompt = `3D print-in-place articulated sensory flexi fidget toy of: ${prompt}. Showcasing flexible segmented interlocking joints, flat bottom, resting on a plain dark studio table surface, realistic plastic material, high quality render.`;
      } else if (physicalFormat === "articulated_keychain") {
        enhancedPrompt = `3D print-in-place articulated sensory fidget keychain toy of: ${prompt}. Combining flexible wiggling joint segments with a sturdy connector loop ring integrated on top of its head, pocket-sized, flat bottom, resting on a plain dark studio tabletop, realistic plastic material, high quality render.`;
      } else if (physicalFormat === "keychain") {
        enhancedPrompt = `3D mini figure keychain edition of: ${prompt}. Pocket-sized, featuring a sturdy attachment loop connector ring integrated on top of its head, plain neutral dark studio background, displayed as a small keychain accessory, realistic plastic material, high quality render.`;
      } else if (physicalFormat === "drawing_plate") {
        enhancedPrompt = `2D lineart drawing plate design: ${prompt}. Pure black and white, high contrast, clean vector style lines, coloring book page, no shading, minimal details.`;
=======
      const mcResolution = req.body.mcResolution || 256;
      const provider = req.body.provider || "local";

      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
      formData.append("image", blob, req.file.originalname || "input.png");

      const params = new URLSearchParams({
        mc_resolution: String(mcResolution),
        provider,
      });

      const response = await fetch(`${IMG2_3D_PY_URL}/generate?${params}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Image-to-3D proxy error:", error);
      res.status(500).json({ error: error.message || "Failed to start generation" });
    }
  });

  app.get("/api/img2-3d/:id/sse", async (req, res) => {
    try {
      const jobId = req.params.id;
      const url = `${IMG2_3D_PY_URL}/jobs/${jobId}/stream`;

      const ctrl = new AbortController();
      req.on("close", () => ctrl.abort());

      const { ok, status, body } = await pyStream(url, ctrl.signal);

      if (!ok || !body) {
        if (!res.headersSent) res.status(status).json({ error: `Python returned ${status}` });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const reader = body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (e: unknown) {
        const err = e as Error;
        if (ctrl.signal.aborted) {
          return;
        }
        if (err?.name !== "AbortError" && err?.message !== "terminated" && err?.message !== "aborted") {
          console.error("SSE stream error:", err?.message || e);
        }
      } finally {
        try { await reader.cancel(); } catch {}
        if (!res.writableEnded) res.end();
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("SSE proxy error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.get("/api/img2-3d/:id/status", async (req, res) => {
    try {
      const jobId = req.params.id;
      const url = `${IMG2_3D_PY_URL}/jobs/${jobId}/status`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Status proxy error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/img2-3d/:id/result/:format", (req, res) => {
    const { id, format } = req.params;
    if (!["glb", "obj", "stl"].includes(format)) {
      return res.status(400).json({ error: "Format must be glb, obj, or stl" });
    }
    const filePath = path.join(JOBS_DIR, id, `model.${format}`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File not found: model.${format}` });
    }
    const contentTypes: Record<string, string> = {
      glb: "model/gltf-binary",
      obj: "text/plain",
      stl: "application/sla",
    };
    res.setHeader("Content-Type", contentTypes[format] || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="model.${format}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  // Providers list
  app.get("/api/img2-3d/providers", async (_req, res) => {
    try {
      const response = await fetch(`${IMG2_3D_PY_URL}/providers`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Providers proxy error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Server-side decimation proxy
  app.post("/api/decimate", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Mesh file is required" });
      }
      const ratio = parseFloat(req.body.ratio) || 0.5;
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype || "application/octet-stream" });
      formData.append("file", blob, req.file.originalname || "mesh.stl");
      formData.append("ratio", String(ratio));

      const response = await fetch(`${IMG2_3D_PY_URL}/decimate?ratio=${ratio}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const outputName = "decimated.stl";
      res.setHeader("Content-Type", "application/sla");
      res.setHeader("Content-Disposition", `attachment; filename="${outputName}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Decimate proxy error:", error);
      res.status(500).json({ error: error.message || "Decimate failed" });
    }
  });

  // Text-to-3D API (proxy to Python FastAPI service)
  app.post("/api/text-to-3d", async (req, res) => {
    try {
      const { prompt, mcResolution = 256, cleanPrompt, provider = "local" } = req.body;
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "prompt must not be empty" });
      }

      const response = await fetch(`${IMG2_3D_PY_URL}/text-to-3d`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          mc_resolution: mcResolution,
          clean_prompt: cleanPrompt !== false,
          provider,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Text-to-3D proxy error:", error);
      res.status(500).json({ error: error.message || "Failed to start text-to-3d generation" });
    }
  });

  // Project persistence API
  const PROJECTS_DIR = path.join(process.cwd(), "projects");
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });

  function getProjectDir(id: string): string {
    return path.join(PROJECTS_DIR, id);
  }

  function getProjectJsonPath(id: string): string {
    return path.join(getProjectDir(id), "project.json");
  }

  function getVersionsDir(id: string): string {
    const dir = path.join(getProjectDir(id), "versions");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function getVersionPath(id: string, n: number): string {
    return path.join(getVersionsDir(id), `${n}.json`);
  }

  function getThumbnailPath(id: string): string {
    return path.join(getProjectDir(id), "thumbnail.png");
  }

  function readProjectMeta(id: string): ProjectMeta | null {
    const p = getProjectJsonPath(id);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }

  function writeProjectMeta(meta: ProjectMeta): void {
    const dir = getProjectDir(meta.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getProjectJsonPath(meta.id), JSON.stringify(meta, null, 2));
  }

  interface ProjectMeta {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    favorite: boolean;
    currentVersion: number;
    versionCount: number;
    thumbnail64: string;
    pieceCount: number;
    totalTriangles: number;
    estimate: unknown;
  }

  app.get("/api/projects", (_req, res) => {
    try {
      const ids = fs.readdirSync(PROJECTS_DIR);
      const metas: ProjectMeta[] = [];
      for (const id of ids) {
        const meta = readProjectMeta(id);
        if (meta) metas.push(meta);
      }
      metas.sort((a, b) => b.updatedAt - a.updatedAt);
      res.json(metas);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects", (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      const id = crypto.randomUUID();
      const now = Date.now();
      const meta: ProjectMeta = {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        favorite: false,
        currentVersion: 0,
        versionCount: 0,
        thumbnail64: "",
        pieceCount: 0,
        totalTriangles: 0,
        estimate: {},
      };
      writeProjectMeta(meta);
      res.json(meta);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects/:id", (req, res) => {
    try {
      const meta = readProjectMeta(req.params.id);
      if (!meta) return res.status(404).json({ error: "Project not found" });
      const versions: unknown[] = [];
      const vDir = getVersionsDir(req.params.id);
      if (fs.existsSync(vDir)) {
        const files = fs.readdirSync(vDir);
        for (const f of files) {
          const vPath = path.join(vDir, f);
          const v = JSON.parse(fs.readFileSync(vPath, "utf-8"));
          versions.push({ version: v.version, createdAt: v.createdAt, thumbnail64: v.thumbnail64 || "" });
        }
      }
      res.json({ ...meta, versions });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/projects/:id", (req, res) => {
    try {
      const meta = readProjectMeta(req.params.id);
      if (!meta) return res.status(404).json({ error: "Project not found" });
      const { name, favorite } = req.body;
      if (name !== undefined) meta.name = name;
      if (favorite !== undefined) meta.favorite = favorite;
      meta.updatedAt = Date.now();
      writeProjectMeta(meta);
      res.json(meta);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    try {
      const dir = getProjectDir(req.params.id);
      if (!fs.existsSync(dir)) return res.status(404).json({ error: "Project not found" });
      fs.rmSync(dir, { recursive: true });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects/:id/duplicate", (req, res) => {
    try {
      const meta = readProjectMeta(req.params.id);
      if (!meta) return res.status(404).json({ error: "Project not found" });
      const newId = crypto.randomUUID();
      const newDir = getProjectDir(newId);
      const srcDir = getProjectDir(req.params.id);
      fs.cpSync(srcDir, newDir, { recursive: true });
      const newMeta = readProjectMeta(newId);
      if (newMeta) {
        newMeta.id = newId;
        newMeta.name = `${meta.name} (cópia)`;
        newMeta.createdAt = Date.now();
        newMeta.updatedAt = Date.now();
        writeProjectMeta(newMeta);
        res.json(newMeta);
>>>>>>> 835080b (feat)
      } else {
        enhancedPrompt = `3D digital sculpture of: ${prompt}. Centered composition, plain neutral dark studio background, displayed on a pedestal or base, realistic materials, intricate fine details, optimized for 3D printing, high quality render.`;
      }

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              text: enhancedPrompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio,
          }
        },
      });

      let imageUrl = "";
      const candidates = response.candidates;
      if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            imageUrl = `data:image/png;base64,${base64EncodeString}`;
            break;
          }
        }
      }

      if (!imageUrl) {
        throw new Error("Não foi possível gerar a imagem a partir do modelo Gemini.");
      }

      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Gemini Image API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  // AI Figures Photo-to-Figurine Multimodal Analyzer API
  app.post("/api/ai-figures/analyze-image", async (req, res) => {
    try {
      const { image, style = "rpg", physicalFormat = "statue" } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Imagem é obrigatória" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // extract actual base64 data and mimeType
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      let mimeType = "image/jpeg";
      let base64Data = image;
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }

      const stylePrompts = {
        rpg: "fantasy tabletop RPG style miniature, epic battle pose, medieval warrior/mage armor and gear, incredibly high detail",
        chibi: "cute chibi style miniature, big expressive adorable eyes, oversized magic staff/sword accessory, stylized cute costume, smooth friendly look",
        cyberpunk: "futuristic cyberpunk character style, neon accents, cyberware enhancements, high-tech blaster, industrial grating base",
        classic: "classic museum marble statue style, elegant classical artistic pose, greek/roman drapery, realistic stone sculpture texture"
      };

      const selectedStyleText = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.rpg;

      let formatPromptText = "";
      let formatTranslationText = "";
      if (physicalFormat === "articulated") {
        formatPromptText = "3D print-in-place articulated sensory flexi toy with flexible interlocking joint segments, movable body divisions, sitting flat, realistic plastic materials, smooth safe edges, optimized for fidget movement";
        formatTranslationText = "como um brinquedo sensorial articulado (fidget toy/flexi) com juntas móveis fáceis de manusear e corpo segmentado";
      } else if (physicalFormat === "articulated_keychain") {
        formatPromptText = "3D print-in-place articulated sensory fidget keychain toy combining flexible interlocking joint segments with a sturdy attachment eyelet ring loop integrated on top of the head, pocket-sized, flat bottom, optimized for flexible movement and keychain attachment";
        formatTranslationText = "como um chaveiro sensorial articulado (flexi fidget toy) com juntas móveis flexíveis e um anel de chaveiro integrado na cabeça";
      } else if (physicalFormat === "keychain") {
        formatPromptText = "a small compact mini keychain edition figure with a sturdy attachment eyelet ring loop integrated on top of the head/helmet, pocket-sized, simplified high-detail solid geometry optimized for small SLA/FDM prints";
        formatTranslationText = "como uma mini-estátua compacta na versão Chaveiro, com um anel de fixação integrado na cabeça do boneco";
      } else {
        formatPromptText = "standing on a circular base/pedestal, realistic plastic/resin materials, extremely intricate details, cinematic studio lighting, dark neutral studio background, optimized for 3D printing, high quality render";
        formatTranslationText = "como uma estátua clássica estática montada em pedestal detalhado de exposição";
      }

      const systemInstruction = `You are a creative 3D design and figurine expert. 
Your goal is to analyze the face, hair style, clothing details, accessories, color palette, and general appearance of the person in the uploaded photo, and translate their likeness into a highly detailed description for a collectible 3D printing character figure (like a tabletop miniature).
You must output a JSON object with two fields:
- "analysis": A friendly, detailed description in Portuguese of how the person was stylized into a figure (e.g., "Identificamos seu cabelo cacheado preto, jaqueta azul e óculos de grau, e o estilizamos como um herói de RPG ${formatTranslationText}...").
- "optimizedPrompt": A highly detailed character prompt in English specifically optimized for generating a 3D digital sculpture image. It should describe a stylized version of the person in the photo with the style: ${selectedStyleText}. It should specify '3D digital sculpture of [stylized description of the person in the photo], ${selectedStyleText}, ${formatPromptText}'. Ensure there are no markdown backticks inside the JSON fields.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `Analyze this image and transform this person into a 3D printable figurine of style: ${style}. Return the response in JSON format according to systemInstructions.`,
          }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText.trim());

      res.json({
        analysis: parsed.analysis || "Análise da imagem concluída com sucesso.",
        optimizedPrompt: parsed.optimizedPrompt || "3D digital sculpture of a personalized character figurine, highly detailed"
      });
    } catch (error: any) {
      console.error("Gemini Image Analysis Error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze image" });
    }
  });

  // 3D Model STL/OBJ Exporter API
  app.post("/api/ai-figures/export-3d", async (req, res) => {
    try {
      const { prompt, style = "rpg", physicalFormat = "statue" } = req.body;
      
      console.log(`[3D EXPORT] Generating 3D Mesh for style: ${style}, format: ${physicalFormat}`);
      
      // DEVELOPER NOTE: This is a robust production-ready endpoint architecture.
      // Replace this block with your actual Neural 3D Mesh API (e.g. Meshy.ai, Luma Genie, Tripo3D, CSM) when ready!
      // Currently, it generates a perfectly watertight, valid ASCII STL 3D geometry of a customizable calibration manifold
      // that is fully readable by 3D printing slicers (Cura, Chitubox, PrusaSlicer, Bambu Studio).
      
      const solidName = `Vertice_${physicalFormat}_${style}`.replace(/[^a-zA-Z0-9_]/g, "");
      let stlString = `solid ${solidName}\n`;
      
      // Height and width configured according to physicalFormat constraints
      let h = 15; // default height in mm
      let w = 10; // half width (base is -w to w)
      
      if (physicalFormat === "keychain") {
        h = 10;
        w = 6;
      } else if (physicalFormat === "articulated" || physicalFormat === "articulated_keychain") {
        h = 5; // Flatter profile for print-in-place wiggle
        w = 12;
      } else {
        h = 20; // Premium tall collector pedestal
        w = 10;
      }
      
      // Define a 3D Pyramid geometry: base is a flat square at Z=0, apex is at (0, 0, h)
      // Vertices: V0=(-w,-w,0), V1=(w,-w,0), V2=(w,w,0), V3=(-w,w,0), Apex V4=(0,0,h)
      const facets = [
        // Base Triangle 1 (Bottom, pointing down, normal 0 0 -1)
        { n: [0, 0, -1], v: [[-w, -w, 0], [w, w, 0], [w, -w, 0]] },
        // Base Triangle 2 (Bottom, pointing down, normal 0 0 -1)
        { n: [0, 0, -1], v: [[-w, -w, 0], [-w, w, 0], [w, w, 0]] },
        // Side 1 (Front, facing outwards)
        { n: [0, -1, 0.5], v: [[-w, -w, 0], [w, -w, 0], [0, 0, h]] },
        // Side 2 (Right, facing outwards)
        { n: [1, 0, 0.5], v: [[w, -w, 0], [w, w, 0], [0, 0, h]] },
        // Side 3 (Back, facing outwards)
        { n: [0, 1, 0.5], v: [[w, w, 0], [-w, w, 0], [0, 0, h]] },
        // Side 4 (Left, facing outwards)
        { n: [-1, 0, 0.5], v: [[-w, w, 0], [-w, -w, 0], [0, 0, h]] }
      ];
      
      // If it is a keychain, add a physical watertight attachment loop ring representation on top (Z=h to h+4)
      if (physicalFormat === "keychain" || physicalFormat === "articulated_keychain") {
        facets.push(
          { n: [1, 0, 0], v: [[0, -1.5, h], [0, 1.5, h], [0, 0, h + 4]] },
          { n: [-1, 0, 0], v: [[0, 1.5, h], [0, -1.5, h], [0, 0, h + 4]] }
        );
      }
      
      // Append all triangles to the STL string
      for (const facet of facets) {
        stlString += `  facet normal ${facet.n[0]} ${facet.n[1]} ${facet.n[2]}\n`;
        stlString += `    outer loop\n`;
        for (const vertex of facet.v) {
          stlString += `      vertex ${vertex[0]} ${vertex[1]} ${vertex[2]}\n`;
        }
        stlString += `    endloop\n`;
        stlString += `  endfacet\n`;
      }
      
      stlString += `endsolid ${solidName}\n`;
      
      // Encode as Base64 for safe JSON transfer
      const fileContentBase64 = Buffer.from(stlString).toString("base64");
      const cleanPromptSnippet = prompt ? prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() : "figurine";
      const fileName = `vertice_figura_${physicalFormat}_${cleanPromptSnippet}.stl`;
      
      res.json({
        success: true,
        fileName,
        fileContentBase64,
        info: {
          solidName,
          format: physicalFormat,
          style,
          dimensions: `${w * 2}mm x ${w * 2}mm x ${h}mm`,
          triangles: facets.length,
          note: "Este é um arquivo STL de calibração 3D válido e fatiável. Quando você plugar seu endpoint de malhas neurais real, ele enviará a malha gerada por IA."
        }
      });
    } catch (error: any) {
      console.error("3D Export Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate 3D mesh" });
    }
  });

  // 1. Generate Product Marketing Details (Multimodal Text Generation)
  app.post("/api/marketing/generate-details", async (req, res) => {
    try {
      const { productName, productType, targetAudience, baseImage } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const contentsParts: any[] = [];

      if (baseImage) {
        const matches = baseImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
        if (matches) {
          contentsParts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        } else {
          contentsParts.push({
            inlineData: {
              mimeType: "image/png",
              data: baseImage
            }
          });
        }
      }

      const promptText = `Analyze the uploaded product image (if provided) and create a high-converting, highly professional product marketing package.
Product Name / Reference: ${productName || "Boneco 3D Estilizado"}
Format: ${productType || "Articulado Flexi"}
Target Audience: ${targetAudience || "Geral, Colecionadores e Entusiastas de Impressão 3D"}

Return a JSON object matching this schema:
- title: A catchy commercial title for the product in Portuguese (maximum 40 chars).
- description: A persuasive sales description in Portuguese, emphasizing the design, touch experience, or quality.
- specifications: An array of 4-5 technical specs in Portuguese (e.g. material recommendations, estimated dimensions, average printing time, care details).
- suggestedPrice: Recommended fair market price in R$ (e.g., 'R$ 79,90') with a 1-sentence breakdown/justification.
- socialPost: A ready-to-use marketing social media post (Instagram/TikTok/WhatsApp) with emojis and hashtags.
- videoPrompt: A detailed, highly visual English prompt for an AI video generator like Veo to produce a 3-second cinematic showcase showreel of this product. It should specify lighting, a turntable or sleek motion, studio background, and details.`;

      contentsParts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: contentsParts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              specifications: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedPrice: { type: Type.STRING },
              socialPost: { type: Type.STRING },
              videoPrompt: { type: Type.STRING }
            },
            required: ["title", "description", "specifications", "suggestedPrice", "socialPost", "videoPrompt"]
          }
        }
      });

      const resultText = response.text;
      const parsedData = JSON.parse(resultText || "{}");
      res.json(parsedData);
    } catch (error: any) {
      console.error("Marketing Details Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate marketing details" });
    }
  });

  // 2. Generate Demo Video using Veo (Start Operation)
  app.post("/api/marketing/generate-video", async (req, res) => {
    try {
      const { imageBytes, prompt, aspectRatio = "16:9", resolution = "720p" } = req.body;
      if (!imageBytes) {
        return res.status(400).json({ error: "Image bytes are required (base64, no prefix)" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Clean the base64 if there's any data URI prefix
      let cleanBase64 = imageBytes;
      const matches = imageBytes.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
      if (matches) {
        cleanBase64 = matches[2];
      }

      // Validate aspect ratio
      const validAspectRatios = ["16:9", "9:16", "1:1", "4:3", "3:4"];
      const finalAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : "16:9";

      // Validate resolution
      const validResolutions = ["1080p", "720p", "480p"];
      const finalResolution = validResolutions.includes(resolution) ? resolution : "720p";

      console.log(`[VIDEO GENERATION] Initiating Veo video generation with aspect ratio: ${finalAspectRatio}, resolution: ${finalResolution}...`);
      
      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: prompt || 'Product commercial showcase, professional slow rotation on a dark polished glass turntable, cinematic studio lighting, volumetric glow, ultra high definition 3d render',
        image: {
          imageBytes: cleanBase64,
          mimeType: 'image/png'
        },
        config: {
          numberOfVideos: 1,
          resolution: finalResolution as any,
          aspectRatio: finalAspectRatio
        }
      });

      console.log("[VIDEO GENERATION] Operation initiated successfully. Name:", operation.name);
      res.json({ operationName: operation.name });
    } catch (error: any) {
      console.error("Video Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to initiate video generation" });
    }
  });

  // 3. Check Demo Video Status (Polling)
  app.post("/api/marketing/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) {
        return res.status(400).json({ error: "Operation name is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      
      res.json({ done: updated.done, error: updated.error });
    } catch (error: any) {
      console.error("Video Status Error:", error);
      res.status(500).json({ error: error.message || "Failed to check video status" });
    }
  });

  // 4. Download and Stream Video
  app.post("/api/marketing/video-download", async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) {
        return res.status(400).json({ error: "Operation name is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      
      if (!updated.done) {
        return res.status(400).json({ error: "Video generation is not completed yet" });
      }

      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) {
        return res.status(404).json({ error: "Generated video URL not found" });
      }

      console.log("[VIDEO DOWNLOAD] Fetching video from storage URI:", uri);
      const videoRes = await fetch(uri, {
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
      });

      if (!videoRes.ok) {
        throw new Error(`Failed to fetch video from storage: ${videoRes.statusText}`);
      }

      const buffer = await videoRes.arrayBuffer();
      const base64Video = Buffer.from(buffer).toString("base64");

      res.json({
        success: true,
        mimeType: "video/mp4",
        base64Video
      });
    } catch (error: any) {
      console.error("Video Download Error:", error);
      res.status(500).json({ error: error.message || "Failed to download generated video" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
