import React, { useState, useEffect, useRef } from 'react';
// תיקון ייבואים: בלי סיומות קבצים כדי למנוע בעיות ב-Vercel
import { GrooveObject, GenerationParams, MusicGenre, MusicalKey, ScaleType, EnergyMode, BpmMode, ChannelKey } from './types';
import { SUPPORTED_CHANNELS } from './services/maestroService';
import { StudioPage } from './components/StudioPage';
import WelcomeScreen from './components/WelcomeScreen';
import { JobsCenterPage } from './components/JobsCenterPage';
import { Navigation } from './components/Navigation';
import { jobQueueService } from './services/jobQueueService';
import ChannelSelector from './components/ChannelSelector';
import { Zap, Lock, AlertTriangle } from 'lucide-react';
import { neuralMonitorService } from './services/neuralMonitorService';
import { NeuralTrainer } from './components/NeuralTrainer';
import { SingleChannelGenerator } from './components/SingleChannelGenerator';
import { AudioLab } from './components/AudioLab';

// משיכת ה-API Key מתוך משתני הסביבה של Vite
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const GENRE_BPM_MAP: Record<MusicGenre, number> = {
    [MusicGenre.PSYTRANCE_FULLON]: 145,
    [MusicGenre.PSYTRANCE_POWER]: 142,
    [MusicGenre.GOA_TRANCE]: 148,
    [MusicGenre.MELODIC_TECHNO]: 126,
    [MusicGenre.TECHNO_PEAK]: 132
};

type ViewType = 'WELCOME' | 'CREATE' | 'STUDIO' | 'AUDIO_LAB' | 'GENERATOR' | 'TRAINER' | 'JOBS';

const NAV_ORDER: ViewType[] = ['WELCOME', 'CREATE', 'STUDIO', 'AUDIO_LAB', 'GENERATOR', 'TRAINER', 'JOBS'];

