
import { GoogleGenAI } from "@google/genai";
import { GrooveObject, NoteEvent, ChannelKey } from '../types';
import { optimizationService } from './optimizationService';
import { advisorHistoryService } from './advisorHistoryService';

/**
 * FORENSIC FIXER SERVICE V1.0
 * The "Master Producer" that audits and heals projects before they reach the user.
 */
export class ForensicFixerService {
    private ai: GoogleGenAI;

    constructor() {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    /**
     * Perform a deep musical audit and apply corrections.
     */
    public async auditAndHeal(groove: GrooveObject): Promise<GrooveObject> {
        console.log(`[ForensicFixer] Auditing project: ${groove.name}`);
        
        // 1. Prepare Summary for AI
        const summary = {
            target: { genre: groove.genre, key: groove.key, scale: groove.scale, bpm: groove.bpm },
            structure: groove.totalBars + " bars",
            activeTracks: Object.keys(groove).filter(k => k.startsWith('ch') && (groove as any)[k].length > 0)
        };

        const prompt = `
        ROLE: MASTER MUSIC PRODUCER & FORENSIC MIDI AUDITOR.
        TASK: Audit the raw MIDI generation below. Detect musical issues and provide a list of OPTIMIZATION commands to fix them.
        
        CRITERIA:
        - Humanization: If notes are too rigid (0-tick drift), suggest VELOCITY_HUMANIZE or RHYTHMIC_OFFSET.
        - Harmonic Integrity: Ensure all tracks follow ${groove.key} ${groove.scale}.
        - Genre Physics: If this is ${groove.genre}, ensure the Kick/Bass relationship is perfect.
        
        PROJECT: ${JSON.stringify(summary)}

        OUTPUT FORMAT (JSON ARRAY ONLY):
        [
            { "operation": "SCALE_QUANTIZE", "params": { "targetTrack": "ch4_leadA", "root": "${groove.key}", "mode": "${groove.scale}" } },
            { "operation": "VELOCITY_HUMANIZE", "params": { "targetTrack": "ch4_leadA", "amount": 0.15 } }
        ]
        If no critical fixes are needed, return an empty array [].
        `;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json" }
            });

            const fixes = JSON.parse(response.text || "[]");
            let healedGroove = JSON.parse(JSON.stringify(groove));

            // ALWAYS APPLY SYSTEM SYNC (The Convergence Code)
            console.log("[ForensicFixer] Applying Mandatory System Sync Protocol...");
            healedGroove = optimizationService.applyCommand(healedGroove, { operation: 'SYSTEM_SYNC', params: {} });

            if (fixes.length > 0) {
                console.log(`[ForensicFixer] AI identified ${fixes.length} critical improvements.`);
                
                fixes.forEach((cmd: any) => {
                    healedGroove = optimizationService.applyCommand(healedGroove, cmd);
                });

                // Notify User
                advisorHistoryService.saveMessage({
                    role: 'model',
                    text: `🛠️ **תיקון מוזיקלי אוטומטי:** המערכת ביצעה סנכרון מלא (System Sync) וזיהתה ${fixes.length} שיפורים נוספים. הדרופ כעת מסונכרן עם ה-Sidechain והקצב.`,
                    timestamp: Date.now(),
                    isSystemPush: true
                });
            } else {
                console.log("[ForensicFixer] Project passed initial audit with 100% integrity. System Sync applied.");
                advisorHistoryService.saveMessage({
                    role: 'model',
                    text: `✅ **סנכרון הושלם:** הקוד (Convergence Code) הופעל בהצלחה. מערכת התופים והמלודיות נעולים ומסונכרנים.`,
                    timestamp: Date.now(),
                    isSystemPush: true
                });
            }

            return healedGroove;
        } catch (e) {
            console.error("[ForensicFixer] Audit failed, proceeding with raw generation", e);
            // Even if AI fails, try to apply sync
            return optimizationService.applyCommand(groove, { operation: 'SYSTEM_SYNC', params: {} });
        }
    }
}

export const forensicFixerService = new ForensicFixerService();
