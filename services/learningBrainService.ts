
import type { KnowledgeRecord } from '../types/learning';
import { GrooveObject } from '../types';
import { learningLogService } from './learningLogService';

export { KnowledgeRecord };

const BRAIN_STATE_KEY = "EMG_BRAIN_STATE_V38";
const RECORDS_KEY = "EMG_KNOWLEDGE_RECORDS_V38";

// Legacy keys to scan for recovery
const LEGACY_KEYS = [
    "EMG_KNOWLEDGE_RECORDS_V28",
    "EMG_KNOWLEDGE_RECORDS_V1",
    "TRANCEGEN_REFS_V1",
    "MIDI_KNOWLEDGE_BASE",
    "EMG_BRAIN_MEMORIES"
];

export function getBrainLogTxt() {
    return learningLogService.getLogsAsText();
}

export function getBrainStats() {
    try {
        const recordsRaw = localStorage.getItem(RECORDS_KEY);
        const records = recordsRaw ? JSON.parse(recordsRaw) : [];
        
        const rawState = localStorage.getItem(BRAIN_STATE_KEY);
        const state = rawState ? JSON.parse(rawState) : { perGenre: {} };
        
        const byGenre: Record<string, number> = {};
        Object.entries(state.perGenre || {}).forEach(([k, v]: [string, any]) => {
            byGenre[k] = v.samples || 0;
        });

        return { 
            total: Array.isArray(records) ? records.length : 0, 
            byGenre,
            lastUpdated: state.updatedAt || 'Never'
        };
    } catch (e) {
        return { total: 0, byGenre: {}, lastUpdated: 'Error' };
    }
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
  learnedParams?: {
      rhythmTemplates?: number[][];
  };
}

export class LearningBrainService {
  private memoryBuffer: string[] = [];

  constructor() {
      this.emergencyLegacyRecover();
      this.syncBrainWithRecords();
  }

  /**
   * EMERGENCY: Scan all possible previous storage locations and migrate data.
   */
  private emergencyLegacyRecover() {
      try {
          const currentRecords = this.listRecords();
          if (currentRecords.length > 0) return; // Already has data, skip recovery

          console.log("[Brain] Starting Emergency Storage Recovery...");
          let recoveredCount = 0;
          let allRecovered: KnowledgeRecord[] = [];

          LEGACY_KEYS.forEach(key => {
              const raw = localStorage.getItem(key);
              if (raw) {
                  try {
                      const data = JSON.parse(raw);
                      if (Array.isArray(data) && data.length > 0) {
                          console.log(`[Brain] Found legacy data in ${key} (${data.length} files)`);
                          allRecovered = [...allRecovered, ...data];
                      }
                  } catch (e) {}
              }
          });

          if (allRecovered.length > 0) {
              // Deduplicate by filename
              const unique = Array.from(new Map(allRecovered.map(item => [item.sourceFileName || item.id, item])).values());
              localStorage.setItem(RECORDS_KEY, JSON.stringify(unique.slice(-5000)));
              console.log(`[Brain] Successfully recovered ${unique.length} legacy files.`);
          }
      } catch (e) {
          console.error("[Brain] Recovery Failed", e);
      }
  }

