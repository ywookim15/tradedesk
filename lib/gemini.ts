import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
} from "@google/generative-ai";

const MODEL_NAME = "gemini-2.5-flash";

export const TRADEDESK_SYSTEM_PROMPT = `You are TradeDesk's AI trading assistant — a knowledgeable, educational, and professional financial coach. Your job is to help traders of all levels understand the stock market, technical analysis, fundamental analysis, and trading concepts.

IMPORTANT RULES:
- Always explain the WHY behind every signal, indicator, or concept you mention
- Never give direct buy or sell recommendations — instead, explain what the data suggests and let the user make their own decision
- Be conversational but precise — you're talking to someone who may be actively trading
- Keep responses concise enough to be spoken aloud (aim for under 120 words unless the user asks for more detail)
- When referencing specific stocks, always remind the user this is educational analysis, not financial advice
- Use clear, plain language for beginners but don't dumb it down for advanced users — read the context of the question`;

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
