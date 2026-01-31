import React, { useState } from 'react';
import { Plus, LayoutGrid, List as ListIcon, Search, Cloud, Book as BookIcon, X, User, LogOut } from 'lucide-react';
import { Book, ViewMode } from '../types';
import { cn } from '../utils';

interface LibraryProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onImportBook: (file: File) => void;
  onDeleteBook: (bookId: string) => void;
  user?: any;
  onLogin?: () => void;
  onLogout?: () => void;
}

export const Library: React.FC<LibraryProps> = ({ books, onSelectBook, onImportBook, onDeleteBook, user, onLogin, onLogout }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportBook(e.target.files[0]);
    }
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] pb-20 font-serif">
      {/* 1. Top Navigation Bar */}
      <header className="sticky top-0 z-10 bg-[#F5F5F5]/95 backdrop-blur-sm h-14 border-b-[0.5px] border-[#D1D1D1] flex justify-between items-center px-4">
        
        {/* Left: Layout Toggle */}
        <button 
            onClick={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
            className="p-2 -ml-2 text-[#1A1A1A] active:opacity-50"
        >
            {viewMode === 'grid' ? <ListIcon size={20} strokeWidth={1.5} /> : <LayoutGrid size={20} strokeWidth={1.5} />}
        </button>

        {/* Center: Title */}
        <div className="font-sans text-sm font-medium tracking-wide uppercase text-[#1A1A1A]">My Library</div>

        {/* Right: Actions */}
        <div className="flex gap-1 -mr-2 items-center">
             <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={cn("p-2 text-[#1A1A1A] active:opacity-50 transition-colors", isSearchOpen && "bg-stone-200")}
             >
                <Search size={20} strokeWidth={1.5} />
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#1A1A1A] active:opacity-50"
            >
                <Plus size={20} strokeWidth={1.5} />
            </button>
            
            {/* User / Login Button */}
            <div className="ml-1 pl-1 border-l border-stone-300">
                {user ? (
                     <button 
                        onClick={() => { if(window.confirm('Log out?')) onLogout?.(); }}
                        className="p-1.5 rounded-full hover:bg-stone-200 transition-colors relative group"
                        title="Sign Out"
                     >
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full border border-stone-300" />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-stone-300 flex items-center justify-center text-[10px] font-bold">
                                {user.displayName ? user.displayName[0] : 'U'}
                            </div>
                        )}
                        <div className="absolute top-full right-0 mt-2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            Log out
                        </div>
                     </button>
                ) : (
                    <button 
                        onClick={onLogin}
                        className="p-2 text-[#1A1A1A] active:opacity-50"
                        title="Sign In to Sync"
                    >
                        <User size={20} strokeWidth={1.5} />
                    </button>
                )}
            </div>
        </div>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".txt,.md,.epub,.pdf,application/pdf"
        />
      </header>

      {/* 2. Expandable Search Bar */}
      {isSearchOpen && (
        <div className="px-4 py-3 bg-[#F5F5F5] border-b-[0.5px] border-[#D1D1D1] animate-in slide-in-from-top-2 fade-in">
            <input 
                autoFocus
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-[0.5px] border-[#D1D1D1] px-3 py-2 text-sm outline-none focus:border-[#1A1A1A] placeholder:text-stone-400 placeholder:italic font-sans"
            />
        </div>
      )}

      {/* 3. Book List/Grid */}
      <div className={cn(
        "p-4 gap-6",
        viewMode === 'grid' ? "grid grid-cols-3 gap-y-8 gap-x-4" : "flex flex-col gap-0"
      )}>
        {filteredBooks.map((book) => (
          <div 
            key={book.id} 
            onClick={() => onSelectBook(book)}
            className={cn(
                "group relative cursor-pointer active:opacity-80 transition-opacity",
                viewMode === 'list' && "flex gap-4 items-center border-b-[0.5px] border-[#D1D1D1] py-3 last:border-0"
            )}
          >
            {/* Cover */}
            <div className={cn(
                "bg-white border-[0.5px] border-[#D1D1D1] relative overflow-hidden shrink-0 group",
                viewMode === 'grid' ? "aspect-[2/3] w-full mb-2 shadow-sm" : "w-12 h-16"
            )}>
              {book.coverUrl ? (
                <img 
                    src={book.coverUrl} 
                    alt={book.title} 
                    className="w-full h-full object-cover grayscale contrast-125 hover:grayscale-0 transition-all duration-700" 
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAFAFA] p-1 text-center">
                    <BookIcon className="text-[#E0E0E0]" size={viewMode === 'grid' ? 24 : 16} strokeWidth={1} />
                </div>
              )}

              {/* Low Profile Delete Button (X) */}
              <button 
                onClick={(e) => {
                    e.stopPropagation();
                    if(window.confirm(`Delete "${book.title}"?`)) {
                        onDeleteBook(book.id);
                    }
                }}
                className={cn(
                    "absolute top-0 right-0 p-2 text-stone-400 hover:text-[#1A1A1A] z-10 opacity-0 group-hover:opacity-100 transition-opacity",
                    viewMode === 'list' && "hidden"
                )}
              >
                  <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Meta */}
            <div className="flex-1 min-w-0 relative">
              <h3 className={cn(
                  "font-sans text-[#1A1A1A] leading-tight truncate",
                  viewMode === 'grid' ? "text-xs font-medium text-center" : "text-sm font-medium"
              )}>{book.title}</h3>
              
              {viewMode === 'list' && (
                 <p className="text-xs text-stone-500 mt-1 italic font-serif truncate">{book.author}</p>
              )}

              <div className={cn(
                  "text-[10px] text-stone-400 font-sans mt-1",
                   viewMode === 'grid' ? "text-center" : ""
              )}>
                 {Math.round(book.progress * 100)}%
              </div>
              
              {/* List view delete button */}
              {viewMode === 'list' && (
                  <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if(window.confirm(`Delete "${book.title}"?`)) {
                            onDeleteBook(book.id);
                        }
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-stone-300 hover:text-[#1A1A1A]"
                  >
                      <X size={16} />
                  </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {filteredBooks.length === 0 && (
        <div className="flex flex-col items-center justify-center mt-32 text-stone-400">
            <Cloud size={40} className="mb-4 opacity-20" strokeWidth={1} />
            <p className="font-serif italic text-sm">No books found.</p>
        </div>
      )}
    </div>
  );
};