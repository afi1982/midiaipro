
import { GoogleGenAI, Type } from "@google/genai";
import { GrooveObject, NoteEvent, ChannelKey } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); 
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = 1; 
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channel = buffer.getChannelData(0);
    let sample, offset = 0;
    
    const writeString = (s: string) => {
        for (let i = 0; i < s.length; i++) out.setUint8(offset + i, s.charCodeAt(i));
        offset += s.length;
    };

    writeString('RIFF');
    out.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    out.setUint32(offset, 16, true); offset += 4;
    out.setUint16(offset, 1, true); offset += 2;
    out.setUint16(offset, numOfChan, true); offset += 2;
    out.setUint32(offset, buffer.sampleRate, true); offset += 4;
    out.setUint32(offset, buffer.sampleRate * 2 * numOfChan, true); offset += 4;
    out.setUint16(offset, 2 * numOfChan, true); offset += 2;
    out.setUint16(offset, 16, true); offset += 2;
    writeString('data');
    out.setUint32(offset, length - offset - 4, true); offset += 4;

    for (let i = 0; i < buffer.length; i++) {
        sample = Math.max(-1, Math.min(1, channel[i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        out.setInt16(offset, sample, true);
        offset += 2;
    }

    return new Blob([out], { type: 'audio/wav' });
};

const preciseNoteSchema = {
    type: Type.OBJECT,
    properties: {
        n: { type: Type.STRING, description: "Pitch (e.g. F#3)." },
        t_ms: { type: Type.NUMBER, description: "Start time in ms from segment start." },
        dur_ms: { type: Type.NUMBER, description: "Duration in ms." },
        v: { type: Type.NUMBER, description: "Velocity (0.1-1.0)." }
    },
    required: ["n", "t_ms", "dur_ms", "v"]
};

const rawTranscriptionSchema = {
  type: Type.OBJECT,
  properties: {
    detected_bpm: { type: Type.NUMBER },
    kick: { type: Type.ARRAY, items: preciseNoteSchema },
    bass: { type: Type.ARRAY, items: preciseNoteSchema },
    lead: { type: Type.ARRAY, items: preciseNoteSchema },
    pad: { type: Type.ARRAY, items: preciseNoteSchema },
    drums: { type: Type.ARRAY, items: preciseNoteSchema }
  },
  required: ["detected_bpm"]
};

const mapMsToAbsoluteTick = (preciseNote: any, segmentOffsetSec: number, bpm: number): NoteEvent => {
    const totalMs = (segmentOffsetSec * 1000) + (preciseNote.t_ms || 0);
    const PPQ = 480;
    const startTick = Math.round((totalMs * bpm * PPQ) / 60000);
    const durationTicks = Math.round((preciseNote.dur_ms * bpm * PPQ) / 60000);

    const bar = Math.floor(startTick / 1920);
    const beat = Math.floor((startTick % 1920) / 480);
    const sixteenth = Math.floor((startTick % 480) / 120);

    return {
        note: preciseNote.n || 'C4',
        duration: "custom",
        durationTicks: Math.max(1, durationTicks),
        startTick: startTick,
        // Fix: Changed 'sixteen' to 'sixteenth' to match variable name on line 90
        time: `${bar}:${beat}:${sixteenth}`,
        velocity: Math.max(0.1, Math.min(1.0, preciseNote.v || 0.8)),
        timingOffset: 0
    };
};

export const analyzeAudioChunk = async (audioBlob: Blob, segmentIndex: number, chunkDurationSec: number, isSilent = false): Promise<GrooveObject> => {
  if (isSilent) {
      const groove: any = { id: `SILENT-${segmentIndex}`, bpm: 140, key: "C", scale: "Minor", totalBars: Math.ceil((chunkDurationSec * 140) / 240) };
      ELITE_16_CHANNELS.forEach(k => groove[k] = []);
      return groove;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await blobToBase64(audioBlob);
  const segmentOffsetSec = segmentIndex * chunkDurationSec;

  try {
    // V115: Use Flash for speed. It's excellent for rhythmic patterns and saves 80% time.
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: "audio/wav" } },
                { text: `FAST NEURAL TRANSCRIPTION: Segment #${segmentIndex + 1}. Transcribe Pitch, Timing (ms), and Velocity.` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: rawTranscriptionSchema,
            temperature: 0.1 
        }
    });

    const raw = JSON.parse(response.text || "{}");
    const bpm = raw.detected_bpm || 140;

    const groove: any = { 
        id: `FORENSIC-V115-${segmentIndex}`, 
        bpm, 
        key: "Raw", 
        scale: "Chromatic",
        totalBars: Math.ceil((chunkDurationSec * bpm) / 240)
    };

    ELITE_16_CHANNELS.forEach(k => groove[k] = []);

    if (raw.kick) groove['ch1_kick'] = raw.kick.map((n: any) => mapMsToAbsoluteTick(n, segmentOffsetSec, bpm));
    if (raw.bass) groove['ch2_sub'] = raw.bass.map((n: any) => mapMsToAbsoluteTick(n, segmentOffsetSec, bpm));
    if (raw.lead) groove['ch4_leadA'] = raw.lead.map((n: any) => mapMsToAbsoluteTick(n, segmentOffsetSec, bpm));
    if (raw.pad) groove['ch15_pad'] = (raw.pad || []).slice(0, 80).map((n: any) => mapMsToAbsoluteTick(n, segmentOffsetSec, bpm));
    if (raw.drums) groove['ch10_percLoop'] = raw.drums.map((n: any) => mapMsToAbsoluteTick(n, segmentOffsetSec, bpm));

    return groove;
  } catch (e) {
    const fallback: any = { id: `FAIL-${segmentIndex}`, bpm: 140, key: "C", scale: "Chromatic", totalBars: 4 };
    ELITE_16_CHANNELS.forEach(k => fallback[k] = []);
    return fallback;
  }
};

export const sliceAudio = async (file: File, chunkDurationSec: number = 15): Promise<{ blob: Blob, isSilent: boolean }[]> => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    // Lower sample rate for faster upload/processing (12kHz is enough for MIDI detection)
    const targetRate = 12000; 
    const chunks: { blob: Blob, isSilent: boolean }[] = [];
    const sourceRate = audioBuffer.sampleRate;
    const sourceChunkLen = Math.floor(chunkDurationSec * sourceRate);
    const inputL = audioBuffer.getChannelData(0);

    for (let offset = 0; offset < audioBuffer.length; offset += sourceChunkLen) {
        const end = Math.min(offset + sourceChunkLen, audioBuffer.length);
        const targetLen = Math.floor((end - offset) * (targetRate / sourceRate));
        const chunkBuffer = ctx.createBuffer(1, targetLen, targetRate);
        const outputData = chunkBuffer.getChannelData(0);
        let energy = 0;
        for(let i = 0; i < targetLen; i++) {
            const sample = inputL[offset + Math.floor(i * (sourceRate / targetRate))] || 0;
            outputData[i] = sample;
            energy += Math.abs(sample);
        }
        chunks.push({ blob: audioBufferToWav(chunkBuffer), isSilent: (energy / targetLen) < 0.0002 });
    }
    await ctx.close();
    return chunks;
};
