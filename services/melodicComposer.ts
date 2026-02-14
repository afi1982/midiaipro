
import { NoteEvent, GenreDNAProfile } from '../types';
import { theoryEngine } from './theoryEngine';

const TICKS_PER_16TH = 120;

export type ComplexityLevel = 'SIMPLE' | 'COMPLEX';

export const melodicComposer = {
    
    // --- MOTIF LOGIC ---
    
    createMotif(length: number = 16, range: number = 7, dna?: GenreDNAProfile): number[] {
        const motif = [];
        const rhythmMask = dna?.rhythmMask16 || [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
        const brainDensityFactor = dna ? (dna.avgLeadDensity / 8) : 1; 

        for (let i = 0; i < length; i++) {
            const isStrongBeat = i % 4 === 0;
            const maskValue = rhythmMask[i % 16] || 0;
            const playChance = (maskValue * 0.7) + (isStrongBeat ? 0.3 : 0);
            const shouldPlay = Math.random() < (playChance * brainDensityFactor);

            if (shouldPlay) {
                if (isStrongBeat) {
                    const anchors = [0, 0, 2, 4, 7]; 
                    motif.push(anchors[Math.floor(Math.random() * anchors.length)]);
                } else {
                    motif.push(Math.floor(Math.random() * range));
                }
            } else {
                motif.push(-1); 
            }
        }
        return motif;
    },

    mutateMotif(motif: number[], range: number = 7): number[] {
        const newMotif = [...motif];
        const mutationCount = Math.max(1, Math.floor(motif.length * 0.25)); 
        for(let i=0; i<mutationCount; i++) {
            const idx = Math.floor(Math.random() * motif.length);
            if (newMotif[idx] !== -1) {
                const shift = Math.random() > 0.5 ? 1 : -1;
                newMotif[idx] = Math.max(0, Math.min(range, newMotif[idx] + shift));
            } else {
                if (Math.random() > 0.7) newMotif[idx] = Math.floor(Math.random() * range);
            }
        }
        return newMotif;
    },

    // --- GENERATION LOGIC ---

    generateBar(
        barIndex: number, 
        root: number, 
        scale: number[], 
        role: string, 
        motif?: number[], 
        isTransition?: boolean,
        complexity: ComplexityLevel = 'COMPLEX',
        dna?: GenreDNAProfile,
        sessionMask?: number[] 
    ): NoteEvent[] {
        const events: NoteEvent[] = [];
        const baseTick = barIndex * 1920;
        let currentMotif = motif || [0, -1, 2, -1, 4, -1, 2, -1, 0, -1, 5, -1, 2, -1, 1, -1];
        const r = role.toUpperCase();

        // --- LEAD / ARP ---
        if (r.includes('LEAD') || r.includes('ARP')) {
            const isArp = r.includes('ARP');
            for (let step = 0; step < 16; step++) {
                const noteIndex = currentMotif[step % currentMotif.length];
                if (noteIndex === -1) continue; 

                // COMPLEX ONLY: Octave jumps and rhythmic filters
                if (complexity === 'COMPLEX') {
                    const dnaMask = dna?.rhythmMask16 ? dna.rhythmMask16[step] : 1;
                    if (sessionMask && sessionMask[step] === 0 && dnaMask < 0.5 && !isArp && Math.random() > 0.2) continue;
                }

                const scaleDegree = noteIndex % scale.length;
                const octaveShift = Math.floor(noteIndex / scale.length);
                let midiNote = root + (scale[scaleDegree] || 0) + (octaveShift * 12);
                
                // COMPLEX ONLY: Dynamics and extra movement
                if (complexity === 'COMPLEX' && isArp && step % 4 === 2) midiNote += 12;

                events.push({
                    note: theoryEngine.midiToNote(midiNote),
                    time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                    duration: "custom",
                    durationTicks: isArp ? 100 : (complexity === 'SIMPLE' ? 240 : 150),
                    startTick: baseTick + (step * TICKS_PER_16TH),
                    velocity: (complexity === 'SIMPLE') ? 0.9 : (step % 4 === 0 ? 1.0 : 0.8)
                });
            }
        }
        
        // --- ACID ---
        else if (r.includes('ACID')) {
             for (let step = 0; step < 16; step++) {
                if (currentMotif[step % 16] === -1) continue;
                // SIMPLE ACID: Just notes. COMPLEX ACID: Filter movement simulation (velocity variance)
                let midiNote = root + (scale[step % 3] || 0);
                events.push({
                    note: theoryEngine.midiToNote(midiNote),
                    time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                    duration: "16n",
                    durationTicks: 120,
                    startTick: baseTick + (step * TICKS_PER_16TH),
                    velocity: complexity === 'SIMPLE' ? 0.85 : 0.8 + (Math.sin(step) * 0.2)
                });
             }
        }

        // --- PAD / ATMOSPHERE ---
        else if (r.includes('PAD')) {
            const voicing = [0, 4, 7]; // Root, 3rd, 5th
            if (complexity === 'SIMPLE') {
                // SIMPLE PAD: One long chord per bar
                voicing.forEach(interval => {
                    events.push({
                        note: theoryEngine.midiToNote(root + (scale[interval % scale.length] || 0)),
                        time: `${barIndex}:0:0`,
                        duration: "1n",
                        durationTicks: 1920,
                        startTick: baseTick,
                        velocity: 0.5
                    });
                });
            } else {
                // COMPLEX PAD: Gated Rhythms based on Motif/Mask
                for (let step = 0; step < 16; step++) {
                    const isActive = currentMotif[step % 16] !== -1 || (sessionMask && sessionMask[step % 16] === 1);
                    if (isActive) {
                        voicing.forEach(interval => {
                            events.push({
                                note: theoryEngine.midiToNote(root + (scale[interval % scale.length] || 0)),
                                time: `${barIndex}:${Math.floor(step/4)}:${step%4}`,
                                duration: "16n",
                                durationTicks: 105, 
                                startTick: baseTick + (step * TICKS_PER_16TH),
                                velocity: 0.4 + (Math.random() * 0.2)
                            });
                        });
                    }
                }
            }
        }

        return events;
    }
};
