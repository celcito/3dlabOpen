/**
 * Gemini and Imagen AI Services for Puzzle & Memory Game Generation
 */

export interface GenerationProgress {
  current: number;
  total: number;
  message?: string;
}

export async function generatePuzzleImage(
  prompt: string,
  style: string = "Desenho infantil",
  model: string = "gemini-3.1-flash-lite-image",
  aspectRatio: string = "1:1"
): Promise<string> {
  const response = await fetch("/api/puzzle/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, style, model, aspectRatio }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Falha ao gerar imagem com IA.");
  }

  const data = await response.json();
  return data.imageUrl;
}

/**
 * Generates an array of unique, thematic images for a memory game.
 * Uses rate-limiting and dedicated fallbacks so all cards are distinct and relevant.
 */
export async function generateMemoryGameImages(
  theme: string,
  pairsCount: number = 6,
  style: string = "Desenho infantil",
  model: string = "gemini-3.1-flash-lite-image",
  onProgress?: (progress: GenerationProgress) => void
): Promise<string[]> {
  onProgress?.({ current: 0, total: pairsCount, message: "Criando lista de cartas temáticas..." });

  // 1. Get thematic distinct prompt items
  const themeRes = await fetch("/api/puzzle/generate-memory-themes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme, count: pairsCount, style }),
  });

  let validItems: string[] = [];
  if (themeRes.ok) {
    const data = await themeRes.json();
    if (Array.isArray(data.items) && data.items.length >= pairsCount) {
      validItems = data.items.slice(0, pairsCount);
    }
  }

  // Fallback items if theme generation returned fewer items
  if (validItems.length < pairsCount) {
    const prefix = theme.trim();
    for (let i = validItems.length; i < pairsCount; i++) {
      validItems.push(`${prefix} - Item Ilustrado ${i + 1}`);
    }
  }

  const generatedImages: string[] = [];
  const total = validItems.length;

  for (let i = 0; i < total; i++) {
    const itemPrompt = validItems[i];
    onProgress?.({
      current: i + 1,
      total,
      message: `Gerando carta ${i + 1} de ${total}: "${itemPrompt}"...`
    });

    try {
      // Slight delay between image API calls to prevent rate limiting (429)
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      const imgUrl = await generatePuzzleImage(itemPrompt, style, model, "1:1");
      generatedImages.push(imgUrl);
    } catch (err) {
      console.warn(`Aviso ao gerar carta ${i + 1} ("${itemPrompt}"):`, err);
      // Fallback: request specifically the procedural artwork for THIS specific prompt
      try {
        const fallbackRes = await fetch("/api/puzzle/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: itemPrompt, style, model: "procedural", aspectRatio: "1:1" }),
        });
        const fallbackData = await fallbackRes.json();
        generatedImages.push(fallbackData.imageUrl);
      } catch (fallbackErr) {
        console.error("Falha no fallback de arte procedural:", fallbackErr);
      }
    }
  }

  if (generatedImages.length === 0) {
    throw new Error("Não foi possível gerar as cartas do jogo da memória. Tente novamente.");
  }

  return generatedImages;
}
