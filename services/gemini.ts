import { GoogleGenerativeAI } from "@google/generative-ai";
import { Material } from "../types";

export const generateMockMaterials = async (count: number = 5): Promise<Omit<Material, 'id' | 'createdAt'>[]> => {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key missing for material generation.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Generate ${count} realistic industrial material master records as a valid JSON array.
    Focus on items like bearings, motors, sensors, valves, or electronic components.
    The 'make' should be real industrial brands (e.g., Siemens, SKF, Festo).
    The 'partNo' should look like alphanumeric technical part numbers.
    The 'materialGroup' should be a short category code or name (e.g., "MECH-01", "ELEC-SENSOR").
    
    The JSON structure should be:
    [
      {
        "description": "string",
        "partNo": "string",
        "make": "string",
        "materialGroup": "string"
      }
    ]
    RETURN ONLY THE JSON ARRAY. NO MARKDOWN FORMATTING.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Clean up potential markdown code blocks if the model adds them despite instructions
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleanText);

  } catch (error) {
    console.error("Failed to generate materials:", error);
    return [];
  }
};
