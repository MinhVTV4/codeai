import React, { useState, useRef } from 'react';
import { Upload, ScanSearch, Loader2, Image as ImageIcon, X } from 'lucide-react';

interface BoundingBox {
  name: string;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
}

interface ImageAnalyzerProps {
  isReady: boolean;
}

export default function ImageAnalyzer({ isReady }: ImageAnalyzerProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<BoundingBox[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setResults([]); // Clear previous results
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

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage || !prompt.trim() || !isReady || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const model = (window as any).geminiModel;
      
      const systemPrompt = `Bạn là một chuyên gia phân tích hình ảnh. Hãy tìm các vật thể theo yêu cầu: "${prompt}". 
Trả về kết quả dưới dạng JSON với cấu trúc chính xác như sau:
{"objects": [{"name": "Tên vật thể", "box": [ymin, xmin, ymax, xmax]}]}
Tọa độ box phải nằm trong khoảng từ 0 đến 1000. Nếu không tìm thấy vật thể nào, hãy trả về {"objects": []}. Không giải thích gì thêm.`;

      const imagePart = await fileToGenerativePart(selectedImage);
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }, imagePart] }],
        generationConfig: { 
          temperature: 0.1, // Low temperature for more deterministic bounding boxes
          responseMimeType: "application/json"
        }
      });
      
      const responseText = result.response.text();
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (err) {
        const match = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (match) {
          parsedResponse = JSON.parse(match[1]);
        } else {
          throw new Error("Không thể đọc kết quả từ AI.");
        }
      }

      if (parsedResponse.objects && Array.isArray(parsedResponse.objects)) {
        setResults(parsedResponse.objects);
        if (parsedResponse.objects.length === 0) {
          setError("Không tìm thấy vật thể nào khớp với yêu cầu.");
        }
      } else {
        throw new Error("Định dạng dữ liệu trả về không hợp lệ.");
      }

    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Đã xảy ra lỗi khi phân tích hình ảnh.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 hidden sm:block">
            <ScanSearch size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Phân tích Ảnh & Nhận diện</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tìm kiếm và đóng khung vật thể trong ảnh</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
        {/* Upload & Prompt Area */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleAnalyze} className="flex flex-col gap-4">
            
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
                    onClick={() => { setSelectedImage(null); setImagePreview(null); setResults([]); setError(null); }} 
                    className="absolute top-2 right-2 bg-white text-gray-600 rounded-full p-1.5 hover:bg-red-50 hover:text-red-600 shadow-sm transition-colors z-10"
                    title="Xóa ảnh"
                  >
                    <X size={18} />
                  </button>
                  
                  {/* Image with Bounding Boxes */}
                  <div className="relative inline-block max-w-full">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-w-full h-auto max-h-[50vh] object-contain rounded-lg shadow-sm" 
                    />
                    
                    {/* Render Bounding Boxes */}
                    {results.map((res, idx) => {
                      const [ymin, xmin, ymax, xmax] = res.box;
                      const top = `${(ymin / 1000) * 100}%`;
                      const left = `${(xmin / 1000) * 100}%`;
                      const height = `${((ymax - ymin) / 1000) * 100}%`;
                      const width = `${((xmax - xmin) / 1000) * 100}%`;

                      return (
                        <div 
                          key={idx}
                          style={{ top, left, height, width }}
                          className="absolute border-2 border-emerald-500 bg-emerald-500/20 pointer-events-none"
                        >
                          <span className="absolute -top-6 left-[-2px] bg-emerald-500 text-white text-xs font-medium px-2 py-1 rounded-t-md whitespace-nowrap shadow-sm">
                            {res.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ScanSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Bạn muốn tìm gì trong ảnh? (VD: Tìm tất cả ô tô, con mèo ở đâu...)"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                  disabled={!isReady || isLoading || !selectedImage}
                />
              </div>
              <button
                type="submit"
                disabled={!isReady || isLoading || !selectedImage || !prompt.trim()}
                className="px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang quét...</span>
                  </>
                ) : (
                  <span>Phân tích</span>
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

        {/* Results List */}
        {results.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ImageIcon className="text-emerald-500" size={20} />
              Đã tìm thấy {results.length} vật thể
            </h3>
            <div className="flex flex-wrap gap-2">
              {results.map((res, idx) => (
                <div key={idx} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium">
                  {res.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
