import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Book, ReaderSettings, ThemeMode } from './types';
import { DEFAULT_SETTINGS, DEMO_BOOK } from './components/constants';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { WarmthOverlay } from './components/WarmthOverlay';
import { uuidv4, parseEbook } from './utils';

const App: React.FC = () => {
  // State
  const [view, setView] = useState<'library' | 'reader'>('library');
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([DEMO_BOOK]);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [isImporting, setIsImporting] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('inkflow-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Save settings on change
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('inkflow-settings', JSON.stringify(updated));
      return updated;
    });
  };

  const activeBook = books.find(b => b.id === activeBookId);

  const handleSelectBook = (book: Book) => {
    setActiveBookId(book.id);
    setView('reader');
  };

  const handleUpdateProgress = (progress: number) => {
    if (!activeBookId) return;
    setBooks(prev => prev.map(b => 
        b.id === activeBookId ? { ...b, progress, lastRead: Date.now() } : b
    ));
  };

  const handleUpdateBook = (bookId: string, updates: Partial<Book>) => {
    setBooks(prev => prev.map(b => 
        b.id === bookId ? { ...b, ...updates } : b
    ));
  };

  const handleDeleteBook = (bookId: string) => {
    setBooks(prev => prev.filter(b => b.id !== bookId));
    if (activeBookId === bookId) {
        setActiveBookId(null);
        setView('library');
    }
  };

  const handleImportBook = async (file: File) => {
    setIsImporting(true);
    try {
        const result = await parseEbook(file);
        const newBook: Book = {
            id: uuidv4(),
            title: result.title || file.name.replace(/\.(txt|md|epub|pdf|mobi)$/i, ''),
            author: result.author || 'Unknown Author',
            content: result.content, 
            progress: 0,
            totalWords: result.content.split(/\s+/).length,
            lastRead: Date.now(),
            coverUrl: result.coverUrl,
            highlights: []
        };
        setBooks(prev => [newBook, ...prev]);
    } catch (e) {
        alert("Failed to import book: " + (e as Error).message);
    } finally {
        setIsImporting(false);
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden font-sans relative">
      {/* Global Warmth Overlay */}
      <WarmthOverlay intensity={settings.warmth} />

      {/* Loading Overlay */}
      {isImporting && (
          <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
              <Loader2 className="w-10 h-10 animate-spin text-stone-800 mb-4" />
              <p className="text-stone-600 font-serif italic">Processing book content...</p>
          </div>
      )}

      {view === 'library' && (
        <Library 
            books={books} 
            onSelectBook={handleSelectBook} 
            onImportBook={handleImportBook}
            onDeleteBook={handleDeleteBook}
        />
      )}

      {view === 'reader' && activeBook && (
        <Reader 
            book={activeBook}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBack={() => setView('library')}
            onUpdateProgress={handleUpdateProgress}
            onUpdateBook={handleUpdateBook}
        />
      )}
    </div>
  );
};

export default App;