  /**
   * CRITICAL: Self-Healing Sync
   * Rebuilds the fast-lookup index from the physical record array.
   */
  public syncBrainWithRecords() {
      try {
          const records = this.listRecords();
          const state = this.loadBrainState();
          
          let totalSamplesInState = 0;
          Object.values(state.perGenre || {}).forEach((g: any) => totalSamplesInState += g.samples || 0);

          // Force rebuild if there's a clear mismatch
          if (records.length > 0 && (totalSamplesInState === 0 || totalSamplesInState < records.length * 0.5)) {
              console.warn(`[Brain] Sync Mismatch: Found ${records.length} records but ${totalSamplesInState} in index. Rebuilding...`);
              
              const newState: any = { version: 38, updatedAt: new Date().toISOString(), perGenre: {} };
              
              records.forEach(rec => {
                  const gId = rec.genre || "UNKNOWN";
                  if (!newState.perGenre[gId]) {
                      newState.perGenre[gId] = { 
                          samples: 0, 
                          densityTarget: 8, 
                          melodyRangeSemitones: 12, 
                          userRefinements: { densityBias: 0, variationBias: 0, movementBias: 0, feedbackCount: 0 }, 
                          lastSources: [],
                          learnedParams: { rhythmTemplates: [] }
                      };
                  }
                  newState.perGenre[gId].samples++;
                  newState.perGenre[gId].lastSources.unshift({ file: rec.sourceFileName || "Unnamed File" });
                  
                  if (rec.dna?.trackStats?.[0]?.rhythmMask16) {
                      newState.perGenre[gId].learnedParams.rhythmTemplates.unshift(rec.dna.trackStats[0].rhythmMask16);
                  }
              });

              // Apply limits
              Object.keys(newState.perGenre).forEach(k => {
                  newState.perGenre[k].lastSources = newState.perGenre[k].lastSources.slice(0, 20);
                  if (newState.perGenre[k].learnedParams) {
                      newState.perGenre[k].learnedParams.rhythmTemplates = newState.perGenre[k].learnedParams.rhythmTemplates.slice(0, 10);
                  }
              });

              this.saveBrainState(newState);
          }
      } catch (e) {
          console.error("[Brain] Sync Failed", e);
      }
  }

