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
  <label className="flex items-center justify-between cursor-pointer py-3 hover:bg-black/5 transition-colors rounded-xl px-2">
    <div className="flex items-center gap-3">
      <div className={cn("p-1.5 rounded-lg", checked ? "bg-black text-white" : "bg-stone-200 text-stone-500")}>
        <Icon size={16} />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold text-stone-800">{label}</span>
      </div>
    </div>
    <div className={cn("w-8 h-4 rounded-full relative transition-colors", checked ? "bg-black" : "bg-stone-300")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
      <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", checked ? "left-4.5" : "left-0.5")} />
    </div>
  </label>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, onUpdate, isOpen, onClose, isSpeaking, onToggleSpeech, user, onLogin, onLogout
}) => {
  if (!isOpen) return null;

  return (
    // Bottom Sheet: fixed bottom-0, full width
    <div className="fixed bottom-0 left-0 w-full bg-[#FAFAFA] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[100] rounded-t-3xl animate-in slide-in-from-bottom duration-300 pb-safe-bottom font-sans text-[#1A1A1A]">
      
      {/* Drag Handle */}
      <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
      </div>

      <div className="p-6 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
        
        {/* 1. Theme (Compact) */}
        <div className="flex gap-2">
          {[
            { mode: ThemeMode.Day, icon: Sun, label: 'Day', bg: 'bg-white', text: 'text-black' },
            { mode: ThemeMode.Sepia, icon: Coffee, label: 'Sepia', bg: 'bg-[#F4ECD8]', text: 'text-[#5A4A42]' },
            { mode: ThemeMode.Night, icon: Moon, label: 'Night', bg: 'bg-[#1A1A1A]', text: 'text-stone-400' }
          ].map((t) => (
            <button key={t.mode} onClick={() => onUpdate({ theme: t.mode })} className={cn("flex-1 flex flex-col items-center gap-1.5 py-3 border rounded-xl transition-all", settings.theme === t.mode ? "border-black shadow-sm scale-[1.02]" : "border-transparent opacity-50 bg-stone-100", t.bg, t.text)}>
              <t.icon size={16} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.label}</span>
            </button>
          ))}
        </div>

        {/* 2. Font Size & Margins (Compact Sliders) */}
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <span className="text-xs font-bold w-12 text-stone-400">SIZE</span>
                <button onClick={() => onUpdate({ fontSize: Math.max(12, settings.fontSize - 1) })} className="w-8 h-8 bg-white border border-stone-200 rounded-full shadow-sm flex items-center justify-center"><Minus size={14}/></button>
                <input type="range" min="12" max="36" value={settings.fontSize} onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })} className="flex-1 accent-black h-1 bg-stone-200 rounded-full" />
                <button onClick={() => onUpdate({ fontSize: Math.min(36, settings.fontSize + 1) })} className="w-8 h-8 bg-white border border-stone-200 rounded-full shadow-sm flex items-center justify-center"><Plus size={14}/></button>
            </div>
            
            <div className="flex items-center gap-4">
                <span className="text-xs font-bold w-12 text-stone-400">LINE</span>
                <input type="range" min="1.2" max="2.2" step="0.1" value={settings.lineHeight} onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })} className="flex-1 accent-black h-1 bg-stone-200 rounded-full" />
            </div>

             <div className="flex items-center gap-4">
                <span className="text-xs font-bold w-12 text-stone-400">MARGIN</span>
                <input type="range" min="0" max="120" step="10" value={settings.marginHorizontal} onChange={(e) => onUpdate({ marginHorizontal: Number(e.target.value) })} className="flex-1 accent-black h-1 bg-stone-200 rounded-full" />
            </div>
        </div>

        {/* 3. Toggles (Grid) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Switch label="Traditional CN" icon={Type} checked={settings.chineseConversion} onChange={(val: boolean) => onUpdate({ chineseConversion: val })} />
            <Switch label="Bilingual" icon={Languages} checked={settings.bilingualMode} onChange={(val: boolean) => onUpdate({ bilingualMode: val })} />
            <Switch label="Audio" icon={Volume2} checked={settings.ttsEnabled} onChange={(val: boolean) => onUpdate({ ttsEnabled: val })} />
        </div>

      </div>
    </div>
  );
};