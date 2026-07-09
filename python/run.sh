#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies..."

if python -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
    echo "CUDA GPU detected — installing PyTorch with CUDA support"
    TORCH_INDEX=""
else
    echo "No GPU — installing PyTorch CPU-only"
    TORCH_INDEX="--index-url https://download.pytorch.org/whl/cpu"
fi

pip install --upgrade --force-reinstall torch torchvision $TORCH_INDEX
pip install -r requirements.txt

# Clonar TripoSR se não existir
TRIPOSR_DIR="$HOME/TripoSR"
if [ ! -d "$TRIPOSR_DIR" ]; then
    echo "Cloning TripoSR..."
    git clone --depth 1 https://github.com/VAST-AI-Research/TripoSR.git "$TRIPOSR_DIR"
fi

# Instala torchmcubes (sempre — tem fallback CPU)
echo "Installing torchmcubes..."
pip install --no-cache-dir git+https://github.com/tatsy/torchmcubes.git

# Instala deps do TripoSR que NÃO estão no requirements.txt principal
pip install \
    "huggingface-hub>=0.34.0,<2.0.0" \
    "transformers>=4.35.0,<4.45.0" \
    "tokenizers>=0.19.0" \
    rembg \
    xatlas \
    moderngl \
    "imageio[ffmpeg]"

export PYTHONPATH="$TRIPOSR_DIR:${PYTHONPATH:-}"

MODE="${1:-serve}"

if [ "$MODE" = "test" ]; then
    TEST_IMAGE="${2:-$TRIPOSR_DIR/examples/chair.png}"
    TEST_OUTPUT="${3:-$SCRIPT_DIR/output}"

    echo "Running TripoSR test inference..."
    echo "  Image:  $TEST_IMAGE"
    echo "  Output: $TEST_OUTPUT"
    echo "  Device: $(python -c "import torch; print('cuda' if torch.cuda.is_available() else 'cpu')")"

    python "$TRIPOSR_DIR/run.py" "$TEST_IMAGE" --output-dir "$TEST_OUTPUT"
    echo "Done. Mesh saved to $TEST_OUTPUT/"
    exit 0
fi

if [ "$MODE" = "gradio" ]; then
    echo "Starting TripoSR Gradio app..."
    python "$TRIPOSR_DIR/gradio_app.py"
    exit 0
fi

echo "Starting TripoSR API on port 8001..."
exec uvicorn app:app --host 127.0.0.1 --port 8001 --reload --log-level info