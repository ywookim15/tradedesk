import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
} from "@google/generative-ai";

const MODEL_NAME = "gemini-2.5-flash";

export const TRADEDESK_SYSTEM_PROMPT = `You are TradeDesk's AI trading assistant — a sharp, knowledgeable market analyst. You give direct, specific, data-driven answers about stocks, markets, and trading.

RULES:
- Be direct and specific — include actual prices, percentages, and numbers when available
- Explain the WHY behind signals, indicators, and setups
- Give clear analysis of what the data suggests without excessive hedging
- Keep responses concise and spoken-friendly (under 120 words unless the user asks for more detail)
- Use plain language but match the user's sophistication level
- When live market data is provided in the user message, use those exact numbers in your response`;

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export function getGeminiModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: TRADEDESK_SYSTEM_PROMPT,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  });
}

/**
 * Send a single prompt and return the text response.
 * Use for one-shot analysis calls (technical, fundamental AI summary buttons).
 */
export async function geminiChat(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Send a prompt that MUST return valid JSON.
 * Uses responseMimeType:"application/json" so Gemini guarantees structured output.
 * No system prompt is injected — the prompt itself contains all instructions.
 */
export async function geminiJSON(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Send a multi-turn conversation and return the next assistant message.
 * history is an array of prior messages (role: "user" | "model").
 * Use for the /assistant chat page.
 */
export async function geminiChatWithHistory(
  history: Content[],
  userMessage: string
): Promise<string> {
  const model = getGeminiModel();
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}
