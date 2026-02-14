
import React, { useEffect, useRef } from 'react';
import { CheckCircle, Circle, Loader2, ShieldCheck, Cpu, Activity, Server, FileCode, XCircle, AlertTriangle } from 'lucide-react';

interface GenerationOverlayProps {
  currentStep: number;
  steps: string[];
  logs: string[];
  error?: string | null; // New Prop
  onClose: () => void;   // New Prop
}

const StepIcon = ({ stepIndex, currentIndex, isError }: { stepIndex: number, currentIndex: number, isError: boolean }) => {
    if (isError && stepIndex === currentIndex) return <XCircle className="w-5 h-5 text-red-500" />;
    if (stepIndex < currentIndex) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (stepIndex === currentIndex) return <Loader2 className="w-5 h-5 text-studio-accent animate-spin" />;
    return <Circle className="w-5 h-5 text-zinc-700" />;
};

const getStepIcon = (index: number) => {
    switch(index) {
        case 0: return Server;
        case 1: return Cpu;
        case 2: return Activity;
        case 3: return ShieldCheck;
        case 4: return FileCode;
        default: return Circle;
    }
};

export const GenerationOverlay: React.FC<GenerationOverlayProps> = ({ currentStep, steps, logs, error, onClose }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, error]);

  return (
    <div className="absolute inset-0 z-[100] bg-[#030304]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 font-sans">
      
      <div className={`w-full max-w-3xl bg-[#09090B] border rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px] transition-colors duration-500 ${error ? 'border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)]' : 'border-white/10 shadow-[0_0_100px_rgba(6,182,212,0.1)]'}`}>
        
        {/* LEFT: PROGRESS STEPS */}
        <div className="w-full md:w-1/2 p-8 border-r border-white/5 bg-black/40 flex flex-col">
            <div className="mb-8">
                <h2 className="text-2xl font-display font-black text-white uppercase tracking-tighter mb-2">
                    {error ? <span className="text-red-500">SYSTEM FAILURE</span> : <>System <span className="text-studio-accent">Forge</span></>}
                </h2>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></span>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.2em]">
                        {error ? 'PROCESS ABORTED' : 'V48 Neural QA Pipeline'}
                    </p>
                </div>
            </div>

            <div className="flex-1 space-y-6">
                {steps.map((label, idx) => {
                    const Icon = getStepIcon(idx);
                    const isActive = idx === currentStep;
                    const isDone = idx < currentStep;
                    const isFailed = error && isActive;
                    
                    return (
                        <div key={idx} className={`flex items-center gap-4 transition-all duration-500 ${isActive ? 'translate-x-2' : 'opacity-60'}`}>
                            <div className={`p-3 rounded-lg border ${
                                isFailed ? 'bg-red-900/20 border-red-500 text-red-500' :
                                isActive ? 'bg-studio-accent/10 border-studio-accent text-studio-accent' : 
                                isDone ? 'bg-green-500/10 border-green-500/30 text-green-500' : 
                                'bg-zinc-900 border-white/5 text-zinc-700'
                            }`}>
                                {isFailed ? <AlertTriangle className="w-5 h-5" /> : isDone ? <CheckCircle className="w-5 h-5" /> : isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className={`text-xs font-bold uppercase tracking-wider ${isFailed ? 'text-red-400' : isActive ? 'text-white' : isDone ? 'text-gray-300' : 'text-zinc-600'}`}>
                                    {label}
                                </h3>
                                <p className={`text-[9px] font-mono mt-0.5 ${isFailed ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                                    {isFailed ? 'CRITICAL ERROR' : isActive ? 'Processing...' : isDone ? 'Verified' : 'Pending'}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {error && (
                <button 
                    onClick={onClose}
                    className="mt-auto w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                    <XCircle className="w-5 h-5" /> Close & Retry
                </button>
            )}
        </div>

        {/* RIGHT: LIVE LOGS */}
        <div className="w-full md:w-1/2 bg-black/80 flex flex-col font-mono text-[10px]">
            <div className={`h-10 border-b flex items-center px-4 justify-between ${error ? 'bg-red-950/30 border-red-500/30' : 'bg-[#0E0E10] border-white/10'}`}>
                <span className={error ? 'text-red-400 font-bold uppercase' : 'text-gray-500 uppercase tracking-widest font-bold'}>
                    {error ? 'Error Log' : 'Terminal Output'}
                </span>
                <span className={error ? 'text-red-500 font-bold' : 'text-studio-accent animate-pulse'}>
                    {error ? '● TERMINATED' : '● LIVE'}
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative">
                {logs.map((log, i) => (
                    <div key={i} className="flex gap-3 animate-in slide-in-from-left-2 duration-300">
                        <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                        <span className={`${
                            log.includes('CRITICAL') ? 'text-red-500 font-bold bg-red-900/10 px-1 rounded' :
                            log.includes('VERIFIED') ? 'text-green-400' :
                            log.includes('V48') ? 'text-studio-accent' :
                            'text-gray-300'
                        }`}>
                            {log}
                        </span>
                    </div>
                ))}
                
                {/* Error Box */}
                {error && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg animate-in zoom-in-95">
                        <h4 className="text-red-400 font-bold mb-1 flex items-center gap-2"><AlertTriangle size={12} /> EXCEPTION CAUGHT</h4>
                        <p className="text-red-200 leading-relaxed whitespace-pre-wrap">{error}</p>
                    </div>
                )}

                <div ref={logEndRef} />
                {!error && <div className="h-4 w-2 bg-studio-accent animate-pulse mt-2"></div>}
            </div>
        </div>

      </div>
    </div>
  );
};

export default GenerationOverlay;
