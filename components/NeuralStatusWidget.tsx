
import React, { useEffect, useState } from 'react';
import { globalBrainService } from '../services/globalBrainService';
import { securityService } from '../services/securityService';
import { Activity, Globe, Lock, BrainCircuit, ShieldCheck } from 'lucide-react';

export const NeuralStatusWidget: React.FC = () => {
    const [brainStatus, setBrainStatus] = useState<any>({ online: false });
    const [secStatus, setSecStatus] = useState<any>({ secure: false });

    useEffect(() => {
        // Initial sync
        globalBrainService.syncWithWorld().then(() => {
            setBrainStatus(globalBrainService.getStatus());
        });
        setSecStatus(securityService.getStatus());

        // Poll for liveness
        const interval = setInterval(() => {
            setBrainStatus(globalBrainService.getStatus());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-4 bg-black/40 border border-white/5 rounded-full px-4 py-2 backdrop-blur-md">
            
            {/* Global Brain Status */}
            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                <div className="relative">
                    <Globe size={14} className="text-studio-accent" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Global Brain</span>
                    <span className="text-[9px] text-white font-mono">{brainStatus.online ? "CONNECTED" : "SYNCING..."}</span>
                </div>
            </div>

            {/* Neural Learning Status */}
            <div className="flex items-center gap-2 border-r border-white/10 pr-4 hidden md:flex">
                <BrainCircuit size={14} className="text-purple-400" />
                <div className="flex flex-col leading-none">
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">AI Model</span>
                    <span className="text-[9px] text-white font-mono">GEMINI-3-PRO</span>
                </div>
            </div>

            {/* Security Status */}
            <div className="flex items-center gap-2">
                <ShieldCheck size={14} className={secStatus.secure ? "text-green-400" : "text-yellow-500"} />
                <div className="flex flex-col leading-none">
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Security</span>
                    <span className="text-[9px] text-white font-mono">{secStatus.algorithm || "INIT"}</span>
                </div>
            </div>

        </div>
    );
};
