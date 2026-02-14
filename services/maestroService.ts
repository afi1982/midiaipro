
import { 
  GrooveObject, NoteEvent, ChannelKey, GenerationParams, AetherGenome, 
  SectionType, EnergyLevel, ArrangementSegment, MusicGenre
} from '../types.ts';
import { generateTranceSequence } from './geminiService.ts';
import { optimizationService } from './optimizationService.ts';
import { melodicComposer, ComplexityLevel } from './melodicComposer.ts';
import { theoryEngine } from './theoryEngine';
import { referenceStorageService } from './referenceStorageService.ts';
import { learningBrainService, resolveGenreId } from './learningBrainService.ts';

const TICKS_PER_BAR = 1920;

export const ELITE_16_CHANNELS: ChannelKey[] = [
  'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB', 
  'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop', 
  'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad', 'ch16_synth'
];

export const SUPPORTED_CHANNELS = ELITE_16_CHANNELS;

// --- DYNAMIC PROCEDURAL GENERATORS ---

/**
 * KICK GENERATOR V116: Deep differentiation between Simple/Complex
 */
const generateKick = (bars: number, complexity: ComplexityLevel = 'SIMPLE', sessionMask?: number[], genre?: string): NoteEvent[] => {
    const notes: NoteEvent[] = [];
    const brainDna = genre ? learningBrainService.getGenreDNA(resolveGenreId(genre)) : null;
    
    // SIMPLE = Always Straight 4/4
    if (complexity === 'SIMPLE') {
        for (let b = 0; b < bars; b++) {
            for (let i = 0; i < 4; i++) {
                notes.push({ note: 'C1', velocity: 1.0, durationTicks: 120, time: `${b}:${i}:0`, duration: "16n", startTick: (b * TICKS_PER_BAR) + (i * 480) });
            }
        }
        return notes;
    }

    // COMPLEX = Varied Grooves
    const kickModes = ['DOUBLE_SHOT', 'GHOST_GROOVE', 'PEAK_TECHNO'];
    let mode = kickModes[Math.floor(Math.random() * kickModes.length)];
    if (brainDna && brainDna.densityTarget > 12) mode = 'PEAK_TECHNO';

    for (let b = 0; b < bars; b++) {
        for (let i = 0; i < 4; i++) {
            const baseTick = (b * TICKS_PER_BAR) + (i * 480);
            notes.push({ note: 'C1', velocity: 1.0, durationTicks: 120, time: `${b}:${i}:0`, duration: "16n", startTick: baseTick });

            if (mode === 'DOUBLE_SHOT' && i === 3) {
                notes.push({ note: 'C1', velocity: 0.7, durationTicks: 80, time: `${b}:${i}:2`, duration: "16n", startTick: baseTick + 240 });
            } else if (mode === 'GHOST_GROOVE' && i % 2 === 1) {
                notes.push({ note: 'C1', velocity: 0.35, durationTicks: 60, time: `${b}:${i}:2`, duration: "16n", startTick: baseTick + 240 });
            } else if (mode === 'PEAK_TECHNO' && i === 3 && b % 2 === 1) {
                notes.push({ note: 'C1', velocity: 0.6, durationTicks: 100, time: `${b}:${i}:3`, duration: "16n", startTick: baseTick + 360 });
            }
        }
    }
    return notes;
};

/**
 * BASS GENERATOR V116: Real rhythmic variation
 */
const generateBass = (bars: number, key: string, complexity: ComplexityLevel = 'SIMPLE', sessionMask?: number[], genre?: string): NoteEvent[] => {
    const notes: NoteEvent[] = [];
    const root = `${key}1`;
    
    // SIMPLE = Classic Rolling (1, 2, 3)
    if (complexity === 'SIMPLE') {
        const simplePattern = [1, 2, 3];
        for (let b = 0; b < bars; b++) {
            for (let beat = 0; beat < 4; beat++) {
                const baseTick = (b * TICKS_PER_BAR) + (beat * 480);
                simplePattern.forEach(slot => {
                    notes.push({ note: root, velocity: 0.9, durationTicks: 100, time: `${b}:${beat}:${slot}`, duration: "16n", startTick: baseTick + (slot * 120) });
                });
            }
        }
        return notes;
    }

    // COMPLEX = Pattern Library
    const brainDna = genre ? learningBrainService.getGenreDNA(resolveGenreId(genre)) : null;
    const rhythmMask = brainDna?.lastSources.length ? referenceStorageService.getGenreDNA(genre!)?.rhythmMask16 : null;
    
    const patterns = [
        [1, 2, 3],       // Rolling
        [2, 3],          // Offbeat
        [1.5, 2.5, 3.5], // Syncopated Slaps
        [1, 1.5, 2, 3]   // Galloping
    ];
    const usePattern = patterns[Math.floor(Math.random() * patterns.length)];

    for (let b = 0; b < bars; b++) {
        for (let beat = 0; beat < 4; beat++) {
            const baseTick = (b * TICKS_PER_BAR) + (beat * 480);
            usePattern.forEach(slot => {
                const tickOffset = Math.floor(slot * 120);
                const maskIndex = (beat * 4 + Math.floor(slot)) % 16;
                let vel = 0.85;
                if (rhythmMask && rhythmMask[maskIndex] > 0.6) vel += 0.15;
                if (sessionMask && sessionMask[maskIndex] > 0.5) vel += 0.05;
                notes.push({ note: root, velocity: Math.min(1.0, vel), durationTicks: 100, time: `${b}:${beat}:${Math.floor(slot)}`, duration: "16n", startTick: baseTick + tickOffset });
            });
        }
    }
    return notes;
};

