
import React from 'react';
import { ArrowRight, Cpu, Database, Music, BrainCircuit, Layers, Terminal, Activity, Anchor, Ruler } from 'lucide-react';

interface SystemArchitectureViewProps {
    onClose: () => void;
}

const SERVICE_GROUPS = [
    {
        title: "יצירת התווים והמלודיות (The Creators)",
        icon: <Music className="text-sky-400" />,
        color: "border-sky-500/30 bg-sky-900/10",
        services: [
            { 
                name: "geminiService.ts", 
                role: "המלחין הראשי (AI Composer)", 
                desc: "זהו המוח. כשאתה לוחץ 'Synthesize', הוא מקבל הנחיה (למשל 'Psytrance Drop') ומחזיר את רצף התווים הגולמי (ה-MIDI) למלודיה ולבאס." 
            },
            { 
                name: "melodicComposer.ts", 
                role: "מנוע מלודיות (Procedural Engine)", 
                desc: "גיבוי מתמטי. אם ה-AI לא מספק תוצאה, הקובץ הזה מייצר מלודיות טראנס לפי נוסחאות מתמטיות (תבניות של 1/16, עליות אוקטבה, Gate)." 
            },
            { 
                name: "maestroService.ts", 
                role: "הבמאי והמנצח (Director)", 
                desc: "הוא לא כותב תווים, אלא מחליט על המבנה: איפה יהיה ה-Drop, מתי נכנס ה-Kick, ומה יהיה ה-BPM הראשי של הפרויקט." 
            }
        ]
    },
    {
        title: "חוקים, סולם וקצב (Rules & Logic)",
        icon: <Ruler className="text-purple-400" />,
        color: "border-purple-500/30 bg-purple-900/10",
        services: [
            { 
                name: "theoryEngine.ts", 
                role: "שומר הסולם (Scale Enforcer)", 
                desc: "אחראי שהמוזיקה לא תזייף. לא משנה מה ה-AI מייצר, הקוד הזה מוודא שכל תו יושב בול על הסולם שבחרת (למשל F# Phrygian)." 
            },
            { 
                name: "optimizationService.ts", 
                role: "מהנדס המיקס (Engineer)", 
                desc: "אחראי על ה-'Groove'. הוא מוחק תווים שמתנגשים עם הקיק (Sidechain), מוסיף תזוזות קטנות (Humanize) ומוודא שהבאס והקיק לא מנגנים יחד (Phase)." 
            }
        ]
    },
    {
        title: "זיכרון ולמידה (Memory & Output)",
        icon: <Database className="text-yellow-400" />,
        color: "border-yellow-500/30 bg-yellow-900/10",
        services: [
            { 
                name: "learningBrainService.ts", 
                role: "הזיכרון (Long Term Memory)", 
                desc: "הקוד הזה אוגר מידע מקבצי MIDI שגררת בעבר ל'מעבדה'. הוא לומד דפוסים (כמו צפיפות תווים) כדי לשפר יצירות עתידיות." 
            },
            { 
                name: "audioService.ts", 
                role: "הנגן (Synthesizer)", 
                desc: "הופך את קבצי המידי לצליל שאתה שומע בדפדפן. משתמש בסינתיסייזרים וירטואליים פשוטים כדי לתת לך סקיצה מהירה." 
            }
        ]
    }
];

export const SystemArchitectureView: React.FC<SystemArchitectureViewProps> = ({ onClose }) => {
    return (
        <div className="h-full flex flex-col bg-[#050507] text-white font-sans animate-in slide-in-from-bottom-10" dir="rtl">
            <div className="h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-8 shrink-0 shadow-xl z-20">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                        <Layers className="text-sky-500" /> מפרט <span className="text-sky-500">המערכת</span>
                    </h1>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.3em]">מי מייצר את המוזיקה?</p>
                </div>
                <button onClick={onClose} className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest transition-all">
                    חזרה למערכת <ArrowRight size={14} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-32">
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="grid grid-cols-1 gap-8">
                        {SERVICE_GROUPS.map((group, idx) => (
                            <div key={idx} className="space-y-4">
                                <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-2">
                                    {group.icon}
                                    <h3 className="text-lg font-black uppercase tracking-widest text-gray-200">{group.title}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {group.services.map((service, sIdx) => (
                                        <div key={sIdx} className={`relative overflow-hidden bg-[#111] border border-white/5 rounded-xl p-5 hover:border-white/20 transition-all group hover:shadow-2xl`}>
                                            <div className={`absolute top-0 right-0 w-1 h-full ${group.color.split(' ')[0].replace('border','bg')}`}></div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <Terminal size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                                                <span className="text-xs font-black font-mono text-sky-300 bg-sky-900/20 px-2 py-0.5 rounded">{service.name}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white mb-2">{service.role}</h4>
                                            <p className="text-[11px] text-gray-400 leading-relaxed">{service.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
