FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-devel

WORKDIR /app

# Deps de sistema — python3-dev necessário pro build do torchmcubes
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    git \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala requirements principais
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Clona TripoSR e instala deps — sem o requirements.txt dele (pins velhos conflitam)
RUN git clone --depth 1 https://github.com/VAST-AI-Research/TripoSR.git /opt/TripoSR && \
    rm -rf /opt/TripoSR/.git

# Instala deps do TripoSR manualmente com versões compatíveis
RUN pip install --no-cache-dir \
    omegaconf==2.3.0 \
    einops==0.7.0 \
    scikit-image>=0.21.0 \
    rembg

# Instala torchmcubes (CUDA extension para marching cubes do TripoSR)
RUN pip install --no-cache-dir git+https://github.com/tatsy/torchmcubes.git

# Garante versões corretas no final (sobrescreve qualquer conflito)
RUN pip install --no-cache-dir \
    "huggingface-hub>=0.34.0,<2.0.0" \
    "transformers>=4.35.0,<4.45.0" \
    "tokenizers>=0.19.0"

ENV PYTHONPATH="/opt/TripoSR:${PYTHONPATH}"

COPY app.py jobs.py triposr_runner.py convert.py decimate.py text_to_image.py tripo_api.py _mcubes_shim.py ./

RUN mkdir -p /tmp/jobs

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001", "--log-level", "info"]