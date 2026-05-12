import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function explainQuestion(questionText: string, correctAnswer: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a medical expert from TNMU. Explain this KROK medical question in Ukrainian.
      Question: ${questionText}
      Correct Answer: ${correctAnswer}
      
      Provide:
      1. A brief explanation of why the answer is correct (2-3 sentences).
      2. A "Key Word" for quick memorization.
      3. A "Mnemonic" (mental trick) to remember this specific relationship.
      
      Output JSON format:
      {
        "explanation": "...",
        "keyword": "...",
        "mnemonic": "..."
      }`,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Explain Error:", error);
    return {
      explanation: "Пояснення тимчасово недоступне. Перевірте з'єднання з AI.",
      keyword: "Error",
      mnemonic: "N/A"
    };
  }
}

export async function generateMnemonics(topic: string) {
   // Similar logic to above
}
