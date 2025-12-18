
import { GoogleGenAI, Type } from "@google/genai";
import { Material } from "../types";

export const generateMockMaterials = async (count: number = 5): Promise<Omit<Material, 'id' | 'createdAt'>[]> => {
  try {
    // Guidelines: Always obtain API Key exclusively from process.env.API_KEY
    // Guidelines: Create instance right before use to ensure latest key from environment
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate ${count} realistic industrial material master records for a cable and electrical corporation. 
      Include items like Power Cables, Control Cables, Bearings, Connectors, and Sensors.
      The 'make' should be real brands (e.g., LAPP, POLYCAB, KEI, FINOLEX, SIEMENS).
      The 'partNo' should be alphanumeric technical part numbers.
      The 'materialGroup' should be short codes like "CABLE-PWR", "ELEC-CONN", "MECH-BRG".`,
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

    // Guidelines: Directly access .text property
    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("AI Generation Error:", error);
    return [];
  }
};