export default function App() {
  const [view, setView] = useState<ViewType>('WELCOME');
  const [groove, setGroove] = useState<GrooveObject | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>(SUPPORTED_CHANNELS);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  
  const touchStart = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const minSwipeDistance = 100; 

  const [params, setParams] = useState<GenerationParams>({
    genre: MusicGenre.PSYTRANCE_FULLON, 
    key: MusicalKey.F_SHARP, 
    scale: ScaleType.PHRYGIAN, 
    bpm: 145, 
    mode: 'NEW', 
    trackLengthMinutes: 6, 
    energyMode: EnergyMode.PEAK, 
    bpmMode: BpmMode.MANUAL
  });

  // בדיקת API Key בטעינה הראשונה
  useEffect(() => {
    if (!GEMINI_API_KEY) {
      console.error("FATAL: VITE_GEMINI_API_KEY is not defined in Environment Variables");
      setApiKeyMissing(true);
    }
    
    const unsub = jobQueueService.subscribe(() => {});
    return () => unsub();
  }, []);

  useEffect(() => {
    if (view === 'STUDIO' && groove) {
        neuralMonitorService.observe(groove);
    }
  }, [groove, view]);

  // לוגיקת Swipe (נשארת ללא שינוי)
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-swipe="true"]')) {
        touchStart.current = null;
        return;
    }
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    touchEnd.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current || !touchStartY.current || !touchEndY.current) return;
    const deltaX = touchStart.current - touchEnd.current;
    const deltaY = touchStartY.current - touchEndY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) * 2 && Math.abs(deltaX) > minSwipeDistance) {
        const currentIndex = NAV_ORDER.indexOf(view);
        if (deltaX > 0 && currentIndex < NAV_ORDER.length - 1) setView(NAV_ORDER[currentIndex + 1]);
        else if (deltaX < 0 && currentIndex > 0) setView(NAV_ORDER[currentIndex - 1]);
    }
    touchStart.current = null; touchEnd.current = null;
  };

  const handleOpenProjectInReview = (g: GrooveObject) => {
      setGroove(g);
      setView('STUDIO'); 
  };

  const handleGenreChange = (newGenre: MusicGenre) => {
      setParams({ ...params, genre: newGenre, bpm: GENRE_BPM_MAP[newGenre] || 140 });
  };

  // מסך הגנה במידה וחסר API Key
  if (apiKeyMissing) {
    return (
      <div className="h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 text-center font-mono">
        <div className="border border-red-500/50 p-8 bg-red-950/20 rounded-3xl max-w-md space-y-4">
          <AlertTriangle size={48} className="text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold uppercase tracking-tighter">API Configuration Error</h1>
          <p className="text-gray-400 text-sm">
            VITE_GEMINI_API_KEY is missing. The Neural Engine cannot manifest without a connection.
          </p>
          <div className="text-[10px] text-zinc-600 bg-black p-3 rounded-lg border border-white/5">
            GOTO: Vercel Settings > Environment Variables > Add VITE_GEMINI_API_KEY
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
        className="h-screen w-full bg-black text-white flex flex-col font-sans overflow-hidden select-none" 
        dir="ltr"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
      <Navigation currentView={view} onChangeView={setView} />

      <main className="flex-1 relative overflow-hidden">
        {view === 'WELCOME' && (
            <WelcomeScreen 
                onEnter={() => setView('CREATE')} 
                onOpenStudio={() => setView('STUDIO')} 
                onOpenJobs={() => setView('JOBS')}
                onOpenTrainer={() => setView('TRAINER')}
                onOpenGenerator={() => setView('GENERATOR')}
                onOpenAudioLab={() => setView('AUDIO_LAB')}
            />
        )}
        
        {view === 'STUDIO' && <StudioPage initialGroove={groove} onUpdate={setGroove} onClose={() => setView('JOBS')} />}
        {view === 'JOBS' && <JobsCenterPage onOpenGroove={handleOpenProjectInReview} onClose={() => setView('WELCOME')} />}
        {view === 'TRAINER' && <NeuralTrainer onClose={() => setView('WELCOME')} />}
        {view === 'GENERATOR' && <SingleChannelGenerator onClose={() => setView('WELCOME')} />}
        {view === 'AUDIO_LAB' && <AudioLab onClose={() => setView('WELCOME')} />}

        {view === 'CREATE' && (
            <div className="h-full flex flex-col items-center p-3 md:p-8 overflow-y-auto custom-scrollbar bg-gradient-to-b from-[#050505] to-black pb-20">
                <div className="max-w-4xl w-full bg-[#0a0a0c] p-5 md:p-10 rounded-2xl md:rounded-[2rem] border border-white/10 space-y-6 md:space-y-8 shadow-2xl relative">
                    <header className="text-center space-y-2 mb-4 md:mb-8">
                        <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter italic">Generation <span className="text-sky-500">Forge</span></h2>
                        <p className="text-gray-500 text-[8px] md:text-[10px] font-mono uppercase tracking-[0.3em]">Select Style & Manifest</p>
                    </header>
                    
                    <div className="space-y-6 md:space-y-8">
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="bg-black p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5 space-y-2">
                                <label className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase tracking-widest">Target Genre</label>
                                <select 
                                    value={params.genre} 
                                    onChange={e => handleGenreChange(e.target.value as MusicGenre)} 
                                    className="w-full bg-transparent font-black text-white outline-none appearance-none cursor-pointer text-base md:text-xl uppercase tracking-tight"
                                >
                                    {Object.values(MusicGenre).map(g => <option key={g} value={g} className="bg-black text-white">{g}</option>)}
                                </select>
                            </div>

                            <div className="bg-black p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <label className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Engine Tempo</label>
                                    <div className="text-lg md:text-xl font-black text-sky-500 flex items-center gap-2">
                                        {params.bpm} <span className="text-xs md:text-sm text-gray-600">BPM</span>
                                    </div>
                                </div>
                                <div className="p-2 md:p-3 bg-white/5 rounded-full">
                                    <Lock size={14} className="text-gray-500" />
                                </div>
                            </div>
                        </section>

                        <section className="bg-[#0E0E10] border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-8">
                            <div className="flex justify-between items-center mb-4 md:mb-6">
                                <label className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                    Channel Manifest <span className="text-sky-500">({selectedChannels.length})</span>
                                </label>
                            </div>
                            <ChannelSelector selectedChannels={selectedChannels} onChange={setSelectedChannels} />
                        </section>
                    </div>

                    <div className="pt-4 md:pt-8">
                        <button 
                            onClick={() => { jobQueueService.addMidiJob(params, selectedChannels); setView('JOBS'); }} 
                            disabled={selectedChannels.length === 0}
                            className="w-full py-5 md:py-8 bg-white text-black rounded-xl md:rounded-[1.5rem] font-black uppercase text-lg md:text-2xl hover:bg-sky-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl flex items-center justify-center gap-3 md:gap-4 active:scale-[0.98]"
                        >
                            {selectedChannels.length === 0 ? "Select Channels" : (
                                <>
                                    <Zap size={20} className="md:w-6 md:h-6" fill="currentColor" /> 
                                    Synthesize {selectedChannels.length} Tracks
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