  public loadBrainState() {
    try {
      const raw = localStorage.getItem(BRAIN_STATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { version: 38, updatedAt: new Date().toISOString(), perGenre: {} };
  }

  public listRecords(): KnowledgeRecord[] {
      try {
          const raw = localStorage.getItem(RECORDS_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
  }

  public getGenreDNA(genreId: string): GenreBrainDNA {
    const state = this.loadBrainState();
    
    // If specific genre is empty, look for 'UNKNOWN' or 'GENERAL'
    let dna = (state.perGenre && state.perGenre[genreId]);
    
    if (!dna || dna.samples === 0) {
        // Fallback to average stats from all genres if user has ANY memories
        const allRecords = this.listRecords();
        if (allRecords.length > 0) {
            return {
                samples: allRecords.length,
                densityTarget: 8.5,
                melodyRangeSemitones: 12,
                userRefinements: { densityBias: 0.1, variationBias: 0.1, movementBias: 0.1, feedbackCount: 0 },
                lastSources: allRecords.slice(0, 3).map(r => ({ file: r.sourceFileName || "Global Sync" })),
                learnedParams: { rhythmTemplates: [] }
            };
        }
    }

    return dna || {
      samples: 0,
      densityTarget: 8,
      melodyRangeSemitones: 12,
      userRefinements: { densityBias: 0, variationBias: 0, movementBias: 0, feedbackCount: 0 },
      lastSources: []
    };
  }

  public getShortTermMemory(): string {
      if (this.memoryBuffer.length === 0) return "";
      return `\n[RECENTLY LEARNED KNOWLEDGE]:\n${this.memoryBuffer.join('\n')}\n`;
  }

  public addMemory(insight: string) {
      this.memoryBuffer.push(`- ${insight}`);
      if (this.memoryBuffer.length > 5) this.memoryBuffer.shift();
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
      
      const updated = [...records, newRecord].slice(-5000); 
      localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
      
      const state = this.loadBrainState();
      state.updatedAt = new Date().toISOString();
      if (!state.perGenre) state.perGenre = {};
      if (!state.perGenre[params.genre]) {
          state.perGenre[params.genre] = { samples: 0, densityTarget: 8, melodyRangeSemitones: 12, userRefinements: { densityBias: 0, variationBias: 0, movementBias: 0, feedbackCount: 0 }, lastSources: [] };
      }
      state.perGenre[params.genre].samples++;
      state.perGenre[params.genre].lastSources.unshift({ file: params.fileName });
      state.perGenre[params.genre].lastSources = state.perGenre[params.genre].lastSources.slice(0, 20);
      
      if (params.extractedDNA && params.extractedDNA.trackStats) {
          const complexTrack = params.extractedDNA.trackStats.reduce((prev: any, curr: any) => (prev?.noteDensity || 0) > (curr?.noteDensity || 0) ? prev : curr, params.extractedDNA.trackStats[0]);
          if (complexTrack && complexTrack.rhythmMask16) {
              if (!state.perGenre[params.genre].learnedParams) {
                  state.perGenre[params.genre].learnedParams = { rhythmTemplates: [] };
              }
              state.perGenre[params.genre].learnedParams.rhythmTemplates.unshift(complexTrack.rhythmMask16);
              state.perGenre[params.genre].learnedParams.rhythmTemplates = state.perGenre[params.genre].learnedParams.rhythmTemplates.slice(0, 10);
          }
      }

      this.saveBrainState(state);
      this.addMemory(`Learned structure from ${params.fileName}. Memory committed to Genre ID: ${params.genre}`);

      learningLogService.append({
          type: "DNA_COMMITTED",
          genre: params.genre,
          runId: newRecord.id,
          reason: "Neural Ingest Successful",
          file: params.fileName
      });

      return newRecord;
  }

  public optimizeGenreDNA(genreId: string, deltas: any, reason: string) {
      const state = this.loadBrainState();
      if (!state.perGenre[genreId]) {
          state.perGenre[genreId] = {
              samples: 0,
              densityTarget: 8,
              melodyRangeSemitones: 12,
              userRefinements: { densityBias: 0, variationBias: 0, movementBias: 0, feedbackCount: 0 },
              lastSources: []
          };
      }

      const dna = state.perGenre[genreId];
      if (deltas.density) dna.userRefinements.densityBias += deltas.density;
      if (deltas.variation) dna.userRefinements.variationBias += deltas.variation;
      if (deltas.syncopation) dna.userRefinements.movementBias += deltas.syncopation;
      dna.userRefinements.feedbackCount++;
      dna.userRefinements.lastInstruction = reason;

      this.saveBrainState(state);
      
      learningLogService.append({
          type: "DNA_OPTIMIZED",
          genre: genreId,
          reason: `Refined via feedback: ${reason}`
      });
  }

  public bootstrapIfEmpty(force: boolean = false) {
      const records = this.listRecords();
      if (records.length === 0 || force) {
          const seeds = [
              { genre: 'PSYTRANCE_FULLON', name: 'Elite_FullOn_Seed.mid' },
              { genre: 'TECHNO_PEAK', name: 'Elite_Techno_Seed.mid' },
              { genre: 'GOA_TRANCE', name: 'Elite_Goa_Seed.mid' }
          ];

          seeds.forEach(seed => {
              this.ingestMidiKnowledge({
                  fileName: seed.name,
                  genre: seed.genre,
                  extractedDNA: {
                      bpmEstimate: 145,
                      bpmConfidence: 1,
                      noteDensityAvg: 0.5,
                      velocityAvg: 0.8,
                      syncopationScore: 0.5,
                      pitchRange: { min: 36, max: 84 },
                      trackStats: [
                          { roleHint: 'KICK', noteDensity: 4, pitchMin: 36, pitchMax: 36, avgVelocity: 1, rhythmMask16: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0] }
                      ]
                  },
                  learningScore: 100,
                  qualityTags: ['SYSTEM_DEFAULT', 'HIGH_QUALITY'],
                  contributionTags: ['FOUNDATION', 'RHYTHM']
              });
          });
      }
  }

  private saveBrainState(state: any) {
    localStorage.setItem(BRAIN_STATE_KEY, JSON.stringify(state));
  }

  public clearBrain() {
      localStorage.removeItem(RECORDS_KEY);
      localStorage.removeItem(BRAIN_STATE_KEY);
      this.memoryBuffer = [];
      learningLogService.clearLogs();
  }
}

export const learningBrainService = new LearningBrainService();
