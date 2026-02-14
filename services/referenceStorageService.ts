
import { ReferenceMidiFile, GenreDNAProfile, StyleDNAProfile, MusicGenre } from '../types';

const STORAGE_KEY_REFS = 'TRANCEGEN_REFS_V1';
const STORAGE_KEY_GENRE_DNA = 'TRANCEGEN_GENRE_DNA_V1';

export const referenceStorageService = {
    // --- CRUD ---
    getAllReferences: (): ReferenceMidiFile[] => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_REFS);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("Failed to load references", e);
            return [];
        }
    },

    saveReference: (ref: ReferenceMidiFile) => {
        const refs = referenceStorageService.getAllReferences();
        const existingIdx = refs.findIndex(r => r.id === ref.id);
        
        if (existingIdx >= 0) refs[existingIdx] = ref;
        else refs.unshift(ref); // Add to top

        localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(refs.slice(0, 100))); // Limit 100
        
        // Auto-rebuild genre DNA if analyzed
        if (ref.analysisStatus === 'ANALYZED') {
            referenceStorageService.rebuildGenreDNA(ref.genreTag);
        }
    },

    deleteReference: (id: string) => {
        const refs = referenceStorageService.getAllReferences();
        const updated = refs.filter(r => r.id !== id);
        localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(updated));
    },

    // --- AGGREGATION ---
    getGenreDNA: (genre: string): GenreDNAProfile | null => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_GENRE_DNA);
            const allDna: Record<string, GenreDNAProfile> = raw ? JSON.parse(raw) : {};
            return allDna[genre] || null;
        } catch (e) {
            return null;
        }
    },

    rebuildGenreDNA: (genre: string): GenreDNAProfile | null => {
        const refs = referenceStorageService.getAllReferences().filter(
            r => r.genreTag === genre && r.analysisStatus === 'ANALYZED' && r.analysisResult
        );

        if (refs.length === 0) return null;

        let totalLeadDensity = 0;
        let totalBassDensity = 0;
        let rhythmAggregator = new Array(16).fill(0);
        let minPitch = 127;
        let maxPitch = 0;
        let leadCount = 0;
        let bassCount = 0;

        refs.forEach(ref => {
            const dna = ref.analysisResult!;
            
            dna.trackStats.forEach(track => {
                // Heuristic Role Detection
                const isBass = track.pitchMax < 55 && track.noteDensity > 2; // Rough heuristic
                const isLead = track.pitchMin > 60 && track.noteDensity > 1;

                if (isBass) {
                    totalBassDensity += track.noteDensity;
                    bassCount++;
                } else if (isLead) {
                    totalLeadDensity += track.noteDensity;
                    leadCount++;
                    
                    // Add to Rhythm Mask (weighted by density)
                    track.rhythmMask16.forEach((val, idx) => {
                        rhythmAggregator[idx] += val;
                    });

                    if (track.pitchMin < minPitch) minPitch = track.pitchMin;
                    if (track.pitchMax > maxPitch) maxPitch = track.pitchMax;
                }
            });
        });

        // Normalize
        const avgLeadDensity = leadCount > 0 ? totalLeadDensity / leadCount : 0.5; // fallback
        const avgBassDensity = bassCount > 0 ? totalBassDensity / bassCount : 0.8; // fallback
        
        // Normalize Rhythm Mask
        const maxMaskVal = Math.max(...rhythmAggregator) || 1;
        const normalizedMask = rhythmAggregator.map(v => v / maxMaskVal);

        const profile: GenreDNAProfile = {
            genreTag: genre,
            avgLeadDensity,
            avgBassDensity,
            rhythmMask16: normalizedMask,
            pitchRange: { min: minPitch === 127 ? 60 : minPitch, max: maxPitch === 0 ? 84 : maxPitch },
            updatedAt: Date.now(),
            sampleCount: refs.length
        };

        // Save
        const raw = localStorage.getItem(STORAGE_KEY_GENRE_DNA);
        const allDna: Record<string, GenreDNAProfile> = raw ? JSON.parse(raw) : {};
        allDna[genre] = profile;
        localStorage.setItem(STORAGE_KEY_GENRE_DNA, JSON.stringify(allDna));

        return profile;
    }
};
