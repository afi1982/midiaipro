
import { GoogleGenAI } from "@google/genai";
import { GrooveObject } from "../types";
import { advisorHistoryService } from "./advisorHistoryService";
import { innovationService } from "./innovationService";

/**
 * NEURAL MONITOR V1.3 (TEACHER EDITION)
 * Core logic for automated post-generation musical audits.
 */
class NeuralMonitorService {
    private lastSnapshot: string = "";
    private timeout: any = null;
    private isAnalyzing: boolean = false;
    private ai: GoogleGenAI;

    // Use Flash for idle monitoring, Pro for Master Teacher audits
    private MONITOR_MODEL = 'gemini-3-flash-preview';
    private TEACHER_MODEL = 'gemini-3-pro-preview';

    constructor() {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    /**
     * Standard observer for manual changes.
     */
    public observe(groove: GrooveObject | null) {
        if (!groove) return;

        let totalNotes = 0;
        const keys = Object.keys(groove).filter(k => k.startsWith('ch'));
        keys.forEach(k => {
            if (Array.isArray((groove as any)[k])) {
                totalNotes += (groove as any)[k].length;
            }
        });

        const currentSnap = JSON.stringify({ 
            bars: groove.totalBars, 
            activeChannelsCount: keys.filter(k => (groove as any)[k].length > 0).length,
            totalEventCount: totalNotes,
            bpm: groove.bpm,
            genre: groove.genre
        });

        if (currentSnap === this.lastSnapshot) return;
        this.lastSnapshot = currentSnap;

        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.analyzeBackground(groove);
        }, 10000); 
    }

    /**
     * MASTER TEACHER AUDIT (IMMEDIATE)
     * Triggered by the Pipeline at the end of every generation.
     */
    public async analyzeGenerationImmediate(groove: GrooveObject) {
        console.log("[NeuralMonitor] Initiating Master Teacher Forensic Audit...");
        
        // Notify user in history
        advisorHistoryService.saveMessage({
            role: 'model',
            text: `🧬 **היצירה הושלמה.** המורה המאסטר מנתח כעת את המבנה המוזיקלי...`,
            timestamp: Date.now(),
            isSystemPush: true
        });

        const prompt = `
        ROLE: World-Class Music Production Master Teacher & Algorithm Architect.
        TASK: Audit the newly generated MIDI track. Be technical, artistic, and direct.
        
        PROJECT DATA:
        - Genre: ${groove.genre}
        - BPM: ${groove.bpm}
        - Key: ${groove.key} ${groove.scale}
        - Track Name: ${groove.name}
        - Active Channels: ${Object.keys(groove).filter(k => k.startsWith('ch') && (groove as any)[k].length > 0).join(', ')}
        
        CRITIQUE REQUIREMENTS:
        1. **Musicality:** Does the arrangement flow? Is the low-end balanced?
        2. **Technical Issues:** Check for grid conflicts or lack of dynamics.
        3. ** Hebrew Feedback:** Write the "review" section in Hebrew.
        4. **Innovation:** If there's an algorithmic weakness, provide a JSON fix for the "innovation" field.
        
        OUTPUT FORMAT (JSON ONLY):
        {
            "review": "ביקורת מפורטת בעברית. השתמש במושגים מקצועיים (Sidechain, Phasing, Phrygian).",
            "grade": "A-E",
            "score": 0-100,
            "improvement": "One specific actionable step for the user.",
            "innovation": { "title": "...", "description": "...", "category": "LOGIC", "priority": "HIGH" } | null
        }
        `;

        try {
            const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await aiInstance.models.generateContent({
                model: this.TEACHER_MODEL,
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json" }
            });

            if (response.text) {
                const result = JSON.parse(response.text.replace(/```json\n?|```/g, ""));
                
                let masterMessage = `🎓 **דו"ח מורה מאסטר:**\n\n${result.review}\n\n**ציון מוזיקלי:** ${result.score}/100 (${result.grade})\n**הצעה לשיפור:** ${result.improvement}`;
                
                advisorHistoryService.saveMessage({
                    role: 'model',
                    text: masterMessage,
                    timestamp: Date.now(),
                    isSystemPush: true
                });

                if (result.innovation) {
                    innovationService.addProposal(result.innovation);
                    advisorHistoryService.saveMessage({
                        role: 'model',
                        text: `🛠️ **שיפור אלגוריתמי מוצע:** זיהיתי פוטנציאל לשיפור בלוגיקת הייצור ("${result.innovation.title}"). ההצעה נוספה למרכז החדשנות.`,
                        timestamp: Date.now(),
                        isSystemPush: true
                    });
                }
            }
        } catch (e) {
            console.error("[NeuralMonitor] Immediate Audit Failed", e);
        }
    }

    private async analyzeBackground(groove: GrooveObject) {
        if (this.isAnalyzing) return;
        this.isAnalyzing = true;

        try {
            const prompt = `
            ROLE: Background Studio Assistant.
            CONTEXT: User is idle. Project: ${groove.genre} @ ${groove.bpm}.
            TASK: Short studio tip based on the context.
            OUTPUT JSON: { "message": "..." }
            `;

            const response = await this.ai.models.generateContent({
                model: this.MONITOR_MODEL,
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json" }
            });

            if (response.text) {
                const result = JSON.parse(response.text.replace(/```json\n?|```/g, ""));
                if (result.message) {
                    advisorHistoryService.saveMessage({
                        role: 'model',
                        text: `💡 **טיפ אולפן:** ${result.message}`,
                        timestamp: Date.now(),
                        isSystemPush: true
                    });
                }
            }
        } catch (e) {
            // Silent fail
        } finally {
            this.isAnalyzing = false;
        }
    }
}

export const neuralMonitorService = new NeuralMonitorService();
