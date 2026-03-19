import React, { useState, useEffect } from 'react';
import { Menu, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Translator from './pages/Translator';
import ImageAnalyzer from './pages/ImageAnalyzer';
import ImageDescriber from './pages/ImageDescriber';

export default function App() {
  const [currentApp, setCurrentApp] = useState('translator');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already initialized in window (from index.html script)
    if ((window as any).geminiModel) {
      setIsReady(true);
    } else if ((window as any).geminiInitError) {
      setError((window as any).geminiInitError.message);
    }

    // Listen for initialization events
    const handleReady = () => setIsReady(true);
    const handleError = () => setError((window as any).geminiInitError?.message || 'Lỗi khởi tạo AI');
    
    window.addEventListener('gemini-ready', handleReady);
    window.addEventListener('gemini-error', handleError);
    
    return () => {
      window.removeEventListener('gemini-ready', handleReady);
      window.removeEventListener('gemini-error', handleError);
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar 
        currentApp={currentApp} 
        setCurrentApp={setCurrentApp} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header for Sidebar Toggle */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-blue-600">
            <Sparkles size={20} />
            <span className="text-lg font-bold text-gray-800">AI Studio</span>
          </div>
          <div className="flex items-center gap-3">
            {error ? (
              <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <AlertCircle size={14} /> Lỗi
              </span>
            ) : isReady ? (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                <Sparkles size={14} /> Sẵn sàng
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                <Loader2 size={14} className="animate-spin" /> Đang tải...
              </span>
            )}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>

        {/* Global Status Bar (Desktop) */}
        <div className="hidden md:flex bg-white border-b border-gray-200 px-6 py-2 items-center justify-end shrink-0">
          {error ? (
            <span className="flex items-center gap-1 text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full">
              <AlertCircle size={16} /> Lỗi kết nối AI
            </span>
          ) : isReady ? (
            <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
              <Sparkles size={16} /> AI Sẵn sàng
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
              <Loader2 size={16} className="animate-spin" /> Đang khởi tạo AI...
            </span>
          )}
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative">
          {currentApp === 'translator' && <Translator isReady={isReady} />}
          {currentApp === 'analyzer' && <ImageAnalyzer isReady={isReady} />}
          {currentApp === 'describer' && <ImageDescriber isReady={isReady} />}
        </main>
      </div>
    </div>
  );
}
