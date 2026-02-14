
import React, { useState, useRef, useEffect } from 'react';
import { maestroService, ELITE_16_CHANNELS } from '../services/maestroService';
import { melodicComposer } from '../services/melodicComposer';
import { ChannelKey, NoteEvent, MusicalKey, ScaleType, GrooveObject } from '../types';
import { ArrowLeft, Play, Download, RefreshCw, Music, Layers, Square } from 'lucide-react';
import { downloadChannelMidi } from '../services/midiService';
import { theoryEngine } from '../services/theoryEngine';
import { ComplexityLevel } from '../services/melodicComposer';
import * as Tone from 'tone';

interface SingleChannelGeneratorProps {
    onClose: () => void;
}

const createPreviewSynth = (channel: ChannelKey) => {
    const limiter = new Tone.Limiter(-3).toDestination();
    let synth: Tone.Instrument<any>;
    if (channel === 'ch1_kick') {
        synth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } }).connect(limiter);
    } else if (channel.includes('sub') || channel.includes('bass')) {
        synth = new Tone.MonoSynth({ oscillator: { type: "sawtooth" }, filter: { Q: 2, type: "lowpass", rollover: -24 }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.2 }, filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.2, baseFrequency: 200, octaves: 2 } }).connect(limiter);
    } else if (channel.includes('hh') || channel.includes('snare') || channel.includes('clap')) {
        synth = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(limiter);
    } else {
        synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } }).connect(limiter);
    }
    return { synth, limiter };
};

const SimplePianoRoll: React.FC<{ notes: NoteEvent[] }> = ({ notes }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const totalSteps = 64; 
        const colWidth = canvas.width / totalSteps; 
        ctx.lineWidth = 1;
        for(let i=0; i<=totalSteps; i++) {
            ctx.beginPath(); 
            ctx.moveTo(i*colWidth, 0); 
            ctx.lineTo(i*colWidth, canvas.height); 
            ctx.strokeStyle = i % 16 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.03)';
            ctx.stroke();
        }
        if (notes.length === 0) return;
        const midiValues = notes.map(n => typeof n.note === 'string' ? theoryEngine.getMidiNote(n.note) : 60);
        const minMidi = Math.min(...midiValues) - 2;
        const maxMidi = Math.max(...midiValues) + 2;
        const range = Math.max(12, maxMidi - minMidi);
        notes.forEach(n => {
            const startStep = (n.startTick || 0) / 120;
            const widthStep = (n.durationTicks || 120) / 120;
            const pitch = typeof n.note === 'string' ? theoryEngine.getMidiNote(n.note) : 60;
            const x = startStep * colWidth;
            const y = canvas.height - ((pitch - minMidi) / range) * canvas.height;
            const w = widthStep * colWidth;
            const h = (canvas.height / range) - 1;
            ctx.fillStyle = '#10b981';
            ctx.fillRect(x, y - h, Math.max(w - 1, 2), Math.max(h, 2));
        });
    }, [notes]);

    return (
        <div className="w-full bg-black border border-white/10 rounded-xl overflow-hidden h-36 md:h-48 relative shadow-inner">
            <canvas ref={canvasRef} width={800} height={200} className="w-full h-full" />
            <div className="absolute bottom-2 right-2 text-[8px] text-gray-500 font-mono bg-black/50 px-2 rounded">PREVIEW</div>
        </div>
    );
};

