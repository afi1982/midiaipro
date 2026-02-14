
import { GoogleGenAI } from "@google/genai";
import { GenerationParams, AetherGenome, ChannelKey } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- AI GENERATORS ---

export const generateTranceSequence = async (params: GenerationParams, channels?: ChannelKey[]): Promise<AetherGenome> => {
    const channelList = channels ? channels.join(', ') : 'All Channels';
    
    const prompt = `
    Act as a Psytrance Music Producer.
    Generate a full track genome for:
    Genre: ${params.genre}
    BPM: ${params.bpm}
    Key: ${params.key} ${params.scale}
    Target Channels: ${channelList}
    
    Output valid JSON matching this structure:
    {
      "trackName": "Generated Track",
      "patterns": {
        "ch1_kick": { "notes": [{"n":"C1","s":0,"v":1,"d":120}, ...] }
      }
    }
    Use 's' for 16th step index (0-15).
    Ensure patterns are genre-appropriate.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        
        const result = JSON.parse(response.text || '{}');
        return result;
    } catch (e) {
        console.error("AI Generation Failed", e);
        return { trackName: "Fallback", patterns: {} };
    }
};

export const deconstructYoutubeLink = async (url: string): Promise<any> => {
    const prompt = `Analyze this YouTube URL context: ${url}. Return JSON with artist, trackName, bpm, key, scale, explanation. Estimate if unknown.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { artist: "Unknown", trackName: "Link Analysis Failed", bpm: 145 };
    }
};

export const analyzeSystemVideo = async (file: File) => {
    return { status: "MOCK_ANALYSIS", message: "Video analysis requires Vision model integration." };
};

export const analyzeMidiExpert = async (file: File) => {
    return { status: "MOCK_ANALYSIS", message: "MIDI expert analysis placeholder." };
};

export const generateDivineMelody = async (params: any) => {
    const prompt = `Generate a melody for ${JSON.stringify(params)}. Return JSON array of notes [{"n":"C4","s":0,"d":120,"v":0.8},...].`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '[]');
    } catch { return []; }
};

export const geminiService = {
    analyzeStyleAndGenerate: async (artistName: string, params: GenerationParams) => {
        return generateTranceSequence(params);
    }
};
