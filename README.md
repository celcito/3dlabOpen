
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e70f375f-a99d-4a66-81e6-9da01e2b1f2b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Image-to-3D API (Python / FastAPI)

API local para conversão de imagens em malhas 3D (GLB/OBJ/STL), com suporte a
TripoSR local, Tripo AI (cloud) e Meshy AI.

### Pré-requisitos

- Python 3.10+
- GPU NVIDIA com CUDA (opcional — funciona em CPU, porém mais lento)
- ~4 GB de disco para dependências + modelo TripoSR

### Executar

```bash
cd python
./run.sh
```

O `run.sh` cria o `venv` automaticamente, instala PyTorch (CPU ou CUDA), clona o
[TripoSR](https://github.com/VAST-AI-Research/TripoSR) em `~/TripoSR` se necessário,
e inicia a API em **http://127.0.0.1:8001**.

Modos de execução:

| Comando | Descrição |
|---|---|
| `./run.sh` | Inicia a API FastAPI (padrão) |
| `./run.sh test [imagem] [saida]` | Roda inferência TripoSR em uma imagem |
| `./run.sh gradio` | Abre a interface Gradio do TripoSR |

### Variáveis de ambiente (opcionais)

| Variável | Descrição |
|---|---|
| `TRIPO_API_KEY` | Chave da API Tripo AI (geração em nuvem) |
| `MESHY_API_KEY` | Chave da API Meshy AI |
| `TRIPO_MODEL_VERSION` | Versão do modelo Tripo (padrão: `v2.0-20240919`) |

### Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/generate` | Envia imagem (PNG/JPG/WEBP) e retorna `jobId` |
| `GET` | `/jobs/{id}/status` | Status do job (processing / done / error) |
| `GET` | `/jobs/{id}/stream` | SSE em tempo real com progresso |
| `GET` | `/jobs/{id}/file/{fmt}` | Download do resultado (`glb`, `obj`, `stl`) |
| `GET` | `/providers` | Lista provedores disponíveis (local/tripo/meshy) |
| `POST` | `/text-to-3d` | Gera malha a partir de texto (local apenas) |
| `POST` | `/decimate` | Reduz poligonos de uma malha |
| `GET` | `/health` | Health check |

### Exemplo rápido (curl)

```bash
# Gerar modelo 3D a partir de uma imagem
curl -X POST http://127.0.0.1:8001/generate \
  -F "image=@minha_foto.png" \
  -F "provider=local" \
  -F "mc_resolution=256"

# Retorna: {"jobId": "abc123"}

# Consultar status
curl http://127.0.0.1:8001/jobs/abc123/status

# Baixar resultado
curl -o modelo.glb http://127.0.0.1:8001/jobs/abc123/file/glb
```

---

## Split3MF is now the default workflow

`/` redireciona para **[/split-3mf](http://localhost:3000/split-3mf)** — importe 3MF/GLB/OBJ
coloridos, segmentação automática por cor, editor de fronteira por pincel, 5 cap methods,
4 connector types e export multi-cor em 3MF/GLB/OBJ/STL. 100% client-side, zero upload.

- Fluxo legado de pintura manual continua em `/viewer3d`.
- TDD: [`docs/tdd/SPLIT3MF_V2_REVIVAL.md`](docs/tdd/SPLIT3MF_V2_REVIVAL.md)
- Testes: `npm test` (unit) · `npm run test:e2e` (Playwright)
