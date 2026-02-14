
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const theoryEngine = {
    getMidiNote: (note: string): number => {
        if (!note) return 60;
        const match = note.match(/([A-G]#?)(-?\d+)/);
        if (!match) return 60;
        const name = match[1];
        const octave = parseInt(match[2]);
        return (octave + 1) * 12 + NOTE_NAMES.indexOf(name);
    },

    midiToNote: (midi: number): string => {
        const octave = Math.floor(midi / 12) - 1;
        const name = NOTE_NAMES[midi % 12];
        return `${name}${octave}`;
    },

    getScaleNotes: (root: string, scaleName: string): string[] => {
        const rootIndex = NOTE_NAMES.indexOf(root);
        if (rootIndex === -1) return NOTE_NAMES; // Fallback

        // Semitone intervals
        let intervals = [0, 2, 4, 5, 7, 9, 11]; // Major
        const s = scaleName.toLowerCase();
        if (s.includes('minor') || s.includes('aeolian')) intervals = [0, 2, 3, 5, 7, 8, 10];
        else if (s.includes('phrygian')) intervals = [0, 1, 3, 5, 7, 8, 10];
        else if (s.includes('dorian')) intervals = [0, 2, 3, 5, 7, 9, 10];
        else if (s.includes('mixolydian')) intervals = [0, 2, 4, 5, 7, 9, 10];
        else if (s.includes('lydian')) intervals = [0, 2, 4, 6, 7, 9, 11];
        else if (s.includes('harmonic')) intervals = [0, 2, 3, 5, 7, 8, 11];

        // Generate allowed notes (pitch classes)
        return intervals.map(i => NOTE_NAMES[(rootIndex + i) % 12]);
    },

    isNoteInScale: (note: string, root: string, scaleName: string): boolean => {
        if (!note) return true;
        const noteName = note.replace(/-?\d+/, '');
        const allowed = theoryEngine.getScaleNotes(root, scaleName);
        return allowed.includes(noteName);
    },

    getClosestNoteInScale: (note: string, root: string, scaleName: string): string => {
        if (theoryEngine.isNoteInScale(note, root, scaleName)) return note;

        const midi = theoryEngine.getMidiNote(note);
        const allowed = theoryEngine.getScaleNotes(root, scaleName);
        
        // Search neighbors (up/down up to 6 semitones)
        for (let i = 1; i <= 6; i++) {
            const up = midi + i;
            const down = midi - i;
            
            const upName = theoryEngine.midiToNote(up);
            if (allowed.includes(upName.replace(/-?\d+/, ''))) return upName;

            const downName = theoryEngine.midiToNote(down);
            if (allowed.includes(downName.replace(/-?\d+/, ''))) return downName;
        }
        return note; // Should not happen given intervals cover octave
    }
};