export const SingleChannelGenerator: React.FC<SingleChannelGeneratorProps> = ({ onClose }) => {
    const [channel, setChannel] = useState<ChannelKey>('ch4_leadA');
    const [bpm, setBpm] = useState(145);
    const [key, setKey] = useState<string>(MusicalKey.F_SHARP);
    const [scale, setScale] = useState<string>(ScaleType.PHRYGIAN);
    const [complexity, setComplexity] = useState<ComplexityLevel>('COMPLEX');
    const [generatedNotes, setGeneratedNotes] = useState<NoteEvent[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const activeSynthRef = useRef<any>(null);
    const activePartRef = useRef<Tone.Part | null>(null);
    
    // Persistent Session Rhythmic Glue
    const [sessionRhythmMask, setSessionRhythmMask] = useState<number[]>([]);
    const [sessionMotif, setSessionMotif] = useState<number[] | null>(null);

    useEffect(() => {
        // Initialize the rhythmic DNA of the session
        const glue = Array.from({length: 16}, () => Math.random() > 0.5 ? 1 : 0);
        setSessionRhythmMask(glue);
    }, []);

    const stopPlayback = () => {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        if (activePartRef.current) { activePartRef.current.dispose(); activePartRef.current = null; }
        if (activeSynthRef.current) { activeSynthRef.current.synth.dispose(); activeSynthRef.current.limiter.dispose(); activeSynthRef.current = null; }
        setIsPlaying(false);
    };

    const handlePlayPreview = async () => {
        if (isPlaying) { stopPlayback(); return; }
        if (generatedNotes.length === 0) return;
        await Tone.start();
        Tone.Transport.bpm.value = bpm;
        const { synth, limiter } = createPreviewSynth(channel);
        activeSynthRef.current = { synth, limiter };
        const events = generatedNotes.map(n => ({ time: n.time, note: n.note, velocity: n.velocity }));
        activePartRef.current = new Tone.Part((time, value) => {
             if (activeSynthRef.current && !activeSynthRef.current.synth.disposed) {
                activeSynthRef.current.synth.triggerAttackRelease(value.note, "16n", time, value.velocity);
             }
        }, events).start(0);
        activePartRef.current.loop = true;
        activePartRef.current.loopEnd = "4m";
        Tone.Transport.start();
        setIsPlaying(true);
    };

    const handleNewGeneration = () => {
        stopPlayback();
        // Evolution: Mutate motif but keep rhythmic mask for glue
        const newMotif = sessionMotif ? melodicComposer.mutateMotif(sessionMotif) : melodicComposer.createMotif();
        setSessionMotif(newMotif);
        
        const notes = maestroService.generateSingle4BarLoop(channel, bpm, key, scale, complexity, newMotif, sessionRhythmMask);
        setGeneratedNotes(notes);
    };

    const handleDownload = () => {
        const g: any = {
            id: `LOOP_${Date.now()}`,
            name: 'Loop',
            bpm: bpm,
            key: key,
            scale: scale,
            totalBars: 4,
        };
        ELITE_16_CHANNELS.forEach(ch => { g[ch] = []; });
        g[channel] = generatedNotes;
        downloadChannelMidi(g as GrooveObject, channel);
    };

    return (
        <div className="h-full flex flex-col bg-[#050507] text-white animate-in fade-in overflow-y-auto custom-scrollbar" dir="ltr">
            <header className="h-16 md:h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-4 md:px-8 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => { stopPlayback(); onClose(); }} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-all text-gray-400">
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-base md:text-2xl font-black uppercase tracking-tighter">Loop <span className="text-emerald-500">Gen</span></h1>
                </div>
                <div className="flex gap-2">
                    <div className="hidden sm:flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                        <Layers size={10} className="text-gray-400" />
                        <span className="text-[8px] font-bold">DNA SYNC: {sessionRhythmMask.filter(v => v===1).length} NODES</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <div className="w-full md:w-80 bg-[#0E0E10] border-b md:border-b-0 md:border-r border-white/5 p-4 md:p-8 flex flex-col gap-4 md:gap-6 overflow-y-auto">
                    <div className="space-y-1">
                        <label className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Target Channel</label>
                        <select value={channel} onChange={(e) => { stopPlayback(); setChannel(e.target.value as ChannelKey); }} className="w-full bg-black border border-white/10 rounded-lg p-2 md:p-3 text-[11px] md:text-sm font-bold text-white outline-none">
                            {ELITE_16_CHANNELS.map(ch => (
                                <option key={ch} value={ch}>{ch.split('_')[1].toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Generation Mode</label>
                        <div className="flex bg-black p-1 rounded-lg border border-white/10">
                            <button onClick={() => setComplexity('SIMPLE')} className={`flex-1 py-1.5 rounded text-[8px] md:text-[10px] font-black uppercase ${complexity === 'SIMPLE' ? 'bg-emerald-500 text-black' : 'text-gray-500'}`}>Simple</button>
                            <button onClick={() => setComplexity('COMPLEX')} className={`flex-1 py-1.5 rounded text-[8px] md:text-[10px] font-black uppercase ${complexity === 'COMPLEX' ? 'bg-emerald-500 text-black' : 'text-gray-500'}`}>Complex</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                            <label className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Key</label>
                            <select value={key} onChange={(e) => { stopPlayback(); setKey(e.target.value); }} className="w-full bg-black border border-white/10 rounded-lg p-2 text-[10px] font-bold text-white outline-none">
                                {Object.values(MusicalKey).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scale</label>
                            <select value={scale} onChange={(e) => { stopPlayback(); setScale(e.target.value); }} className="w-full bg-black border border-white/10 rounded-lg p-2 text-[10px] font-bold text-white outline-none">
                                {Object.values(ScaleType).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <button onClick={handleNewGeneration} className="w-full py-3 md:py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] md:text-xs tracking-widest rounded-lg md:rounded-xl transition-all shadow-lg active:scale-95">
                        <RefreshCw size={14} className="inline mr-2" /> Generate Loop
                    </button>
                </div>

                <div className="flex-1 bg-[#050507] p-4 md:p-8 flex flex-col items-center justify-center relative">
                    {generatedNotes.length > 0 ? (
                        <div className="w-full max-w-2xl space-y-4 md:space-y-6 animate-in zoom-in-95">
                            <SimplePianoRoll notes={generatedNotes} />
                            <div className="flex flex-col sm:flex-row gap-2 md:gap-4 w-full">
                                <button onClick={handlePlayPreview} className={`flex-1 py-3 md:py-4 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${isPlaying ? 'bg-emerald-500 text-black' : 'bg-[#111] border border-white/10 text-white'}`}>
                                    {isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                    {isPlaying ? "Stop" : "Preview"}
                                </button>
                                <button onClick={handleDownload} className="flex-1 py-3 md:py-4 bg-white text-black rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2">
                                    <Download size={14} /> Download MIDI
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center opacity-20">
                            <Music size={48} className="mx-auto mb-2" />
                            <p className="text-[10px] uppercase font-black tracking-widest italic">Select Channel & Generate</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
