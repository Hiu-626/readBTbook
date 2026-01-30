import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, List, Battery, Type, Highlighter, Search, 
  X, MessageSquare, Languages, Bookmark, Copy,
  Play, Pause, Volume2 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Book, ReaderSettings, ThemeMode, Highlight } from '../types';
import { cn, convertToTraditional, uuidv4 } from '../utils';
import { SettingsPanel } from './SettingsPanel';

interface ReaderProps {
  book: Book;
  settings: ReaderSettings;
  onUpdateSettings: (s: Partial<ReaderSettings>) => void;
  onBack: () => void;
  onUpdateProgress: (progress: number) => void;
  onUpdateBook?: (bookId: string, updates: Partial<Book>) => void;
}

export const Reader: React.FC<ReaderProps> = ({ 
  book, settings, onUpdateSettings, onBack, onUpdateProgress, onUpdateBook 
}) => {
  // Navigation & View State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  
  // Panels
  const [showTypography, setShowTypography] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [showTocPanel, setShowTocPanel] = useState(false);
  
  // Features
  const [currentTime, setCurrentTime] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  
  // Highlighting
  const [selectionRect, setSelectionRect] = useState<{top: number, left: number} | null>(null);
  const [selectedText, setSelectedText] = useState('');

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const synth = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  // --- 1. Content Processing ---
  const [processedContent, setProcessedContent] = useState(book.content);

  useEffect(() => {
    let isMounted = true;
    const processContent = async () => {
      let content = book.content;
      // Chinese Conversion
      if (settings.chineseConversion) {
        try {
          content = await convertToTraditional(content);
        } catch (e) {
          console.warn('Conversion failed', e);
        }
      }
      if (isMounted) setProcessedContent(content);
    };
    processContent();
    return () => { isMounted = false; };
  }, [book.content, settings.chineseConversion]);

  // --- 2. Pagination Logic ---
  const calculatePages = useCallback(() => {
    if (!contentRef.current || !containerRef.current) return;
    const scrollWidth = contentRef.current.scrollWidth;
    const clientWidth = containerRef.current.clientWidth;
    // Debounce safety: ensure we have width
    if (clientWidth === 0) return;
    
    const pages = Math.ceil(scrollWidth / clientWidth) || 1;
    setTotalPages(pages);
    // Adjust current page if out of bounds (e.g. font size change)
    setCurrentPage(p => Math.min(p, pages));
  }, [settings.fontSize, settings.lineHeight, settings.marginHorizontal, processedContent, settings.bilingualMode]);

  useEffect(() => {
    const timer = setTimeout(calculatePages, 200);
    window.addEventListener('resize', calculatePages);
    return () => {
      window.removeEventListener('resize', calculatePages);
      clearTimeout(timer);
    };
  }, [calculatePages]);

  // --- 3. Interaction & Highlighting ---
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        let top = rect.top - 50;
        if (top < 10) top = rect.bottom + 10;
        
        setSelectionRect({
            top: top,
            left: rect.left + (rect.width / 2) - 80 
        });
        setSelectedText(selection.toString());
    } else {
        setSelectionRect(null);
    }
  };

  const saveHighlight = (note?: string, translation?: string) => {
    if (!onUpdateBook) return;
    
    const newHighlight: Highlight = {
        id: uuidv4(),
        text: selectedText,
        color: 'yellow',
        createdAt: Date.now(),
        note: note,
        translation: translation
    };

    const updatedHighlights = [...(book.highlights || []), newHighlight];
    onUpdateBook(book.id, { highlights: updatedHighlights });
    
    setSelectionRect(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleTranslate = () => {
      const mockTranslation = `[AI] ${selectedText.substring(0, 15)}...`;
      saveHighlight(undefined, mockTranslation);
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(selectedText);
      setSelectionRect(null);
      window.getSelection()?.removeAllRanges();
  };

  // --- 4. TTS Logic ---
  const toggleSpeech = () => {
    if (!synth.current) return;
    if (isSpeaking) {
      synth.current.cancel();
      setIsSpeaking(false);
      return;
    }

    let textToRead = '';
    const selection = window.getSelection()?.toString();

    if (selection && selection.length > 0) {
        textToRead = selection;
    } else {
        const plainText = processedContent.replace(/[#*`>!\[\]]/g, ''); 
        const startPos = Math.floor(plainText.length * ((currentPage - 1) / totalPages));
        textToRead = plainText.substring(startPos, startPos + 1000);
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = /[a-zA-Z]/.test(textToRead.substring(0, 20)) ? 'en-US' : 'zh-HK';
    utterance.rate = settings.readingSpeed || 1.0;
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synth.current.speak(utterance);
    setIsSpeaking(true);
  };

  const playParagraph = (text: string) => {
      if (!synth.current) return;
      // Immediate interrupt
      synth.current.cancel(); 
      setIsSpeaking(true); // Update global state if needed, though this is transient

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-HK'; // Enforce Cantonese
      utterance.rate = settings.readingSpeed || 1.0;
      
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synth.current.speak(utterance);
  };

  useEffect(() => {
      return () => { if (synth.current) synth.current.cancel(); }
  }, []);

  // --- 5. TOC Logic ---
  const toc = useMemo(() => {
    return processedContent.split('\n')
      .filter(line => line.startsWith('#'))
      .map((line, index) => ({
        title: line.replace(/^#+\s*/, '').replace(/\*/g, ''),
        level: (line.match(/^#+/) || ['#'])[0].length,
        index
      }));
  }, [processedContent]);

  // --- 6. Time & Theme ---
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000);
    return () => clearInterval(t);
  }, []);

  const themeClasses = {
    bg: settings.theme === ThemeMode.Night ? "bg-[#121212]" : settings.theme === ThemeMode.Sepia ? "bg-[#F4ECD8]" : "bg-[#F9F9F9]",
    text: settings.theme === ThemeMode.Night ? "text-stone-400" : settings.theme === ThemeMode.Sepia ? "text-[#5A4A42]" : "text-stone-900",
    border: settings.theme === ThemeMode.Night ? "border-white/10" : "border-stone-200"
  };

  // Dynamic Padding Calculation
  // Add extra base padding for tablets/desktop to prevent edge hugging
  const isLargeScreen = typeof window !== 'undefined' && window.innerWidth > 768;
  const basePadding = isLargeScreen ? 60 : 20; 
  const totalPadding = basePadding + settings.marginHorizontal;

  return (
    <div className={cn("relative w-full h-full overflow-hidden flex flex-col transition-colors duration-500 font-serif", themeClasses.bg, themeClasses.text)}>
      
      {/* 1. Top Status Bar */}
      <div className={cn(
          "absolute top-0 w-full h-10 flex justify-between items-center px-6 z-40 text-[10px] font-bold opacity-40 transition-transform duration-300", 
          showMenu ? "translate-y-0" : "-translate-y-full"
      )}>
        <span>{currentTime}</span>
        <span className="truncate max-w-[50%]">{book.title}</span>
        <div className="flex items-center gap-1.5">
          {isSpeaking && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
          <Battery size={14} />
        </div>
      </div>

      {/* 2. Main Reader Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden cursor-text"
        onClick={(e) => {
             // If clicking on a button inside, don't flip page (handled by stopPropagation usually)
             if ((e.target as HTMLElement).closest('button')) return;

             if (window.getSelection()?.toString()) return;
             const x = e.clientX;
             const w = window.innerWidth;
             if (x < w * 0.25) setCurrentPage(p => Math.max(1, p - 1));
             else if (x > w * 0.75) setCurrentPage(p => Math.min(totalPages, p + 1));
             else setShowMenu(!showMenu);
        }}
        onMouseUp={handleMouseUp}
        style={{ 
            paddingLeft: `${totalPadding}px`,
            paddingRight: `${totalPadding}px`,
            paddingTop: 'env(safe-area-inset-top, 40px)',
            paddingBottom: '80px'
        }}
      >
        <div 
            ref={contentRef}
            className={cn(
                "h-full transition-transform duration-500 ease-out", 
                settings.twoColumnMode && isLargeScreen ? "columns-2 gap-20" : "columns-1"
            )}
            style={{
                transform: `translateX(-${(currentPage - 1) * 100}%)`,
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                textAlign: settings.textAlign as any,
                columnRule: (settings.twoColumnMode && isLargeScreen) ? `1px solid ${settings.theme === ThemeMode.Night ? '#333' : '#e5e5e5'}` : 'none'
            }}
        >
            <style>{`
                .markdown-body p { 
                    margin-bottom: ${settings.paragraphSpacing || 1.5}em !important; 
                    text-indent: 2em;
                }
                /* Reset text-indent for Bilingual blocks to look cleaner */
                .bilingual-block p {
                    text-indent: 0 !important;
                    margin-bottom: 0 !important;
                }
                .markdown-body h1, .markdown-body h2, .markdown-body h3 {
                    margin-top: 2em; margin-bottom: 1em; font-weight: 700;
                    text-align: center;
                }
                .markdown-body img { 
                    max-width: 100%; height: auto; display: block; 
                    margin: 2em auto; border-radius: 4px; 
                    box-shadow: 0 4px 20px -5px rgba(0,0,0,0.1);
                }
            `}</style>
            
            <div className="markdown-body prose-stone max-w-none">
                <ReactMarkdown
                    components={{
                        img: ({node, ...props}) => <img {...props} loading="lazy" decoding="async" />,
                        p: ({node, children, ...props}) => {
                            // Logic to extract text from children for TTS and Translation
                            const getText = (nodes: any): string => {
                                if (typeof nodes === 'string') return nodes;
                                if (Array.isArray(nodes)) return nodes.map(getText).join('');
                                if (typeof nodes === 'object' && nodes?.props?.children) return getText(nodes.props.children);
                                return '';
                            };
                            const text = getText(children);
                            const hasText = text && text.trim().length > 0;

                            return (
                                <div className="relative group mb-6">
                                    {/* 1. TTS Button (Floating Left) */}
                                    {settings.ttsEnabled && hasText && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                playParagraph(text);
                                            }}
                                            className={cn(
                                                "absolute -left-8 top-1 p-1.5 transition-all z-10 rounded-full opacity-0 group-hover:opacity-100",
                                                settings.theme === ThemeMode.Night 
                                                    ? "text-stone-400 hover:text-white bg-white/10" 
                                                    : "text-stone-400 hover:text-stone-900 bg-black/5"
                                            )}
                                            title="Read aloud (Cantonese)"
                                        >
                                            <Volume2 size={14} />
                                        </button>
                                    )}

                                    {/* 2. Original Text */}
                                    <p {...props} className={cn(props.className, "relative")}>{children}</p>

                                    {/* 3. Translation Layout (Interleaved) */}
                                    {settings.bilingualMode && hasText && (
                                        <div className={cn(
                                            "bilingual-block mt-3 mb-6 p-4 rounded-xl border-l-4 transition-colors font-sans text-sm leading-relaxed",
                                            settings.theme === ThemeMode.Night 
                                                ? "bg-white/5 border-white/20 text-stone-400" 
                                                : settings.theme === ThemeMode.Sepia
                                                    ? "bg-[#E8DFC8] border-[#8B7355]/30 text-[#6D5A50]"
                                                    : "bg-stone-50 border-stone-200 text-stone-600"
                                        )}>
                                            <div className="flex items-center gap-2 mb-1.5 opacity-50">
                                                <Languages size={10} />
                                                <span className="text-[9px] font-bold uppercase tracking-widest">Translation</span>
                                            </div>
                                            <p>
                                                {/* Mock Translation: In a real app, you would fetch this from an API */}
                                                {/* Visual simulation of translation structure */}
                                                [翻譯示例] 這是該段落的自動翻譯內容。由於此演示版沒有後端 API，因此顯示此模擬文本以展示雙語排版效果。您的閱讀體驗將在此處顯示對應的中文翻譯。
                                                <br/><br/>
                                                <span className="opacity-50 italic text-xs">Original Text Snippet: {text.substring(0, 20)}...</span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    }}
                >
                    {processedContent}
                </ReactMarkdown>

                {settings.bilingualMode && (
                     <div className="opacity-40 text-[10px] mt-12 border-t pt-4 text-center font-sans tracking-widest uppercase">
                        End of Translation View
                     </div>
                )}
            </div>
        </div>
      </div>

      {/* 3. Floating Highlight Menu */}
      {selectionRect && (
        <div 
            className="fixed z-50 flex bg-[#1A1A1A] text-white rounded-full shadow-xl px-3 py-2 gap-3 items-center animate-in zoom-in-95 duration-200"
            style={{ top: selectionRect.top, left: Math.min(selectionRect.left, window.innerWidth - 200) }}
        >
            <button onClick={() => saveHighlight()} className="hover:text-yellow-400 transition-colors"><Highlighter size={18} /></button>
            <button onClick={handleTranslate} className="hover:text-blue-400 transition-colors flex items-center gap-1">
                <Languages size={18} />
            </button>
            <button onClick={() => { const note = prompt("Note:"); if(note) saveHighlight(note); }} className="hover:text-green-400 transition-colors"><MessageSquare size={18} /></button>
            <div className="w-[1px] h-4 bg-white/20"></div>
            <button onClick={handleCopy} className="hover:text-stone-300 transition-colors"><Copy size={16} /></button>
            <button onClick={() => setSelectionRect(null)} className="hover:text-red-400 transition-colors"><X size={18} /></button>
        </div>
      )}

      {/* 4. Bottom Controls (Simplified) */}
      <div className={cn(
          "absolute bottom-0 w-full z-50 border-t pb-safe-bottom bg-inherit transition-transform duration-300 shadow-2xl", 
          themeClasses.border, 
          showMenu ? "translate-y-0" : "translate-y-full"
      )}>
        {/* Progress Slider */}
        <div className="px-10 pt-6 pb-2">
            <input 
                type="range" min="1" max={totalPages} value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="w-full accent-stone-800 h-1.5 bg-stone-200/50 rounded-full appearance-none cursor-pointer"
            />
            <div className="flex justify-between mt-4 text-[9px] font-black opacity-30 tracking-widest">
                <span>{currentPage}</span>
                <span>{Math.round((currentPage / totalPages) * 100)}%</span>
                <span>{totalPages}</span>
            </div>
        </div>
        
        {/* Main Buttons (TTS Removed from here) */}
        <div className="flex justify-around items-center h-20 px-4">
            <button onClick={onBack} className="flex flex-col items-center gap-1.5 opacity-50 hover:opacity-100 active:scale-95 transition-all">
                <ArrowLeft size={20} />
                <span className="text-[8px] font-bold uppercase">Library</span>
            </button>
            <button onClick={() => { setShowTocPanel(true); setShowMenu(false); }} className="flex flex-col items-center gap-1.5 opacity-50 hover:opacity-100 active:scale-95 transition-all">
                <List size={20} />
                <span className="text-[8px] font-bold uppercase">Contents</span>
            </button>
            
            {/* Font/Typography (Now includes TTS) */}
            <button onClick={() => setShowTypography(!showTypography)} className="flex flex-col items-center gap-1.5 opacity-50 hover:opacity-100 active:scale-95 transition-all">
                <Type size={20} />
                <span className="text-[8px] font-bold uppercase">Settings</span>
            </button>

            <button onClick={() => { setShowNotesPanel(true); setShowMenu(false); }} className="flex flex-col items-center gap-1.5 opacity-50 hover:opacity-100 active:scale-95 transition-all">
                <Bookmark size={20} />
                <span className="text-[8px] font-bold uppercase">Notes</span>
            </button>
        </div>
      </div>

      {/* Settings Popup (Passed TTS props) */}
      <SettingsPanel 
          settings={settings} 
          onUpdate={onUpdateSettings} 
          isOpen={showTypography && showMenu} 
          onClose={() => setShowTypography(false)} 
          isSpeaking={isSpeaking}
          onToggleSpeech={toggleSpeech}
      />
      
      {/* 5. TOC Panel */}
      {showTocPanel && (
          <div className="absolute inset-0 z-[70] flex animate-in fade-in">
              <div className="w-[85%] max-w-xs h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 font-sans">
                  <div className="h-16 px-6 border-b flex justify-between items-center bg-stone-50">
                      <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">Contents</h3>
                      <button onClick={() => setShowTocPanel(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors"><X size={16}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {toc.map((item, i) => (
                          <button key={i} onClick={() => { setCurrentPage(Math.max(1, Math.floor((item.index / toc.length) * totalPages))); setShowTocPanel(false); }}
                            className={cn(
                                "w-full text-left px-4 py-4 rounded-lg flex items-center justify-between text-sm transition-colors", 
                                Math.floor((currentPage/totalPages)*toc.length) === i ? "bg-stone-100 font-bold text-black" : "text-stone-500 hover:bg-stone-50"
                            )}
                          >
                            <span className={cn("truncate", item.level > 1 && "pl-4 opacity-80")}>{item.title}</span>
                          </button>
                      ))}
                  </div>
              </div>
              <div className="flex-1 bg-black/20 backdrop-blur-[2px]" onClick={() => setShowTocPanel(false)} />
          </div>
      )}

      {/* 6. Notes & Highlights Sidebar */}
      {showNotesPanel && (
          <div className="absolute inset-0 z-[70] flex justify-end animate-in fade-in">
              <div className="flex-1 bg-black/20 backdrop-blur-[2px]" onClick={() => setShowNotesPanel(false)} />
              <div className="w-[85%] max-w-xs h-full bg-[#F5F5F5] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-[#D1D1D1]">
                  <div className="h-16 px-6 border-b border-[#D1D1D1] flex justify-between items-center bg-[#FAFAFA]">
                      <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">Notes</h3>
                      <button onClick={() => setShowNotesPanel(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors"><X size={16}/></button>
                  </div>
                  
                  <div className="p-4 border-b border-[#D1D1D1] bg-white">
                      <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"/>
                          <input 
                            type="text" 
                            placeholder="Filter notes..." 
                            value={noteSearchQuery}
                            onChange={(e) => setNoteSearchQuery(e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-stone-400 transition-colors font-sans"
                          />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {(!book.highlights || book.highlights.length === 0) ? (
                           <div className="flex flex-col items-center justify-center h-40 opacity-30 gap-2">
                               <Bookmark size={24} />
                               <span className="text-xs">No highlights yet</span>
                           </div>
                      ) : (
                          book.highlights.filter(h => h.text.includes(noteSearchQuery)).reverse().map(h => (
                              <div key={h.id} className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-col gap-2">
                                  <div className="flex gap-3">
                                      <div className="w-1 rounded-full bg-yellow-400 shrink-0 self-stretch"/>
                                      <p className="text-sm font-serif italic text-stone-700 line-clamp-4 leading-relaxed">"{h.text}"</p>
                                  </div>
                                  
                                  {h.translation && (
                                      <div className="ml-4 mt-1 bg-blue-50 p-2 rounded-lg text-xs text-blue-800 border border-blue-100">
                                          <span className="font-bold opacity-50 block text-[9px] uppercase mb-1">Translation</span>
                                          {h.translation}
                                      </div>
                                  )}
                                  
                                  {h.note && (
                                      <div className="ml-4 mt-1 bg-stone-50 p-2 rounded-lg text-xs text-stone-600 border border-stone-100 font-sans">
                                          <span className="font-bold opacity-50 mr-2">NOTE</span>
                                          {h.note}
                                      </div>
                                  )}
                                  
                                  <div className="text-[9px] text-stone-300 text-right mt-1 font-mono">
                                      {new Date(h.createdAt).toLocaleDateString()}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};