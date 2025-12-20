
import { GoogleGenAI, Type } from "@google/genai";
import { Material } from "../types";

// Lazy initialization to prevent crash on startup if API key is undefined
let aiInstance: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API_KEY is missing. AI features will not work.");
      // Initialize with a dummy key to prevent immediate crash, but calls will fail gracefully
      aiInstance = new GoogleGenAI({ apiKey: "missing-key" });
    } else {
      aiInstance = new GoogleGenAI({ apiKey });
    }
  }
  return aiInstance;
};

export const generateMockMaterials = async (count: number = 5): Promise<Omit<Material, 'id' | 'createdAt'>[]> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      // Using gemini-3-flash-preview for mock data generation as per guidelines
      model: "gemini-3-flash-preview",
      contents: `Generate ${count} realistic industrial material master records. 
      Focus on items like bearings, motors, sensors, valves, or electronic components.
      The 'make' should be real industrial brands (e.g., Siemens, SKF, Festo).
      The 'partNo' should look like alphanumeric technical part numbers.
      The 'materialGroup' should be a short category code or name (e.g., "MECH-01", "ELEC-SENSOR").`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING, description: "Technical description of the item" },
              partNo: { type: Type.STRING, description: "Manufacturer part number" },
              make: { type: Type.STRING, description: "Manufacturer brand name" },
              materialGroup: { type: Type.STRING, description: "Category or Material Group code" }
            },
            required: ["description", "partNo", "make", "materialGroup"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Failed to generate materials:", error);
    // Return empty array instead of throwing to prevent UI break
    return [];
  }
};
