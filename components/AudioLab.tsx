
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { jobQueueService, Job } from '../services/jobQueueService';
import { downloadFullArrangementMidi } from '../services/midiService';
import { AudioWaveform, ArrowLeft, Loader2, Play, Pause, Download, Microscope, ShieldCheck, Zap, RefreshCw } from 'lucide-react';
import { GrooveObject, NoteEvent } from '../types';
import { ELITE_16_CHANNELS } from '../services/maestroService';
import { theoryEngine } from '../services/theoryEngine';
import { SourceExportButton } from './SourceExportButton';

interface AudioLabProps {
    onClose: () => void;
}

const LabPianoRoll: React.FC<{ groove: GrooveObject, progress: number }> = ({ groove, progress }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const key = groove.key || "C";
        const scale = groove.scale || "Minor";
        
        ctx.fillStyle = '#050507';
        ctx.fillRect(0, 0, w, h);

        const totalBars = groove.totalBars || 32; 
        const totalTicks = totalBars * 1920;
        const steps = totalBars * 16;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i <= steps; i++) {
            const x = (i / steps) * w;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }

        const minPitch = 24, maxPitch = 96; 
        const noteHeight = h / (maxPitch - minPitch);

        ELITE_16_CHANNELS.forEach((ch) => {
            const notes = (groove as any)[ch] as NoteEvent[];
            if (!notes) return;
            notes.forEach(n => {
                const midi = theoryEngine.getMidiNote(typeof n.note === 'string' ? n.note : n.note[0]);
                const isInScale = theoryEngine.isNoteInScale(typeof n.note === 'string' ? n.note : n.note[0], key, scale);
                ctx.fillStyle = isInScale ? '#0ea5e9' : '#f59e0b';
                const x = ((n.startTick || 0) / totalTicks) * w;
                const y = h - ((midi - minPitch) * noteHeight);
                ctx.fillRect(x, y, Math.max(2, ((n.durationTicks || 120) / totalTicks) * w), noteHeight - 1);
            });
        });

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(progress * w, 0); ctx.lineTo(progress * w, h); ctx.stroke();
    }, [groove, progress]);

    return (
        <div className="w-full h-full bg-[#050505] rounded-xl overflow-hidden border border-white/10 relative shadow-inner">
            <canvas ref={canvasRef} width={1200} height={400} className="w-full h-full object-fill" />
            <div className="absolute top-3 left-3 flex gap-2 bg-black/70 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full" /><span className="text-[10px] font-bold">Scale Locked</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-amber-500 rounded-full" /><span className="text-[10px] font-bold">Artifact</span></div>
            </div>
        </div>
    );
};

export const AudioLab: React.FC<AudioLabProps> = ({ onClose }) => {
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [activeJob, setActiveJob] = useState<Job | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!activeJobId) return;
        return jobQueueService.subscribe(jobs => {
            const job = jobs.find(j => j.id === activeJobId);
            if (job) setActiveJob(job);
        });
    }, [activeJobId]);

    const onDrop = useCallback((files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];
        setAudioUrl(URL.createObjectURL(file));
        setActiveJobId(jobQueueService.addAudioJob(file));
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'audio/*': ['.mp3', '.wav'] }, maxFiles: 1, disabled: !!activeJobId });

    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            if (audioRef.current) setProgress(audioRef.current.currentTime / audioRef.current.duration);
        }, 30);
        return () => clearInterval(interval);
    }, [isPlaying]);

    return (
        <div className="h-full flex flex-col bg-[#050508] text-white animate-in fade-in" dir="ltr">
            {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />}
            <header className="h-20 bg-[#0A0A0B] border-b border-white/5 flex items-center justify-between px-8 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} /></button>
                    <h1 className="text-2xl font-black uppercase tracking-tighter italic">Neural <span className="text-blue-500">Forensics</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <SourceExportButton pageKey="AUDIO_LAB" label="Acoustic Logic" />
                    {activeJob?.status === 'COMPLETED' && (
                        <button onClick={() => downloadFullArrangementMidi(activeJob.result)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center gap-2 shadow-glow"><Download size={16} /> Export MIDI</button>
                    )}
                </div>
            </header>
            <div className="flex-1 p-8">
                {!activeJob ? (
                    <div {...getRootProps()} className={`w-full max-w-4xl mx-auto h-96 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center cursor-pointer bg-[#0A0A0C] transition-all ${isDragActive ? 'border-blue-500 bg-blue-500/5 shadow-2xl' : 'border-white/10 hover:border-white/20'}`}>
                        <input {...getInputProps()} />
                        <AudioWaveform size={64} className={`mb-4 ${isDragActive ? 'text-blue-400' : 'text-gray-600'}`} />
                        <h3 className="text-2xl font-bold uppercase tracking-widest">Analyze Audio Source</h3>
                        <p className="text-xs text-gray-500 font-mono mt-4 uppercase">Maestro V114.2 Neural Deconstruction</p>
                    </div>
                ) : activeJob.status === 'PROCESSING' ? (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 size={48} className="animate-spin text-blue-500 mb-6" />
                        <h2 className="text-2xl font-black uppercase italic tracking-tight">{activeJob.progress}% Forensic Audit in Progress...</h2>
                    </div>
                ) : activeJob.result && (
                    <div className="flex flex-col gap-6 h-full animate-in zoom-in-95 duration-500">
                        <div className="flex justify-between items-center bg-[#0A0A0C] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
                            <div className="flex gap-12">
                                <div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Detected Tempo</div><div className="text-3xl font-black font-mono">{activeJob.result.bpm} <span className="text-sm opacity-30">BPM</span></div></div>
                                <div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Harmonic Center</div><div className="text-3xl font-black font-mono text-blue-400">{activeJob.result.key} <span className="text-xl opacity-60">{activeJob.result.scale}</span></div></div>
                            </div>
                            <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl hover:scale-105 ${isPlaying ? 'bg-red-500 text-white' : 'bg-white text-black'}`}>
                                {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1.5" />}
                            </button>
                        </div>
                        <div className="flex-1 relative rounded-[3rem] overflow-hidden shadow-2xl border border-white/10">
                            <LabPianoRoll groove={activeJob.result} progress={progress} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
