import { GoogleGenAI } from "@google/genai";

export interface FilePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

// Danh sách model theo thứ tự ưu tiên — tự động fallback nếu model trước lỗi
const FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export async function generatePromptDirectly(
  text: string,
  mood: string,
  apiKey: string,
  filePart?: FilePart,
  preferredModel?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [
    {
      text: `Create a highly detailed AI image generation prompt (for Midjourney or DALL-E 3) to create an educational infographic mindmap based on the provided input.
      
      Mood: ${mood}.
      
      CRITICAL INSTRUCTIONS:
      - STRICTLY summarize the provided input. Do NOT add any information that is not present in the source material.
      - Do NOT remove any key information. The prompt should capture the essence of the entire input accurately.
      - ONLY use information provided in the input. Do NOT hallucinate or add extra days, dates, or topics not mentioned.
      - Ensure each branch is unique. Do NOT repeat titles or content.
      - Be precise and accurate to the source material.
      
      STYLE SPECIFICATIONS:
      - Format: Educational infographic mindmap, horizontal layout.
      - Style: Cute hand-drawn cartoon, whiteboard style, markers and colored pencils texture, soft drop shadows.
      - Central Element: A large, cute chibi-style character (like a happy lightbulb, a curious child, or a friendly animal) in the middle, radiating joy.
      - Branches: Colorful, thick, curved hand-drawn lines (pink, blue, green, yellow) radiating from the center to various nodes.
      - Nodes: Each node contains a small, adorable icon (kawaii style) and the branch title.
      - Text: The main title at the top in a large, bold, rounded, hand-written font. Branch titles and bullet points in a clear, friendly hand-written style. (Note: Use Vietnamese text if the input was in Vietnamese).
      - Background: Clean white paper or whiteboard background with subtle decorative elements like sparkles, stars, and small hearts.
      - Overall Vibe: Warm, inviting, child-friendly, professional yet playful, high-quality illustration.
      
      Input Content: ${text || "Please analyze the attached file."}
      
      Return ONLY the final prompt string.`
    }
  ];

  if (filePart) {
    parts.push(filePart);
  }

  // Xây danh sách models: model ưu tiên của user (nếu có) → fallback list
  const modelsToTry = preferredModel
    ? [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)]
    : FALLBACK_MODELS;

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
      });
      return response.text ?? '';
    } catch (err: any) {
      lastError = err;
      console.warn(`Model "${model}" thất bại:`, err?.message ?? err);
      // Nếu lỗi là 401 (API key sai), không cần thử model khác
      if (err?.status === 401 || err?.message?.includes('API_KEY_INVALID')) {
        throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại.');
      }
    }
  }

  // Tất cả models đều thất bại
  throw lastError ?? new Error('Không thể kết nối tới AI. Vui lòng thử lại.');
}
