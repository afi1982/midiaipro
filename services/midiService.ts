
import { Midi } from '@tonejs/midi';
import { GrooveObject, NoteEvent, ChannelKey } from '../types.ts';
import MidiWriter from 'midi-writer-js'; 
import { maestroService, ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';

const INTERNAL_PPQ = 480;
const TICKS_PER_BAR = 1920;

// --- HELPER: SORT BY TICK ---
const sortByTick = (a: any, b: any) => {
    const tA = a.startTick ?? a.tick ?? 0;
    const tB = b.startTick ?? b.tick ?? 0;
    return tA - tB;
};

// --- HELPER: SANITIZE OVERLAPS ---
const sanitizeForWriter = (rawEvents: NoteEvent[], isForensic: boolean): NoteEvent[] => {
    const events = rawEvents.filter(n => n && (n.note || (n as any).pitch)).map(n => ({...n}));
    events.sort(sortByTick);
    if (events.length === 0) return [];
    
    if (isForensic) return events;

    const sanitized: NoteEvent[] = [];
    for (let i = 0; i < events.length; i++) {
        const current = events[i];
        if ((current.durationTicks || 0) <= 0) current.durationTicks = 120;
        const next = events[i + 1];
        if (next) {
            const currentStart = current.startTick || 0;
            const currentEnd = currentStart + (current.durationTicks || 120);
            const nextStart = next.startTick || 0;
            if (currentEnd > nextStart) {
                const newDur = Math.max(1, nextStart - currentStart);
                current.durationTicks = newDur;
            }
        }
        sanitized.push(current);
    }
    return sanitized;
};

// --- REPORT GENERATOR ---
const downloadMetadataReport = (groove: GrooveObject, fileNameBase: string, targetChannel?: ChannelKey) => {
    const timestamp = new Date().toLocaleString('he-IL');
    const safeName = (groove.name || "Untitled").toUpperCase();
    const bpm = groove.bpm || 140;

    let report = `============================================================\n`;
    report += `   OFFICIAL FORENSIC REPORT | MIDI AI PRO\n`;
    report += `============================================================\n\n`;
    report += `FILE IDENTIFIER:   ${fileNameBase}\n`;
    report += `PROJECT NAME:      ${safeName}\n`;
    report += `TRANSCRIPTION BPM: ${bpm} BPM\n`;
    report += `TIMESTAMP:         ${timestamp}\n\n`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNameBase}_REPORT.txt`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 500);
};

// --- MIDI EXPORT CORE ---
export const exportMidi = (groove: GrooveObject, selectedChannels?: ChannelKey[]) => {
    try {
        const tracks: any[] = [];
        const WRITER_PPQ = 128; 
        const scale = WRITER_PPQ / INTERNAL_PPQ;
        const isForensic = groove.id.includes('FORENSIC') || groove.id.includes('IMPORT') || groove.id.includes('LOOP');
        const totalBars = groove.totalBars || 4;
        const totalArrangementTicks = totalBars * TICKS_PER_BAR;

        ELITE_16_CHANNELS.forEach((channelKey, i) => {
            if (selectedChannels && selectedChannels.length > 0 && !selectedChannels.includes(channelKey)) return;
            
            const rawEvents = (groove as any)[channelKey] as NoteEvent[];
            const hasNotes = Array.isArray(rawEvents) && rawEvents.length > 0;
            
            // Even if no notes, we might want to export an empty track of correct length 
            // but for now, let's skip truly empty ones unless it's a full project export
            if (!hasNotes && selectedChannels && selectedChannels.length > 0) return;

            const track = new MidiWriter.Track();
            track.setTempo(groove.bpm || 140);
            track.addTrackName(channelKey);
            
            let lastEventEndTickWriter = 0;

            if (hasNotes) {
                const validEvents = sanitizeForWriter(rawEvents, isForensic);
                validEvents.forEach(n => {
                    const startTick480 = n.startTick || 0;
                    const duration480 = n.durationTicks || 120;
                    const startTickWriter = Math.round(startTick480 * scale);
                    const durationWriter = Math.max(1, Math.round(duration480 * scale));
                    
                    let wait = startTickWriter - lastEventEndTickWriter;
                    if (wait < 0) wait = 0;
                    
                    const pitch = Array.isArray(n.note) ? n.note : [n.note];
                    track.addEvent(new MidiWriter.NoteEvent({
                        pitch: pitch,
                        duration: `T${durationWriter}`,
                        velocity: Math.round((n.velocity || 0.8) * 100),
                        wait: `T${wait}`,
                        channel: i + 1
                    }));
                    lastEventEndTickWriter = startTickWriter + durationWriter;
                });
            }

            // --- TAIL ANCHORING LOGIC ---
            // Force the track to end exactly at the end of the arrangement duration
            const targetEndTickWriter = Math.round(totalArrangementTicks * scale);
            if (lastEventEndTickWriter < targetEndTickWriter) {
                const fillWait = targetEndTickWriter - lastEventEndTickWriter;
                // Add a silent "ghost" event to push the track length
                track.addEvent(new MidiWriter.NoteEvent({
                    pitch: ['C0'], // Low silent note
                    duration: 'T1',
                    velocity: 0,
                    wait: `T${fillWait}`,
                    channel: i + 1
                }));
            }

            tracks.push(track);
        });
        
        const write = new MidiWriter.Writer(tracks);
        return { bytes: write.buildFile(), filename: `${groove.name || 'session'}.mid` };
    } catch (e: any) {
        console.error("MIDI Export Error:", e);
        return { bytes: null, filename: 'error.mid' };
    }
};

export const downloadFullArrangementMidi = async (groove: GrooveObject) => {
    if (!groove) return;
    const result = exportMidi(groove);
    if (!result || !result.bytes) return;

    const blob = new Blob([result.bytes], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link); 
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 500);
    
    downloadMetadataReport(groove, result.filename.replace('.mid', ''));
};

export const downloadFullProjectMidi = downloadFullArrangementMidi;

export const downloadChannelMidi = (groove: GrooveObject, channelKey: ChannelKey) => {
    if (!groove) return;
    const { bytes } = exportMidi(groove, [channelKey]);
    if (!bytes) return;

    const blob = new Blob([bytes], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const channelName = channelKey.split('_')[1].toUpperCase();
    link.download = `${channelName}_${groove.bpm}BPM.mid`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 500);
};

export const downloadAnalyzedMidi = async (segments: GrooveObject[]) => {
    if (!segments || segments.length === 0) return;
    const masterGroove: GrooveObject = {
        ...JSON.parse(JSON.stringify(segments[0])),
        id: `MERGED_${Date.now()}`,
        name: `Neural_Transcription`,
    } as any;
    ELITE_16_CHANNELS.forEach(ch => {
        (masterGroove as any)[ch] = (segments || []).flatMap(seg => (seg as any)[ch] || []);
    });
    // For merged transcriptions, calculate bars correctly
    const totalTicks = Math.max(...ELITE_16_CHANNELS.map(ch => {
        const notes = (masterGroove as any)[ch] || [];
        if (notes.length === 0) return 0;
        const last = notes[notes.length - 1];
        return (last.startTick || 0) + (last.durationTicks || 120);
    }));
    masterGroove.totalBars = Math.ceil(totalTicks / TICKS_PER_BAR);
    
    await downloadFullArrangementMidi(masterGroove);
};

export const importMidiNotesToTrack = async (file: File): Promise<NoteEvent[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    const events: NoteEvent[] = [];
    midi.tracks.forEach(track => {
        track.notes.forEach(n => {
            const bar = Math.floor(n.ticks / 1920);
            const beat = Math.floor((n.ticks % 1920) / 480);
            const sixteen = Math.floor((n.ticks % 480) / 120);
            events.push({
                note: theoryEngine.midiToNote(n.midi),
                duration: "custom",
                durationTicks: n.durationTicks,
                startTick: n.ticks,
                time: `${bar}:${beat}:${sixteen}`,
                velocity: n.velocity
            });
        });
    });
    return events;
};

export const importMidiAsGroove = async (file: File): Promise<{ groove: GrooveObject }> => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    const bpm = midi.header.tempos[0]?.bpm || 145;
    
    const groove: any = {
        id: `IMPORT_${Date.now()}`,
        name: file.name.split('.')[0],
        bpm: Math.round(bpm),
        key: "C", 
        scale: "Minor", 
        totalBars: Math.max(128, Math.ceil(midi.durationTicks / 1920))
    };

    ELITE_16_CHANNELS.forEach(ch => groove[ch] = []);

    midi.tracks.forEach((track, i) => {
        const trackName = track.name.toLowerCase();
        let targetChannel: ChannelKey | null = null;

        for (const key of ELITE_16_CHANNELS) {
            if (trackName.includes(key.toLowerCase()) || trackName.includes(key.split('_')[1].toLowerCase())) {
                targetChannel = key;
                break;
            }
        }

        if (!targetChannel && i < ELITE_16_CHANNELS.length) {
            targetChannel = ELITE_16_CHANNELS[i];
        }

        if (targetChannel) {
            const notes = track.notes.map(n => {
                const bar = Math.floor(n.ticks / 1920);
                const beat = Math.floor((n.ticks % 1920) / 480);
                const sixteen = Math.floor((n.ticks % 480) / 120);
                return {
                    note: theoryEngine.midiToNote(n.midi),
                    duration: "custom",
                    durationTicks: n.durationTicks,
                    startTick: n.ticks,
                    time: `${bar}:${beat}:${sixteen}`,
                    velocity: n.velocity
                };
            });
            groove[targetChannel] = [...(groove[targetChannel] || []), ...notes];
        }
    });

    return { groove: groove as GrooveObject };
};
