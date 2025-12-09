import { GoogleGenAI, Type } from "@google/genai";
import { Material } from "../types";

// Lazy initialization to prevent crash on module load if API key is missing
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("Gemini API Key is missing. AI features will not work.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const generateMockMaterials = async (count: number = 5): Promise<Omit<Material, 'id' | 'createdAt'>[]> => {
  try {
    const client = getAiClient();
    if (!client) {
      alert("API Key is missing. Please configure Vercel Environment Variables.");
      return [];
    }

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
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
    throw error;
  }
};