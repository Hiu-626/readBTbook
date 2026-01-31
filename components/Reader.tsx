import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, List, Type, Highlighter, Search, 
  X, MessageSquare, Languages, Bookmark, Copy,
  Play, Pause, Volume2 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Book, ReaderSettings, ThemeMode, Highlight } from '../types';
import { cn, convertToTraditional, uuidv4 } from '../utils';
import { SettingsPanel } from './SettingsPanel';
import { auth, login, logout } from '../firebase'; 

interface ReaderProps {
  book: Book;
  settings: ReaderSettings;
  onUpdateSettings: (s: Partial<ReaderSettings>) => void;
  onBack: () => void;
  onUpdateProgress: (progress: number) => void;
  onUpdateBook?: (bookId: string, updates: Partial<Book>) => void;
}

// Helper to highlight text within Markdown paragraphs
const HighlightText = ({ text, highlights }: { text: string, highlights: Highlight[] }) => {
    if (!highlights || highlights.length === 0) return <>{text}</>;

    let parts: { text: string; highlight?: Highlight }[] = [{ text }];

    highlights.forEach(h => {
        const newParts: typeof parts = [];
        parts.forEach(part => {
            if (part.highlight) {
                newParts.push(part);
                return;
            }
            // Simple string matching (Production would use CFI or range indices)
            const idx = part.text.indexOf(h.text);
            if (idx !== -1) {
                if (idx > 0) newParts.push({ text: part.text.substring(0, idx) });
                newParts.push({ text: h.text, highlight: h });
                if (idx + h.text.length < part.text.length) {
                    newParts.push({ text: part.text.substring(idx + h.text.length) });
                }
            } else {
                newParts.push(part);
            }
        });
        parts = newParts;
    });

    return (
        <>
            {parts.map((part, i) => 
                part.highlight ? (
                    <span key={i} className="bg-yellow-200/50 dark:bg-yellow-600/30 rounded-sm cursor-pointer border-b-2 border-yellow-300/50" title={part.highlight.note || "Highlight"}>
                        {part.text}
                    </span>
                ) : (
                    <span key={i}>{part.text}</span>
                )
            )}
        </>
    );
};

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
      if (auth) {
        const unsub = auth.onAuthStateChanged(setUser);
        return () => unsub();
      }
  }, []);
  
  // Highlighting
  const [selectionRect, setSelectionRect] = useState<{top: number, left: number} | null>(null);
  const [selectedText, setSelectedText] = useState('');

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const synth = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  // Touch State
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const minSwipeDistance = 50;

  // Audio State
  const speechState = useRef<{ active: boolean; index: number; segments: string[] }>({ 
      active: false, 
      index: -1, 
      segments: [] 
  });

  // --- 1. Content Processing ---
  const [processedContent, setProcessedContent] = useState(book.content);

  useEffect(() => {
    let isMounted = true;
    const processContent = async () => {
      let content = book.content;
      if (settings.chineseConversion) {
        try {
          content = await convertToTraditional(content);
        } catch (e) {
          console.warn('Conversion failed', e);
        }
      }
      if (isMounted) {
          setProcessedContent(content);
          const cleanText = content.replace(/!\[.*?\]\(.*?\)/g, ''); 
          const segments = cleanText.split(/\n\s*\n/)
             .map(s => s.replace(/[#*`>]/g, '').trim())
             .filter(s => s.length > 0);
          speechState.current.segments = segments;
      }
    };
    processContent();
    return () => { isMounted = false; };
  }, [book.content, settings.chineseConversion]);

  // --- 2. Pagination Logic ---
  const [columnWidth, setColumnWidth] = useState<number>(0);
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const calculatePages = useCallback(() => {
    if (!contentRef.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const clientWidth = Math.floor(containerRect.width);
    
    if (clientWidth === 0) {
        requestAnimationFrame(calculatePages);
        return;
    }

    setColumnWidth(clientWidth);

    const scrollWidth = contentRef.current.scrollWidth;
    const pages = Math.max(1, Math.ceil(scrollWidth / clientWidth));
    
    setTotalPages(pages);
    setCurrentPage(p => {
        const newPage = Math.min(Math.max(1, p), pages);
        return newPage;
    });
  }, [settings.fontSize, settings.lineHeight, settings.marginHorizontal, processedContent, settings.bilingualMode, settings.twoColumnMode]);

  useEffect(() => {
    const timer = setTimeout(calculatePages, 100);
    window.addEventListener('resize', calculatePages);
    const resizeObserver = new ResizeObserver(() => calculatePages());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', calculatePages);
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, [calculatePages]);

  // --- 3. Unified Selection Logic ---
  const checkForSelection = useCallback(() => {
      const selection = window.getSelection();
      
      // If no selection or empty selection, return false
      if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
          return false;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0) return false;

      // Smart positioning for mobile
      let top = rect.top - 60;
      // If too close to top edge, show below the selection
      if (top < 60) top = rect.bottom + 20;

      // Center horizontally, but keep within screen bounds
      const menuWidth = 280; // Approximate width of menu
      let left = rect.left + (rect.width / 2) - (menuWidth / 2);
      
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;

      setSelectionRect({ top, left });
      setSelectedText(selection.toString());
      return true;
  }, []);

  // --- 4. Touch & Interaction ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null; 
    touchStart.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    // CRITICAL: On mobile, selection usually settles slightly after touchend.
    // We wait briefly to check if the user was selecting text.
    setTimeout(() => {
        // 1. Check if user selected text
        const hasSelection = checkForSelection();
        if (hasSelection) {
            // User is selecting, DO NOT swipe or turn page
            return;
        }

        // 2. If no selection, handle Swipe
        if (!touchStart.current || !touchEnd.current) return;
        const distance = touchStart.current - touchEnd.current;

        // Reset
        touchStart.current = null;
        touchEnd.current = null;

        if (distance > minSwipeDistance) setCurrentPage(p => Math.min(totalPages, p + 1));
        else if (distance < -minSwipeDistance) setCurrentPage(p => Math.max(1, p - 1));
    }, 50); // 50ms delay to allow selection to register
  };

  const handleInteraction = (e: React.MouseEvent) => {
     // CRITICAL: Desktop check. If text is selected, stop.
     if (window.getSelection()?.toString().trim().length > 0) return;
     
     // Prevent clicking UI elements from triggering page turn
     if ((e.target as HTMLElement).closest('button, input, a')) return;
     
     // If menu is open, closing it takes precedence
     if (selectionRect) {
         setSelectionRect(null);
         window.getSelection()?.removeAllRanges();
         return;
     }

     // Use clientX from mouse event
     const x = e.clientX;
     const w = window.innerWidth;
     
     // Navigation Zones
     if (x < w * 0.25) setCurrentPage(p => Math.max(1, p - 1));
     else if (x > w * 0.75) setCurrentPage(p => Math.min(totalPages, p + 1));
     else setShowMenu(!showMenu);
  };

  // Handle MouseUp for Desktop Selection
  const handleMouseUp = () => {
      // Small timeout to let click event finish before checking selection
      setTimeout(() => {
          checkForSelection();
      }, 10);
  };

  // --- 5. Actions ---
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
    onUpdateBook(book.id, { highlights: [...(book.highlights || []), newHighlight] });
    setSelectionRect(null);
    window.getSelection()?.removeAllRanges();
    if (note) setShowNotesPanel(true);
  };

  const handleTranslate = () => {
      saveHighlight(undefined, `[AI] ${selectedText.substring(0, 15)}...`);
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(selectedText);
      setSelectionRect(null);
      window.getSelection()?.removeAllRanges();
  };

  // --- 6. TTS Logic ---
  const speakNext = useCallback(() => {
      if (!synth.current || !speechState.current.active) return;
      const { index, segments } = speechState.current;
      if (index >= segments.length || index < 0) {
          setIsSpeaking(false);
          speechState.current.active = false;
          return;
      }
      const text = segments[index];
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = /[a-zA-Z]/.test(text.substring(0, 20)) ? 'en-US' : 'zh-HK';
      utterance.rate = settings.readingSpeed || 1.0;
      utterance.onend = () => {
          if (speechState.current.active) {
              speechState.current.index += 1;
              speakNext();
          } else {
              setIsSpeaking(false);
          }
      };
      utterance.onerror = () => {
          setIsSpeaking(false);
          speechState.current.active = false;
      };
      synth.current.speak(utterance);
  }, [settings.readingSpeed]);

  const stopSpeaking = () => {
      speechState.current.active = false;
      if (synth.current) synth.current.cancel();
      setIsSpeaking(false);
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      const progress = (currentPage - 1) / totalPages;
      const totalSegments = speechState.current.segments.length;
      const startIndex = Math.floor(totalSegments * progress);
      setIsSpeaking(true);
      speechState.current = { ...speechState.current, active: true, index: Math.max(0, startIndex) };
      if (synth.current) synth.current.cancel();
      speakNext();
    }
  };

  const startReadingFromParagraph = (text: string) => {
      const segments = speechState.current.segments;
      const snippet = text.substring(0, 30).trim();
      let index = segments.findIndex(s => s.includes(snippet));
      if (index === -1) index = Math.floor(segments.length * ((currentPage - 1) / totalPages));
      if (synth.current) synth.current.cancel();
      setIsSpeaking(true);
      speechState.current = { ...speechState.current, active: true, index: index };
      speakNext();
  };

  useEffect(() => { return () => { stopSpeaking(); } }, []);

  // --- 7. TOC Logic ---
  const toc = useMemo(() => {
    return processedContent.split('\n')
      .filter(line => line.startsWith('#'))
      .map((line, index) => ({
        title: line.replace(/^#+\s*/, '').replace(/\*/g, ''),
        level: (line.match(/^#+/) || ['#'])[0].length,
        index
      }));
  }, [processedContent]);

  const themeClasses = {
    bg: settings.theme === ThemeMode.Night ? "bg-[#121212]" : settings.theme === ThemeMode.Sepia ? "bg-[#F4ECD8]" : "bg-[#F9F9F9]",
    text: settings.theme === ThemeMode.Night ? "text-[#B0B0B0]" : settings.theme === ThemeMode.Sepia ? "text-[#5A4A42]" : "text-[#1A1A1A]",
    fg: settings.theme === ThemeMode.Night ? "text-white" : "text-black",
    uiBg: settings.theme === ThemeMode.Night ? "bg-[#1E1E1E]" : "bg-[#F9F9F9]" 
  };

  const isLargeScreen = typeof window !== 'undefined' && window.innerWidth > 768;
  const basePadding = isLargeScreen ? 60 : 20; 
  const userMargin = isMobile ? Math.min(24, settings.marginHorizontal) : settings.marginHorizontal;
  const totalPadding = basePadding + userMargin;
  const computedTextAlign = isMobile ? 'left' : settings.textAlign;

  return (
    // Changed: Removed 'select-none' from root container to allow text selection where specified
    <div className={cn("relative w-full h-full overflow-hidden flex flex-col transition-colors duration-500 font-serif touch-pan-y", themeClasses.bg, themeClasses.text)}>
      
      {/* 1. Top Status Bar (Added select-none to prevent accidental UI selection) */}
      <div className={cn(
          "absolute top-0 w-full h-14 flex justify-between items-center px-4 z-40 transition-transform duration-300 border-b border-black/5 select-none", 
          themeClasses.uiBg,
          showMenu ? "translate-y-0" : "-translate-y-full"
      )}>
        <button onClick={onBack} className={cn("p-2 rounded-full hover:bg-black/5 transition-colors", themeClasses.fg)}>
            <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
        <span className={cn("truncate max-w-[60%] text-sm font-semibold tracking-wide", themeClasses.fg)}>{book.title}</span>
        <div className="w-10"></div> 
      </div>

      {/* 2. Main Reader Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden cursor-text"
        onClick={handleInteraction}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseUp={handleMouseUp}
        style={{ 
            paddingLeft: `${totalPadding}px`,
            paddingRight: `${totalPadding}px`,
            paddingTop: 'calc(env(safe-area-inset-top, 20px) + 20px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 40px)'
        }}
      >
        <div 
            ref={contentRef}
            className={cn(
                "h-full transition-transform duration-300 ease-out will-change-transform", 
                settings.twoColumnMode && isLargeScreen ? "columns-2" : "columns-1"
            )}
            style={{
                transform: `translateX(-${(currentPage - 1) * 100}%)`,
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                textAlign: computedTextAlign as any,
                columnFill: 'auto',
                columnWidth: (settings.twoColumnMode && isLargeScreen) ? 'auto' : `${columnWidth}px`,
                columnGap: (settings.twoColumnMode && isLargeScreen) ? '80px' : '0px',
                columnRule: (settings.twoColumnMode && isLargeScreen) ? `1px solid ${settings.theme === ThemeMode.Night ? '#333' : '#e5e5e5'}` : 'none',
                height: '100%',
                width: '100%'
            }}
        >
            <style>{`
                .markdown-body p { 
                    margin-bottom: ${(settings.paragraphSpacing || 1.5)}em !important; 
                    text-indent: ${(settings.paragraphSpacing || 0) > 0.5 ? '0' : '2em'};
                    max-width: 100%;
                }
                .markdown-body h1, .markdown-body h2 {
                    margin-top: 1.5em; 
                    margin-bottom: 0.8em; 
                    text-align: center;
                    page-break-after: avoid;
                    break-before: column; 
                    -webkit-column-break-before: always;
                }
                .markdown-body h1:first-child {
                     break-before: auto;
                }
                .markdown-body img { 
                    max-width: 100%; 
                    height: auto; 
                    max-height: 70vh; 
                    display: block; 
                    margin: 2em auto; 
                    filter: ${settings.theme === ThemeMode.Night ? 'brightness(0.8) contrast(1.1)' : 'none'};
                }
                /* IMPORTANT: Enable selection specifically on content */
                .markdown-body {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                }
                ::selection {
                   background: ${settings.theme === ThemeMode.Night ? '#444' : '#E6E6E6'};
                }
            `}</style>
            
            <div className="markdown-body prose-stone max-w-none">
                <ReactMarkdown
                    components={{
                        img: ({node, ...props}) => <img {...props} loading="lazy" decoding="async" />,
                        p: ({node, children, ...props}) => {
                            const getText = (nodes: any): string => {
                                if (typeof nodes === 'string') return nodes;
                                if (Array.isArray(nodes)) return nodes.map(getText).join('');
                                if (typeof nodes === 'object' && nodes?.props?.children) return getText(nodes.props.children);
                                return '';
                            };
                            const text = getText(children);
                            const hasText = text && text.trim().length > 0;
                            
                            return (
                                <div className="relative group">
                                    {settings.ttsEnabled && hasText && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); startReadingFromParagraph(text); }}
                                            className={cn(
                                                "absolute -left-10 top-0 p-2 transition-all z-10 rounded-full opacity-0 group-hover:opacity-100",
                                                settings.theme === ThemeMode.Night ? "text-stone-400 bg-white/10" : "text-stone-400 bg-black/5"
                                            )}
                                        >
                                            <Volume2 size={16} />
                                        </button>
                                    )}
                                    <p {...props} className={cn(props.className, "relative")}>
                                        <HighlightText text={text} highlights={book.highlights} />
                                    </p>
                                    {settings.bilingualMode && hasText && (
                                        <div className={cn("bilingual-block mt-2 mb-6 p-4 rounded-lg border-l-[3px] text-[0.9em] opacity-80", themeClasses.text)}>
                                            <div className="flex items-center gap-2 mb-1 opacity-60"><Languages size={10} /><span className="text-[9px] font-bold uppercase">Translation</span></div>
                                            <p>[翻譯] 這是自動生成的翻譯佔位符。</p>
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    }}
                >
                    {processedContent}
                </ReactMarkdown>
                {settings.bilingualMode && <div className="opacity-40 text-[10px] mt-12 border-t pt-4 text-center tracking-widest uppercase">End</div>}
            </div>
        </div>
      </div>

      {/* 3. Floating Highlight Menu (Fixed positioning for mobile stability) */}
      {selectionRect && (
        <div 
            className="fixed z-[100] flex bg-[#1A1A1A] text-white rounded-full shadow-2xl px-4 py-2 gap-4 items-center animate-in zoom-in-95 duration-200 select-none"
            style={{ top: selectionRect.top, left: selectionRect.left }}
        >
            <button onClick={() => saveHighlight()}><Highlighter size={18} /></button>
            <button onClick={handleTranslate}><Languages size={18} /></button>
            <button onClick={() => { const note = prompt("Note:"); if(note) saveHighlight(note); }}><MessageSquare size={18} /></button>
            <div className="w-[1px] h-4 bg-white/20"></div>
            <button onClick={handleCopy}><Copy size={16} /></button>
            <button onClick={() => setSelectionRect(null)} className="text-red-400"><X size={18} /></button>
        </div>
      )}

      {/* 4. Bottom Controls (Added select-none) */}
      <div className={cn(
          "absolute bottom-0 w-full z-50 pb-safe-bottom transition-transform duration-300 border-t border-black/5 select-none", 
          themeClasses.uiBg,
          showMenu ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="px-6 pt-6 pb-2">
            <input type="range" min="1" max={totalPages} value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))} 
                className={cn("w-full h-1 bg-stone-300 rounded-full appearance-none cursor-pointer opacity-80 hover:opacity-100 transition-opacity", settings.theme === ThemeMode.Night && "bg-white/20")} />
            <div className={cn("text-center mt-2 text-[10px] font-bold tracking-widest opacity-40", themeClasses.fg)}>
                PAGE {currentPage} / {totalPages}
            </div>
        </div>
        
        <div className="flex justify-around items-center h-16 px-4">
            <button onClick={() => { setShowTocPanel(true); setShowMenu(false); }} className={cn("p-4 opacity-70 hover:opacity-100 transition-opacity", themeClasses.fg)}>
                <List size={22} strokeWidth={1.5} />
            </button>
            <button onClick={() => setShowTypography(!showTypography)} className={cn("p-4 opacity-70 hover:opacity-100 transition-opacity", themeClasses.fg)}>
                <Type size={22} strokeWidth={1.5} />
            </button>
            <button onClick={() => { setShowNotesPanel(true); setShowMenu(false); }} className={cn("p-4 opacity-70 hover:opacity-100 transition-opacity", themeClasses.fg)}>
                <Bookmark size={22} strokeWidth={1.5} />
            </button>
        </div>
      </div>

      <SettingsPanel 
          settings={settings} onUpdate={onUpdateSettings} 
          isOpen={showTypography && showMenu} onClose={() => setShowTypography(false)} 
          isSpeaking={isSpeaking} onToggleSpeech={toggleSpeech} user={user} onLogin={login} onLogout={logout}
      />
      
      {/* 5. Sidebar Panels */}
      {showTocPanel && (
          <div className="absolute inset-0 z-[70] flex justify-start animate-in fade-in bg-black/20 backdrop-blur-[2px] select-none">
              <div className={cn(
                  "w-[85%] max-w-xs h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300",
                  themeClasses.uiBg
              )}>
                  <div className="h-14 px-5 border-b border-black/5 flex justify-between items-center">
                      <span className={cn("text-xs font-bold uppercase tracking-widest opacity-50", themeClasses.fg)}>
                          Contents
                      </span>
                      <button onClick={() => setShowTocPanel(false)} className={cn("p-2 rounded-full hover:bg-black/5", themeClasses.fg)}><X size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                       {toc.map((item, i) => (
                          <button key={i} onClick={() => { setCurrentPage(Math.max(1, Math.floor((item.index / toc.length) * totalPages))); setShowTocPanel(false); }}
                            className={cn("w-full text-left px-4 py-3 rounded-lg text-sm transition-colors", 
                                Math.floor((currentPage/totalPages)*toc.length) === i ? "bg-black/5 font-bold" : "opacity-70 hover:bg-black/5", themeClasses.fg)}>
                            <span className={cn("block truncate", item.level > 1 && "pl-4 opacity-80")}>{item.title}</span>
                          </button>
                      ))}
                  </div>
              </div>
              <div className="flex-1" onClick={() => setShowTocPanel(false)} />
          </div>
      )}

      {showNotesPanel && (
          <div className="absolute inset-0 z-[70] flex justify-end animate-in fade-in bg-black/20 backdrop-blur-[2px] select-none">
              <div className="flex-1" onClick={() => setShowNotesPanel(false)} />
              <div className={cn(
                  "w-[85%] max-w-xs h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300",
                  themeClasses.uiBg
              )}>
                   <div className="h-14 px-5 border-b border-black/5 flex justify-between items-center">
                      <span className={cn("text-xs font-bold uppercase tracking-widest opacity-50", themeClasses.fg)}>
                          Notes
                      </span>
                      <button onClick={() => setShowNotesPanel(false)} className={cn("p-2 rounded-full hover:bg-black/5", themeClasses.fg)}><X size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                        <div className="space-y-3 p-2">
                            {(!book.highlights || book.highlights.length === 0) && <div className="text-center opacity-30 mt-10 text-xs text-stone-500">No notes yet.<br/>Select text to highlight.</div>}
                            {book.highlights?.map(h => (
                                <div key={h.id} className="bg-black/5 p-3 rounded-xl space-y-2">
                                    <div className={cn("text-sm italic font-serif opacity-80 border-l-2 border-yellow-400 pl-2", themeClasses.fg)}>"{h.text}"</div>
                                    {h.note && <div className="text-xs opacity-60 ml-2 font-sans bg-white/50 p-1 rounded px-2 inline-block">{h.note}</div>}
                                    {h.translation && <div className="text-xs text-blue-500 ml-2 font-sans">{h.translation}</div>}
                                    <button onClick={() => {
                                        if(onUpdateBook) {
                                            const newHighlights = book.highlights.filter(hl => hl.id !== h.id);
                                            onUpdateBook(book.id, { highlights: newHighlights });
                                        }
                                    }} className="text-[10px] text-red-300 hover:text-red-500 block w-full text-right uppercase font-bold mt-1">Delete</button>
                                </div>
                            ))}
                        </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};