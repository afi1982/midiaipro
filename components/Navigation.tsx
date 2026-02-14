
import React, { useEffect, useState, useRef } from 'react';
import { Home, Zap, Sliders, ListChecks, AudioWaveform, BrainCircuit, Music, Activity } from 'lucide-react';
import { jobQueueService } from '../services/jobQueueService';

interface NavigationProps {
  currentView: string;
  onChangeView: (view: any) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView }) => {
  const [jobsCount, setJobsCount] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsub = jobQueueService.subscribe((jobs) => {
      const active = jobs.filter(j => j.status === 'PROCESSING' || j.status === 'PENDING').length;
      setJobsCount(active);
    });
    return () => unsub();
  }, []);

  // AUTO-SCROLL LOGIC: Ensure active tab is visible
  useEffect(() => {
    if (activeTabRef.current) {
        activeTabRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
    }
  }, [currentView]);

  const navItems = [
    { id: 'WELCOME', label: 'Home', icon: Home },
    { id: 'CREATE', label: 'Create', icon: Zap },
    { id: 'STUDIO', label: 'Studio', icon: Sliders },
    { id: 'AUDIO_LAB', label: 'Audio Lab', icon: AudioWaveform },
    { id: 'GENERATOR', label: 'Loop Gen', icon: Music },
    { id: 'TRAINER', label: 'Trainer', icon: BrainCircuit },
    { id: 'JOBS', label: 'Jobs', icon: ListChecks, badge: jobsCount > 0 ? jobsCount : null },
  ];

  return (
    <header className="h-16 shrink-0 bg-[#08080A] border-b border-white/10 flex items-center justify-between px-4 md:px-6 relative z-[5000] shadow-lg">
      
      {/* Brand / Logo Area */}
      <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => onChangeView('WELCOME')}>
        <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(2,132,199,0.4)]">
            <Activity className="text-white w-5 h-5" />
        </div>
        <div className="flex flex-col leading-none hidden md:flex">
            <span className="text-lg font-black tracking-tighter text-white italic">MIDI <span className="text-sky-500">AI</span></span>
            <span className="text-[8px] text-gray-500 font-mono tracking-widest uppercase">Production Suite</span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav ref={navRef} className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar mx-4 h-full scroll-smooth">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          
          return (
            <button 
                key={item.id} 
                ref={isActive ? activeTabRef : null}
                onClick={() => onChangeView(item.id)} 
                className={`
                    relative flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-all duration-200 group whitespace-nowrap shrink-0
                    ${isActive ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}
                `}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? 'text-sky-400' : 'group-hover:text-gray-300'}`} />
              <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white' : ''}`}>
                  {item.label}
              </span>
              
              {/* Active Indicator */}
              {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.8)]"></div>
              )}

              {/* Notification Badge */}
              {item.badge && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#08080A]">
                      {item.badge}
                  </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Side Placeholder (User Profile / Settings could go here) */}
      <div className="shrink-0 w-8 h-8 hidden md:block"></div>
    </header>
  );
};