// --- MAESTRO SERVICE ---

export const maestroService = {
  calculateSmartStoryMap: (g: any) => {
    if (!g) return { trackId: 'error', totalBars: 0, channels: [] };
    const totalBars = g.totalBars || 128;
    return {
      trackId: g.id, totalBars,
      channels: (ELITE_16_CHANNELS || []).map(chKey => {
        const notes = (g[chKey] || []) as NoteEvent[];
        const segments: number[][] = [];
        if (!Array.isArray(notes) || notes.length === 0) return { id: chKey, segments: [] };
        let start = -1;
        for(let b=0; b<totalBars; b++) {
            const hasNotes = notes.some(n => n && Math.floor((n.startTick || 0) / 1920) === b);
            if (hasNotes && start === -1) start = b;
            if (!hasNotes && start !== -1) { segments.push([start, b]); start = -1; }
        }
        if (start !== -1) segments.push([start, totalBars]);
        return { id: chKey, segments };
      })
    };
  },

  generateSingle4BarLoop: (
      channel: ChannelKey, 
      bpm: number, 
      key: string, 
      scale: string, 
      complexity: ComplexityLevel = 'COMPLEX',
      pattern?: number[],
      sessionMask?: number[] 
  ): NoteEvent[] => {
      const bars = 4;
      const rootMidi = theoryEngine.getMidiNote(`${key}3`);
      const scaleIntervals = [0, 2, 3, 5, 7, 8, 10]; 
      const learnedDna = referenceStorageService.getGenreDNA('Psytrance'); 

      // Motif creation
      let usePattern = pattern || melodicComposer.createMotif(16, 7, learnedDna || undefined);
      
      if (channel === 'ch1_kick') return generateKick(bars, complexity, sessionMask, 'Psytrance');
      if (channel.includes('sub') || channel.includes('midBass')) return generateBass(bars, key, complexity, sessionMask, 'Psytrance');
      
      const notes: NoteEvent[] = [];
      const role = channel.includes('arp') ? 'ARP' : channel.includes('acid') ? 'ACID' : channel.includes('pad') ? 'PAD' : channel.includes('synth') ? 'SYNTH' : 'LEAD';

      for (let b = 0; b < bars; b++) {
          // IMPORTANT: SIMPLE MODE DOES NOT MUTATE (Static loop)
          // COMPLEX MODE MUTATES EVERY BAR for organic movement
          const barMotif = (b > 0 && complexity === 'COMPLEX') ? melodicComposer.mutateMotif(usePattern) : usePattern;
          
          const generated = melodicComposer.generateBar(b, rootMidi, scaleIntervals, role, barMotif, false, complexity, learnedDna || undefined, sessionMask);
          notes.push(...generated);
      }
      
      return notes.map(n => {
          const t = n.startTick || 0;
          const quantizedTick = Math.round(t / 30) * 30;
          return { ...n, startTick: quantizedTick };
      });
  },

  generateGroove: async (params: GenerationParams | any, durationMin: number, channels: ChannelKey[]): Promise<GrooveObject> => {
    const bpm = params.bpm || 145;
    const totalBars = Math.round(((durationMin * bpm) / 4) / 8) * 8;
    const groove: any = { id: `ELITE_${Date.now()}`, name: `${params.genre} Session`, bpm, key: params.key || "F#", scale: params.scale || "Phrygian", totalBars };
    ELITE_16_CHANNELS.forEach(ch => { groove[ch] = []; });
    return groove;
  }
};
