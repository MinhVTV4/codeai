import React, { useState, useRef } from 'react';
import { Upload, MessageSquareText, Loader2, Image as ImageIcon, X, Sparkles } from 'lucide-react';

interface ImageDescriberProps {
  isReady: boolean;
}

export default function ImageDescriber({ isReady }: ImageDescriberProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setResult(null);
        setError(null);
      };
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

  const handleDescribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage || !isReady || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const model = (window as any).geminiModel;
      
      const userFocus = prompt.trim() ? `\nNgười dùng muốn tập trung vào: "${prompt}"` : '';
      const systemPrompt = `Hãy đóng vai một người quan sát tỉ mỉ và mô tả bức ảnh này một cách chi tiết nhất có thể. 
Đặc biệt chú ý đến không gian và vị trí tương đối của các vật thể (ví dụ: bên trái, bên phải, phía trên, phía dưới, dưới gốc cây, đằng xa, tiền cảnh...). 
Miêu tả cả màu sắc, trạng thái, và hành động (nếu có) của các đối tượng để người đọc có thể hình dung rõ ràng khung cảnh.${userFocus}`;

      const imagePart = await fileToGenerativePart(selectedImage);
      
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }, imagePart] }],
        generationConfig: { 
          temperature: 0.4, // Slightly higher for more natural, descriptive text
        }
      });
      
      const responseText = response.response.text();
      setResult(responseText);

    } catch (err: any) {
      console.error("Description error:", err);
      setError(err.message || "Đã xảy ra lỗi khi mô tả hình ảnh.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-purple-100 p-2 rounded-lg text-purple-600 hidden sm:block">
            <MessageSquareText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Mô tả Ảnh Chi tiết</h1>
            <p className="text-sm text-gray-500 mt-0.5">Phân tích không gian, vị trí và bối cảnh của bức ảnh</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
        {/* Upload & Prompt Area */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleDescribe} className="flex flex-col gap-4">
            
            {/* Image Upload/Preview */}
            <div className="flex flex-col items-center justify-center w-full">
              {!imagePreview ? (
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 text-gray-400 mb-3" />
                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Nhấn để tải ảnh lên</span> hoặc kéo thả</p>
                    <p className="text-xs text-gray-400">PNG, JPG, WEBP</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleImageChange} />
                </label>
              ) : (
                <div className="relative w-full flex justify-center bg-gray-100 rounded-xl p-4 border border-gray-200">
                  <button 
                    type="button" 
                    onClick={() => { setSelectedImage(null); setImagePreview(null); setResult(null); setError(null); }} 
                    className="absolute top-2 right-2 bg-white text-gray-600 rounded-full p-1.5 hover:bg-red-50 hover:text-red-600 shadow-sm transition-colors z-10"
                    title="Xóa ảnh"
                  >
                    <X size={18} />
                  </button>
                  
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="max-w-full h-auto max-h-[40vh] object-contain rounded-lg shadow-sm" 
                  />
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MessageSquareText className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Bạn muốn tập trung vào chi tiết nào? (Để trống để mô tả toàn cảnh)"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  disabled={!isReady || isLoading || !selectedImage}
                />
              </div>
              <button
                type="submit"
                disabled={!isReady || isLoading || !selectedImage}
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang phân tích...</span>
                  </>
                ) : (
                  <span>Mô tả ảnh</span>
                )}
              </button>
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Result Area */}
        {result && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Sparkles className="text-purple-500" size={20} />
              Chi tiết bức ảnh
            </h3>
            <div className="prose prose-purple max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {result}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
