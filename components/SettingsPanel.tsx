import React from 'react';
import { 
  Type, Sun, Moon, Coffee, Minus, Plus, MoveHorizontal, 
  ArrowUpDown, BookOpen, Languages, X, Gauge, Play, Pause, Volume2, Cloud, LogOut, User
} from 'lucide-react';
import { ReaderSettings, ThemeMode } from '../types';
import { cn } from '../utils';

interface SettingsPanelProps {
  settings: ReaderSettings;
  onUpdate: (newSettings: Partial<ReaderSettings>) => void;
  isOpen: boolean;
  onClose: () => void;
  isSpeaking: boolean;
  onToggleSpeech: () => void;
  user?: any;
  onLogin?: () => void;
  onLogout?: () => void;
}

const Switch = ({ checked, onChange, icon: Icon, label, sublabel }: any) => (
  <label className="flex items-center justify-between cursor-pointer py-4 hover:bg-stone-50 transition-colors rounded-xl px-2 -mx-2">
    <div className="flex items-center gap-3">
      <div className={cn("p-2 rounded-lg", checked ? "bg-black text-white" : "bg-stone-100 text-stone-400")}>
        <Icon size={18} />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-stone-800">{label}</span>
        {sublabel && <span className="text-[10px] text-stone-400 uppercase font-bold">{sublabel}</span>}
      </div>
    </div>
    <div className={cn("w-10 h-5 rounded-full relative transition-colors", checked ? "bg-black" : "bg-stone-200")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
      <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", checked ? "left-6" : "left-1")} />
    </div>
  </label>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, onUpdate, isOpen, onClose, isSpeaking, onToggleSpeech, user, onLogin, onLogout
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white/95 backdrop-blur-md shadow-2xl border border-stone-200 p-6 z-[100] rounded-[2.5rem] animate-in slide-in-from-bottom-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[10px] text-stone-400 uppercase tracking-widest font-black">Reading Preferences</h2>
        <button onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 transition-colors rounded-full"><X size={16} /></button>
      </div>

      <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
        {/* Theme Selection */}
        <div className="flex gap-3">
          {[
            { mode: ThemeMode.Day, icon: Sun, label: 'Pure', bg: 'bg-white', text: 'text-black' },
            { mode: ThemeMode.Sepia, icon: Coffee, label: 'Sepia', bg: 'bg-[#F4ECD8]', text: 'text-[#5A4A42]' },
            { mode: ThemeMode.Night, icon: Moon, label: 'Night', bg: 'bg-[#1A1A1A]', text: 'text-stone-400' }
          ].map((t) => (
            <button key={t.mode} onClick={() => onUpdate({ theme: t.mode })} className={cn("flex-1 flex flex-col items-center gap-2 py-3 border-2 rounded-2xl transition-all active:scale-95", settings.theme === t.mode ? "border-black shadow-md" : "border-transparent opacity-40", t.bg, t.text)}>
              <t.icon size={18} /><span className="text-[9px] font-black uppercase">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Audio Section (Integrated Play + Speed) */}
        <div className="bg-stone-50 p-5 rounded-3xl space-y-4 border border-stone-100">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1"><Gauge size={12}/> Audio</span>
                <span className="text-blue-600 font-mono text-xs font-bold">{(settings.readingSpeed || 1.0).toFixed(1)}x</span>
            </div>
            
            <button 
                onClick={onToggleSpeech}
                className={cn(
                    "w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95",
                    isSpeaking ? "bg-red-50 text-red-600 border border-red-100" : "bg-black text-white shadow-lg"
                )}
            >
                {isSpeaking ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                <span>{isSpeaking ? "Pause Reading" : "Read Aloud"}</span>
            </button>

            <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={settings.readingSpeed || 1.0} 
                onChange={(e) => onUpdate({ readingSpeed: Number(e.target.value) })} 
                className="w-full accent-black h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer" 
            />
            
            <div className="border-t border-stone-200/50 pt-2 mt-2">
                <Switch label="Paragraph TTS" sublabel="Tap to Speak (Cantonese)" icon={Volume2} checked={settings.ttsEnabled} onChange={(val: boolean) => onUpdate({ ttsEnabled: val })} />
            </div>
        </div>

        {/* Cloud Sync Section (New) */}
        <div className="bg-[#EBF5FF] p-5 rounded-3xl space-y-4 border border-blue-100">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1"><Cloud size={12}/> Cloud Sync</span>
            </div>
            
            {user ? (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 bg-white/50 p-2 rounded-xl">
                        {user.photoURL ? (
                            <img src={user.photoURL} className="w-8 h-8 rounded-full border border-stone-200" alt="Avatar" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500"><User size={16}/></div>
                        )}
                        <div className="flex flex-col overflow-hidden">
                             <span className="text-xs font-bold truncate text-stone-800">{user.displayName || 'User'}</span>
                             <span className="text-[10px] text-stone-500 truncate">{user.email}</span>
                        </div>
                    </div>
                    <button 
                        onClick={onLogout}
                        className="w-full py-2 bg-white hover:bg-red-50 text-stone-600 hover:text-red-500 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-blue-100/50 shadow-sm"
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            ) : (
                <button 
                    onClick={onLogin}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
                >
                    <span className="text-sm">Sign in with Google</span>
                </button>
            )}
        </div>

        {/* Typography */}
        <div className="space-y-4 px-1 pt-2">
            {/* Font Size */}
            <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black text-stone-400 uppercase tracking-widest">
                    <span><Type size={12} className="inline mr-1"/> Font Size</span>
                    <span className="text-black">{settings.fontSize}px</span>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onUpdate({ fontSize: Math.max(12, settings.fontSize - 1) })} className="w-10 h-10 bg-white border border-stone-100 rounded-xl shadow-sm active:scale-90 flex items-center justify-center"><Minus size={16}/></button>
                    <input type="range" min="12" max="42" value={settings.fontSize} onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })} className="flex-1 accent-black" />
                    <button onClick={() => onUpdate({ fontSize: Math.min(42, settings.fontSize + 1) })} className="w-10 h-10 bg-white border border-stone-100 rounded-xl shadow-sm active:scale-90 flex items-center justify-center"><Plus size={16}/></button>
                </div>
            </div>

            {/* Margins */}
            <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-black text-stone-400 uppercase tracking-widest">
                    <span><MoveHorizontal size={10} className="inline mr-1"/> Side Margin</span>
                    <span className="text-black">{settings.marginHorizontal}px</span>
                </div>
                <input type="range" min="16" max="200" value={settings.marginHorizontal} onChange={(e) => onUpdate({ marginHorizontal: Number(e.target.value) })} className="w-full accent-stone-800" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Line Height</span>
                    <input type="range" min="1.4" max="2.4" step="0.1" value={settings.lineHeight} onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })} className="w-full accent-stone-800" />
                </div>
                <div className="space-y-2">
                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Para Gap</span>
                    <input type="range" min="0.5" max="2.5" step="0.5" value={settings.paragraphSpacing || 1.5} onChange={(e) => onUpdate({ paragraphSpacing: Number(e.target.value) })} className="w-full accent-stone-800" />
                </div>
            </div>
        </div>

        {/* Toggles */}
        <div className="pt-4 border-t border-stone-100">
            <Switch label="Translation Layout" sublabel="Parallel View" icon={Languages} checked={settings.bilingualMode} onChange={(val: boolean) => onUpdate({ bilingualMode: val })} />
            <Switch label="Traditional CN" sublabel="HK / TW Standard" icon={Type} checked={settings.chineseConversion} onChange={(val: boolean) => onUpdate({ chineseConversion: val })} />
            <Switch label="Two Page View" sublabel="Landscape Only" icon={BookOpen} checked={settings.twoColumnMode} onChange={(val: boolean) => onUpdate({ twoColumnMode: val })} />
        </div>
      </div>
    </div>
  );
};