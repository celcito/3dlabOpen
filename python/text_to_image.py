import logging

logger = logging.getLogger(__name__)


def generate_image(
    prompt: str,
    output_path: str,
    clean_prompt: bool = True,
    progress_callback: callable = None,
):
    raise ImportError(
        "text_to_image.generate_image is not yet implemented. "
        "Install diffusers: pip install diffusers accelerate safetensors"
    )
