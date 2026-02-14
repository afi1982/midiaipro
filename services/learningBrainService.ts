
import { KnowledgeRecord } from '../types/learning';
import { GrooveObject } from '../types';
import { learningLogService } from './learningLogService';

export { KnowledgeRecord };

export const getBrainLogTxt = () => learningLogService.getLogsAsText();

export function getBrainStats() {
    const raw = localStorage.getItem("EMG_BRAIN_STATE_V38");
    const state = raw ? JSON.parse(raw) : { perGenre: {} };
    const byGenre: Record<string, number> = {};
    Object.entries(state.perGenre || {}).forEach(([k, v]: [string, any]) => {
        byGenre[k] = v.samples || 0;
    });
    return { total: Object.values(byGenre).reduce((a, b) => a + b, 0), byGenre };
}

export function resolveGenreId(genre: string): string {
    return genre.toUpperCase().replace(/\s+/g, '_');
}

export interface GenreBrainDNA {
  samples: number;
  densityTarget: number;
  melodyRangeSemitones: number;
  userRefinements: {
    densityBias: number;
    variationBias: number;
    movementBias: number;
    feedbackCount: number;
    lastInstruction?: string; 
  };
  lastSources: Array<{ file: string }>;
}

export class LearningBrainService {
  private memoryBuffer: string[] = []; // Short term memory for the active session

  public loadBrainState() {
    try {
      const raw = localStorage.getItem("EMG_BRAIN_STATE_V38");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { version: 38, updatedAt: new Date().toISOString(), perGenre: {} };
  }

  public listRecords(): KnowledgeRecord[] {
      try {
          const raw = localStorage.getItem("EMG_KNOWLEDGE_RECORDS_V38");
          return raw ? JSON.parse(raw) : [];
      } catch { return []; }
  }

  public getGenreDNA(genreId: string): GenreBrainDNA {
    const state = this.loadBrainState();
    return (state.perGenre && state.perGenre[genreId]) || {
      samples: 0,
      densityTarget: 8,
      melodyRangeSemitones: 12,
      userRefinements: { densityBias: 0, variationBias: 0, movementBias: 0, feedbackCount: 0 },
      lastSources: []
    };
  }

  // --- NEW: Context Retrieval for AI Advisor ---
  public getShortTermMemory(): string {
      if (this.memoryBuffer.length === 0) return "";
      return `\n[RECENTLY LEARNED KNOWLEDGE]:\n${this.memoryBuffer.join('\n')}\n(Use this knowledge to optimize the code you generate).`;
  }

  public addMemory(insight: string) {
      this.memoryBuffer.push(`- ${insight}`);
      if (this.memoryBuffer.length > 5) this.memoryBuffer.shift(); // Keep last 5 insights
  }

  public async ingestMidiKnowledge(params: any): Promise<KnowledgeRecord> {
      const records = this.listRecords();
      const newRecord: KnowledgeRecord = {
          id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          createdAtISO: new Date().toISOString(),
          sourceFileName: params.fileName,
          genre: params.genre,
          dna: params.extractedDNA,
          learningScore: params.learningScore,
          qualityTags: params.qualityTags || [],
          contributionTags: params.contributionTags || []
      };
      
      const updated = [...records, newRecord].slice(-100);
      localStorage.setItem("EMG_KNOWLEDGE_RECORDS_V38", JSON.stringify(updated));
      
      const state = this.loadBrainState();
      if (!state.perGenre) state.perGenre = {};
      if (!state.perGenre[params.genre]) {
          state.perGenre[params.genre] = { samples: 0, densityTarget: 8, melodyRangeSemitones: 12, userRefinements: { densityBias: 0, variationBias: 0, movementBias: 0, feedbackCount: 0 }, lastSources: [] };
      }
      state.perGenre[params.genre].samples++;
      state.perGenre[params.genre].lastSources.push({ file: params.fileName });
      
      this.saveBrainState(state);
      
      const logMsg = `Learned MIDI structure from ${params.fileName} (Score: ${params.learningScore}). Density: ${params.extractedDNA?.noteDensityAvg?.toFixed(2)}`;
      this.addMemory(logMsg);

      learningLogService.append({
          type: "COMMITTED",
          genre: params.genre,
          runId: newRecord.id,
          reason: "Manual MIDI Ingest",
          score: params.learningScore
      });

      return newRecord;
  }

  // --- NEW: AUDIO DNA LEARNING ---
  public generateInsightFromAudioDNA(dna: any): string {
    const genreId = resolveGenreId(dna.genre || 'UNKNOWN');
    const state = this.loadBrainState();
    if (!state.perGenre) state.perGenre = {};
    if (!state.perGenre[genreId]) {
        state.perGenre[genreId] = { samples: 0, densityTarget: 8, melodyRangeSemitones: 12, userRefinements: { densityBias: 0, variationBias: 0, movementBias: 0, feedbackCount: 0 }, lastSources: [] };
    }
    
    const stats = state.perGenre[genreId];
    stats.samples++;
    
    // Learning Logic: Translate analysis into generation weights
    const isDense = dna.leadDensity === 'DENSE';
    const isComplex = dna.melodicComplexity === 'COMPLEX';
    const isRollingBass = dna.bassPattern === 'ROLLING';
    
    // Update Weights based on observation
    // (This makes future generations statistically closer to the uploaded track)
    if (isDense) stats.densityTarget = Math.min(16, stats.densityTarget + 1);
    else stats.densityTarget = Math.max(4, stats.densityTarget - 0.5);
    
    if (isComplex) stats.melodyRangeSemitones = Math.min(24, stats.melodyRangeSemitones + 2);
    
    this.saveBrainState(state);
    
    learningLogService.append({
        type: "AUDIO_DNA_LEARNED",
        genre: genreId,
        traits: { dense: isDense, complex: isComplex, rolling: isRollingBass }
    });

    const insight = `Analyzed AUDIO [${genreId}]: Bass=${dna.bassPattern}, LeadDensity=${dna.leadDensity}. Updated weights for future generation.`;
    this.addMemory(insight);
    
    return insight;
  }

  private saveBrainState(state: any) {
    localStorage.setItem("EMG_BRAIN_STATE_V38", JSON.stringify(state));
  }

  public clearBrain() {
      localStorage.removeItem("EMG_KNOWLEDGE_RECORDS_V38");
      localStorage.removeItem("EMG_BRAIN_STATE_V38");
      this.memoryBuffer = [];
      learningLogService.clearLogs();
  }

  public bootstrapIfEmpty(force = false) {
      const records = this.listRecords();
      if (records.length === 0 || force) {
          console.log("[Brain] Bootstrapping...");
          // Implementation of bootstrap logic...
      }
  }

  public logEvent(event: any) {
      learningLogService.append(event);
  }

  public generateAuthoritativeQA(groove: any): string {
      return `QA Report for ${groove.id}`;
  }

  public generateBrainReport(groove: any): { txt: string, json: string } {
      return { txt: "Brain Report", json: "{}" };
  }
  
  public optimizeGenreDNA(genre: string, deltas: any, reason: string) {
      const state = this.loadBrainState();
      const id = resolveGenreId(genre);
      if(!state.perGenre[id]) return;
      
      const dna = state.perGenre[id];
      if (deltas.density) dna.userRefinements.densityBias += deltas.density;
      dna.userRefinements.feedbackCount++;
      dna.userRefinements.lastInstruction = reason;
      
      this.saveBrainState(state);
      this.addMemory(`User Feedback Learning: ${reason}`);
  }
}

export const learningBrainService = new LearningBrainService();
