import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Languages, AlertCircle, Bot, User, Sparkles, ArrowRightLeft, SlidersHorizontal, Zap } from 'lucide-react';

const QUICK_PHRASES = [
  { icon: '👋', text: 'Xin chào, bạn khỏe không?' },
  { icon: '🤝', text: 'Rất vui được gặp bạn.' },
  { icon: '🗺️', text: 'Xin lỗi, nhà vệ sinh ở đâu?' },
  { icon: '🚕', text: 'Làm sao để đi đến sân bay?' },
  { icon: '💰', text: 'Cái này giá bao nhiêu?' },
  { icon: '🍽️', text: 'Cho tôi xem thực đơn nhé.' },
  { icon: '🗣️', text: 'Bạn có thể nói chậm lại được không?' },
];

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'en-vi' | 'vi-en'>('en-vi');
  const [temperature, setTemperature] = useState<number>(0.3);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: 'Xin chào! Tôi là trợ lý dịch thuật Tiếng Anh sang Tiếng Việt. Hãy nhập câu Tiếng Anh bạn muốn dịch nhé!'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleMode = () => {
    setMode(prev => {
      const newMode = prev === 'en-vi' ? 'vi-en' : 'en-vi';
      setMessages(msgs => [...msgs, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: newMode === 'en-vi' 
          ? '🔄 Đã chuyển sang chế độ dịch: **Tiếng Anh ➔ Tiếng Việt**. Hãy nhập câu Tiếng Anh!' 
          : '🔄 Đã chuyển sang chế độ dịch: **Tiếng Việt ➔ Tiếng Anh**. Hãy nhập câu Tiếng Việt!'
      }]);
      return newMode;
    });
  };

  const sendMessage = async (text: string, translationMode: 'en-vi' | 'vi-en') => {
    if (!text.trim() || !isReady || isLoading) return;

    const newUserMsg: Message = { id: crypto.randomUUID(), role: 'user', text };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const model = (window as any).geminiModel;
      
      const prompt = translationMode === 'en-vi'
        ? `Bạn là một chuyên gia dịch thuật. Hãy dịch đoạn văn bản Tiếng Anh sau sang Tiếng Việt một cách tự nhiên, chính xác và giữ nguyên ngữ cảnh. Chỉ trả về kết quả dịch, không giải thích gì thêm:\n\n"${text}"`
        : `Bạn là một chuyên gia dịch thuật. Hãy dịch đoạn văn bản Tiếng Việt sau sang Tiếng Anh một cách tự nhiên, chính xác và giữ nguyên ngữ cảnh. Chỉ trả về kết quả dịch, không giải thích gì thêm:\n\n"${text}"`;
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature }
      });
      const responseText = result.response.text();
      
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'ai', 
        text: responseText 
      }]);
    } catch (err: any) {
      console.error("Translation error:", err);
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'ai', 
        text: `Lỗi: ${err.message || 'Không thể kết nối tới AI. Vui lòng thử lại.'}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !isReady || isLoading) return;
    const userText = input.trim();
    setInput('');
    await sendMessage(userText, mode);
  };

  const handleQuickPhrase = async (phrase: string) => {
    if (!isReady || isLoading) return;
    if (mode !== 'vi-en') {
      setMode('vi-en');
      setMessages(msgs => [...msgs, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: '🔄 Đã tự động chuyển sang chế độ dịch: **Tiếng Việt ➔ Tiếng Anh**.'
      }]);
    }
    await sendMessage(phrase, 'vi-en');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
            <Languages size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">AI Translator</h1>
            <div className="mt-1">
              <button 
                onClick={toggleMode}
                className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-600 transition-colors"
                title="Nhấn để đổi chiều dịch"
              >
                <span className={mode === 'en-vi' ? 'text-blue-600 font-bold' : ''}>English</span>
                <ArrowRightLeft size={12} className="text-gray-400" />
                <span className={mode === 'vi-en' ? 'text-blue-600 font-bold' : ''}>Vietnamese</span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isReady && !error && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200" title="Điều chỉnh độ sáng tạo (Temperature)">
              <SlidersHorizontal size={14} />
              <span className="font-medium">Sáng tạo:</span>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-20 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="w-5 text-right text-xs font-bold text-blue-600">{temperature.toFixed(1)}</span>
            </div>
          )}
          {error ? (
            <span className="flex items-center gap-1 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
              <AlertCircle size={16} /> Lỗi kết nối
            </span>
          ) : isReady ? (
            <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
              <Sparkles size={16} /> Sẵn sàng
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
              <Loader2 size={16} className="animate-spin" /> Đang khởi tạo...
            </span>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 w-full max-w-4xl mx-auto">
        <div className="flex flex-col gap-6">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'
              }`}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4 flex-row">
              <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-2">
                <Loader2 size={18} className="animate-spin text-emerald-500" />
                <span className="text-gray-500 text-sm animate-pulse">Đang dịch...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 p-4 sm:p-6 shrink-0">
        <div className="max-w-4xl mx-auto relative">
          {/* Quick Phrases */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
              <Zap size={14} className="fill-blue-600" />
              Mẫu câu:
            </div>
            {QUICK_PHRASES.map((phrase, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPhrase(phrase.text)}
                disabled={!isReady || isLoading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-full text-sm text-gray-700 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{phrase.icon}</span>
                <span>{phrase.text}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSend} className="relative flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'en-vi' 
                ? "Nhập tiếng Anh cần dịch... (Enter để gửi, Shift+Enter để xuống dòng)" 
                : "Nhập tiếng Việt cần dịch... (Enter để gửi, Shift+Enter để xuống dòng)"}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[56px] max-h-32"
              rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 4) : 1}
              disabled={!isReady || isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || !isReady || isLoading}
              className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="text-center mt-2">
            <p className="text-xs text-gray-400">Sử dụng mô hình Gemini 3.1 Flash Lite thông qua Firebase AI SDK</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
