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
  // Navigation
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showMenu, setShowMenu] = useState(false); 
  
  // Panels
  const [showTypography, setShowTypography] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [showTocPanel, setShowTocPanel] = useState(false);
  
  // Features
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Auth
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

  // --- 2. Precision Layout Logic ---
  const [pageWidth, setPageWidth] = useState<number>(0);
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const calculatePages = useCallback(() => {
    if (!contentRef.current || !containerRef.current) return;
    
    // 1. Measure Container Exact Integer Width
    const containerRect = containerRef.current.getBoundingClientRect();
    const exactWidth = Math.floor(containerRect.width);
    
    // If container is collapsed or hidden, retry later
    if (exactWidth === 0) {
        requestAnimationFrame(calculatePages);
        return;
    }

    setPageWidth(exactWidth);

    // 2. Calculate Total Pages
    const scrollWidth = contentRef.current.scrollWidth;
    // We strictly use ceil to determine how many 'screens' the content takes up
    const pages = Math.max(1, Math.ceil(scrollWidth / exactWidth));
    
    setTotalPages(pages);
    
    // 3. Validate Current Page
    setCurrentPage(p => {
        const newPage = Math.min(Math.max(1, p), pages);
        return newPage;
    });
  }, [settings.fontSize, settings.lineHeight, processedContent, settings.twoColumnMode]);

  useEffect(() => {
    const timer = setTimeout(calculatePages, 50);
    const handleResize = () => calculatePages();
    window.addEventListener('resize', handleResize);
    
    const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(calculatePages);
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, [calculatePages]);

  // Sync progress
  useEffect(() => {
      const progress = totalPages > 1 ? (currentPage - 1) / (totalPages - 1) : 0;
      onUpdateProgress(progress);
  }, [currentPage, totalPages, onUpdateProgress]);

  // --- 3. Interaction Logic ---
  const checkForSelection = useCallback(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) return false;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;

      let top = rect.top - 60;
      if (top < 60) top = rect.bottom + 20;

      const menuWidth = 280;
      let left = rect.left + (rect.width / 2) - (menuWidth / 2);
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;

      setSelectionRect({ top, left });
      setSelectedText(selection.toString());
      return true;
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null; 
    touchStart.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
        if (checkForSelection()) return;
        if (!touchStart.current || !touchEnd.current) return;
        const distance = touchStart.current - touchEnd.current;
        touchStart.current = null;
        touchEnd.current = null;
        if (distance > minSwipeDistance) setCurrentPage(p => Math.min(totalPages, p + 1));
        else if (distance < -minSwipeDistance) setCurrentPage(p => Math.max(1, p - 1));
    }, 50);
  };

  const handleInteraction = (e: React.MouseEvent) => {
     if (window.getSelection()?.toString().trim().length > 0) return;
     if ((e.target as HTMLElement).closest('button, input, a')) return;
     if (selectionRect) {
         setSelectionRect(null);
         window.getSelection()?.removeAllRanges();
         return;
     }
     const x = e.clientX;
     const w = window.innerWidth;
     if (x < w * 0.25) setCurrentPage(p => Math.max(1, p - 1));
     else if (x > w * 0.75) setCurrentPage(p => Math.min(totalPages, p + 1));
     else setShowMenu(!showMenu);
  };

  const handleMouseUp = () => { setTimeout(checkForSelection, 10); };

  // --- 4. Actions ---
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

  const handleTranslate = () => { saveHighlight(undefined, `[AI] ${selectedText.substring(0, 15)}...`); };
  const handleCopy = () => {
      navigator.clipboard.writeText(selectedText);
      setSelectionRect(null);
      window.getSelection()?.removeAllRanges();
  };

  // --- 5. Jump to Chapter (Precise DOM Navigation) ---
  const jumpToChapter = (title: string) => {
      if (!contentRef.current || pageWidth === 0) return;

      // Find all header elements within the reader content
      const headers = Array.from(contentRef.current.querySelectorAll('h1, h2, h3, h4')) as HTMLElement[];
      
      // Find the one that matches our TOC title
      const targetHeader = headers.find(h => h.textContent?.trim() === title.trim());

      if (targetHeader) {
          // Calculate exact page: 
          // offsetLeft gives the pixel distance from the left edge of the content container.
          // Since the container is paginated horizontally using columns/transform, 
          // offsetLeft directly corresponds to the scroll position.
          const elementOffset = (targetHeader as HTMLElement).offsetLeft;
          
          // Convert pixels to page number (1-based index)
          const targetPage = Math.floor(elementOffset / pageWidth) + 1;
          
          setCurrentPage(targetPage);
          setShowTocPanel(false);
          setShowMenu(false);
      } else {
          console.warn("Chapter element not found in DOM:", title);
      }
  };

  // --- 6. Rendering Config ---
  const themeClasses = {
    bg: settings.theme === ThemeMode.Night ? "bg-[#121212]" : settings.theme === ThemeMode.Sepia ? "bg-[#F4ECD8]" : "bg-[#F9F9F9]",
    text: settings.theme === ThemeMode.Night ? "text-[#B0B0B0]" : settings.theme === ThemeMode.Sepia ? "text-[#5A4A42]" : "text-[#1A1A1A]",
    fg: settings.theme === ThemeMode.Night ? "text-white" : "text-black",
    uiBg: settings.theme === ThemeMode.Night ? "bg-[#1E1E1E]" : "bg-[#F9F9F9]" 
  };

  const horizontalMargin = isMobile ? Math.min(20, settings.marginHorizontal) : settings.marginHorizontal;
  const isTwoColumn = settings.twoColumnMode && !isMobile;
  const columnGap = isTwoColumn ? 60 : 0; 

  const toc = useMemo(() => {
    return processedContent.split('\n')
      .filter(line => line.startsWith('#'))
      .map((line, index) => ({
        // Clean title to match what shows up in the DOM (h1/h2 textContent)
        title: line.replace(/^#+\s*/, '').replace(/\*/g, '').trim(),
        level: (line.match(/^#+/) || ['#'])[0].length,
        index
      }));
  }, [processedContent]);

  return (
    <div className={cn("relative w-full h-full overflow-hidden flex flex-col transition-colors duration-500 font-serif touch-pan-y", themeClasses.bg, themeClasses.text)}>
      
      {/* 1. Top Bar */}
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

      {/* 2. Reader Content Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden cursor-text"
        onClick={handleInteraction}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseUp={handleMouseUp}
        style={{ width: '100%', height: '100vh' }}
      >
        <div 
            ref={contentRef}
            className={cn(
                "h-full transition-transform duration-300 ease-out will-change-transform", 
            )}
            style={{
                transform: `translateX(-${(currentPage - 1) * pageWidth}px)`,
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                textAlign: 'justify',
                
                columnCount: isTwoColumn ? 2 : 1,
                columnWidth: isTwoColumn ? 'auto' : `${pageWidth}px`,
                columnGap: `${columnGap}px`,
                columnRule: 'none',
                columnFill: 'auto', 

                height: 'calc(100vh - 120px)', 
                width: '100%', 
                marginTop: '60px',
                marginBottom: '60px',
                
                // IMPORTANT: Fix for CJK text overlapping
                wordBreak: 'break-all', 
                overflowWrap: 'break-word',
                hyphens: 'auto',
                WebkitHyphens: 'auto',
            }}
        >
            <style>{`
                .markdown-body {
                    padding: 0 ${horizontalMargin}px;
                    box-sizing: border-box;
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    max-width: 100%;
                }
                
                /* FIX: Use padding instead of margin for paragraphs to prevent column collapse issues with CJK */
                .markdown-body p { 
                    margin-bottom: 0 !important;
                    padding-bottom: ${(settings.paragraphSpacing || 1.5)}em !important; 
                    text-indent: ${(settings.paragraphSpacing || 0) > 0.5 ? '0' : '2em'};
                    text-align: justify;
                    text-justify: inter-ideograph; /* Crucial for CJK */
                    orphans: 2;
                    widows: 2;
                }

                .markdown-body h1, .markdown-body h2 {
                    margin-top: 0;
                    padding-top: 1.5em; 
                    padding-bottom: 0.8em; 
                    text-align: center;
                    page-break-after: avoid;
                    break-before: column; 
                    -webkit-column-break-before: always;
                }
                
                .markdown-body h1:first-child { break-before: auto; }

                .markdown-body img { 
                    max-width: 100%; 
                    height: auto; 
                    max-height: 60vh; 
                    display: block; 
                    margin: 1em auto; 
                    filter: ${settings.theme === ThemeMode.Night ? 'brightness(0.8) contrast(1.1)' : 'none'};
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
                            return (
                                <div className="relative group">
                                    <p {...props} className={cn(props.className, "relative")}>
                                        <HighlightText text={text} highlights={book.highlights} />
                                    </p>
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

      {/* 3. Highlight Menu */}
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

      {/* 4. Bottom Controls */}
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
          isSpeaking={isSpeaking} onToggleSpeech={() => {}} user={user} onLogin={login} onLogout={logout}
      />
      
      {/* 5. Panels (TOC/Notes) */}
      {showTocPanel && (
          <div className="absolute inset-0 z-[70] flex justify-start animate-in fade-in bg-black/20 backdrop-blur-[2px] select-none">
              <div className={cn("w-[85%] max-w-xs h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300", themeClasses.uiBg)}>
                  <div className="h-14 px-5 border-b border-black/5 flex justify-between items-center">
                      <span className={cn("text-xs font-bold uppercase tracking-widest opacity-50", themeClasses.fg)}>Contents</span>
                      <button onClick={() => setShowTocPanel(false)} className={cn("p-2 rounded-full hover:bg-black/5", themeClasses.fg)}><X size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                       {toc.map((item, i) => (
                          <button key={i} onClick={() => jumpToChapter(item.title)}
                            className={cn("w-full text-left px-4 py-3 rounded-lg text-sm transition-colors", 
                                "opacity-70 hover:bg-black/5 hover:opacity-100", themeClasses.fg)}>
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
              <div className={cn("w-[85%] max-w-xs h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300", themeClasses.uiBg)}>
                   <div className="h-14 px-5 border-b border-black/5 flex justify-between items-center">
                      <span className={cn("text-xs font-bold uppercase tracking-widest opacity-50", themeClasses.fg)}>Notes</span>
                      <button onClick={() => setShowNotesPanel(false)} className={cn("p-2 rounded-full hover:bg-black/5", themeClasses.fg)}><X size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                        <div className="space-y-3 p-2">
                            {(!book.highlights || book.highlights.length === 0) && <div className="text-center opacity-30 mt-10 text-xs text-stone-500">No notes yet.<br/>Select text to highlight.</div>}
                            {book.highlights?.map(h => (
                                <div key={h.id} className="bg-black/5 p-3 rounded-xl space-y-2">
                                    <div className={cn("text-sm italic font-serif opacity-80 border-l-2 border-yellow-400 pl-2", themeClasses.fg)}>"{h.text}"</div>
                                    {h.note && <div className="text-xs opacity-60 ml-2 font-sans bg-white/50 p-1 rounded px-2 inline-block">{h.note}</div>}
                                    <button onClick={() => { if(onUpdateBook) { const newHighlights = book.highlights.filter(hl => hl.id !== h.id); onUpdateBook(book.id, { highlights: newHighlights }); }}} className="text-[10px] text-red-300 hover:text-red-500 block w-full text-right uppercase font-bold mt-1">Delete</button>
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
