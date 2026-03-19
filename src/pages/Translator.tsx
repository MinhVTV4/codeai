import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Languages, Bot, User, Sparkles, SlidersHorizontal, Zap, Image as ImageIcon, X, Mic, Square, Volume2, StopCircle } from 'lucide-react';

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
  imageUrl?: string;
  audioUrl?: string;
  lang?: 'vi' | 'en';
}

interface TranslatorProps {
  isReady: boolean;
}

export default function Translator({ isReady }: TranslatorProps) {
  const [temperature, setTemperature] = useState<number>(0.3);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: 'Xin chào! Tôi là trợ lý dịch thuật song ngữ Anh ↔ Việt. Hãy nhập văn bản, tải ảnh hoặc ghi âm bằng bất kỳ ngôn ngữ nào, tôi sẽ tự động nhận diện và dịch sang ngôn ngữ còn lại!',
      lang: 'vi'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speakText = (id: string, text: string, lang?: 'vi' | 'en') => {
    if (!window.speechSynthesis) {
      alert("Trình duyệt của bạn không hỗ trợ đọc văn bản.");
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*#_]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === 'en' ? 'en-US' : 'vi-VN';
    
    utterance.onstart = () => setSpeakingId(id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    window.speechSynthesis.speak(utterance);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
        
        await sendMessage('', null, null, audioBlob, audioUrl);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Không thể truy cập micro. Vui lòng kiểm tra quyền.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  const sendMessage = async (text: string, imageFile?: File | null, previewUrl?: string | null, audioBlob?: Blob, audioUrl?: string) => {
    if ((!text.trim() && !imageFile && !audioBlob) || !isReady || isLoading) return;

    const newUserMsg: Message = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      text: text || (audioBlob ? '🎤 [Đoạn ghi âm]' : ''), 
      imageUrl: previewUrl || undefined,
      audioUrl: audioUrl || undefined
    };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const model = (window as any).geminiModel;
      
      let prompt = `Bạn là một chuyên gia dịch thuật song ngữ Anh - Việt. 
Hãy phân tích dữ liệu đầu vào (văn bản, hình ảnh, hoặc âm thanh).
1. Tự động nhận diện ngôn ngữ của đầu vào (tiếng Anh hoặc tiếng Việt). Nếu là hình ảnh/âm thanh, hãy trích xuất nội dung trước.
2. Dịch nội dung đó sang ngôn ngữ còn lại.
Chỉ trả về kết quả dưới dạng JSON với 2 trường:
- "detected_lang": "en" hoặc "vi" (ngôn ngữ bạn nhận diện được)
- "translation": "..." (kết quả dịch sang ngôn ngữ kia)
Không giải thích gì thêm.`;

      const parts: any[] = [{ text: prompt }];

      if (audioBlob) {
         const base64EncodedDataPromise = new Promise<string>((resolve) => {
           const reader = new FileReader();
           reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
           reader.readAsDataURL(audioBlob);
         });
         const cleanMimeType = audioBlob.type.split(';')[0] || 'audio/webm';
         parts.push({
           inlineData: { data: await base64EncodedDataPromise, mimeType: cleanMimeType }
         });
      } else if (imageFile) {
         if (text.trim()) {
           parts.push({ text: `Ghi chú thêm của người dùng: "${text}"` });
         }
         const imagePart = await fileToGenerativePart(imageFile);
         parts.push(imagePart);
      } else {
         parts.push({ text: `Nội dung cần dịch:\n\n"${text}"` });
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: { 
          temperature,
          responseMimeType: "application/json"
        }
      });
      const responseText = result.response.text();
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        const match = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (match) {
          parsedResponse = JSON.parse(match[1]);
        } else {
          parsedResponse = { translation: responseText, detected_lang: 'en' };
        }
      }
      
      const translatedText = parsedResponse.translation || responseText;
      const detectedLang = parsedResponse.detected_lang || 'en';
      const targetLang = detectedLang === 'vi' ? 'en' : 'vi';
      
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'ai', 
        text: translatedText,
        lang: targetLang
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
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || !isReady || isLoading) return;
    const userText = input.trim();
    setInput('');
    await sendMessage(userText, selectedImage, imagePreview);
  };

  const handleQuickPhrase = async (phrase: string) => {
    if (!isReady || isLoading) return;
    await sendMessage(phrase);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600 hidden sm:block">
            <Languages size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Dịch thuật AI</h1>
            <div className="mt-1">
              <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-md text-xs font-medium text-blue-700">
                <Sparkles size={12} />
                <span>Tự động nhận diện ngôn ngữ (Anh ↔ Việt)</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isReady && (
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200" title="Điều chỉnh độ sáng tạo (Temperature)">
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
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Uploaded" className="max-w-full h-auto max-h-48 rounded-lg mb-2 object-contain bg-white/10" />
                )}
                {msg.audioUrl && (
                  <audio src={msg.audioUrl} controls className="max-w-full mb-2 h-10" />
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                
                {msg.role === 'ai' && (
                  <div className="mt-3 flex justify-start">
                    <button
                      onClick={() => speakText(msg.id, msg.text, msg.lang)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        speakingId === msg.id 
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                      title={speakingId === msg.id ? "Dừng đọc" : "Đọc văn bản"}
                    >
                      {speakingId === msg.id ? (
                        <>
                          <StopCircle size={14} className="animate-pulse" />
                          <span>Đang đọc...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={14} />
                          <span>Đọc</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
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

          {imagePreview && (
            <div className="relative inline-block mb-3">
              <img src={imagePreview} alt="Preview" className="h-20 rounded-lg border border-gray-200 object-cover" />
              <button 
                type="button" 
                onClick={() => { setSelectedImage(null); setImagePreview(null); }} 
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="relative flex items-end gap-2">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={!isReady || isLoading}
              className={`shrink-0 p-3.5 border rounded-xl transition-colors flex items-center justify-center h-[56px] w-[56px] ${
                isRecording 
                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 animate-pulse' 
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
              title={isRecording ? "Dừng ghi âm và gửi" : "Ghi âm để dịch"}
            >
              {isRecording ? <Square size={22} className="fill-red-600" /> : <Mic size={22} />}
            </button>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isReady || isLoading || isRecording}
              className="shrink-0 p-3.5 bg-gray-50 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-[56px] w-[56px]"
              title="Tải ảnh lên để dịch"
            >
              <ImageIcon size={22} />
            </button>
            <div className="relative w-full">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording 
                  ? "Đang ghi âm... Nhấn nút vuông màu đỏ để dừng và gửi." 
                  : "Nhập văn bản hoặc tải ảnh lên..."}
                className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[56px] max-h-32 ${isRecording ? 'text-red-500 font-medium bg-red-50' : ''}`}
                rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 4) : 1}
                disabled={!isReady || isLoading || isRecording}
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || !isReady || isLoading || isRecording}
                className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}
