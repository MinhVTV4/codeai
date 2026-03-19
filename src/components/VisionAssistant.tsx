import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Play, Square, Eye, AlertCircle, Loader2 } from 'lucide-react';

export default function VisionAssistant() {
  const [isStarted, setIsStarted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // 1. Get Media Stream (Camera & Mic)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 2. Setup Audio Output Context (24kHz for Gemini output)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;
      nextPlayTimeRef.current = audioCtx.currentTime;

      // 3. Setup Audio Input Context (16kHz for Gemini input)
      const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputAudioCtx;
      const source = inputAudioCtx.createMediaStreamSource(stream);
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);

      // 4. Initialize Gemini Live API
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Không tìm thấy API Key. Vui lòng cấu hình GEMINI_API_KEY.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Bạn là trợ lý dẫn đường cho người khiếm thị. Cảnh báo chướng ngại vật cực kỳ ngắn gọn dưới 5 chữ. Tông giọng bình tĩnh, dứt khoát.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
        callbacks: {
          onopen: () => {
            setIsStarted(true);
            setIsConnecting(false);
            
            // Start Audio Processing
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                let s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              const bytes = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64 = btoa(binary);

              sessionPromise.then((session) => {
                session.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(processor);
            processor.connect(inputAudioCtx.destination);

            // Start Video Processing (1 fps)
            videoIntervalRef.current = window.setInterval(() => {
              if (!videoRef.current || !canvasRef.current) return;
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              if (!ctx || video.videoWidth === 0) return;

              canvas.width = 640;
              canvas.height = (video.videoHeight / video.videoWidth) * 640;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ video: { data: base64, mimeType: 'image/jpeg' } });
              });
            }, 1000);
          },
          onmessage: (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioCtxRef.current) {
              playPCM(base64Audio, audioCtxRef.current);
            }
            if (message.serverContent?.interrupted) {
              // Clear queue if interrupted
              nextPlayTimeRef.current = audioCtxRef.current?.currentTime || 0;
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Lỗi kết nối tới AI.");
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Setup error:", err);
      setError(err.message || "Không thể khởi tạo. Vui lòng kiểm tra quyền truy cập Camera/Micro.");
      setIsConnecting(false);
      stopSession();
    }
  };

  const playPCM = (base64Data: string, audioCtx: AudioContext) => {
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const buffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      buffer.getChannelData(0).set(float32Array);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      if (nextPlayTimeRef.current < audioCtx.currentTime) {
        nextPlayTimeRef.current = audioCtx.currentTime;
      }
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;
    } catch (e) {
      console.error("Error playing audio chunk", e);
    }
  };

  const stopSession = () => {
    setIsStarted(false);
    setIsConnecting(false);
    
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }

    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(() => {});
      sessionRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto h-full">
      <div className="mb-8 text-center">
        <div className="bg-blue-100 p-4 rounded-full inline-block mb-4">
          <Eye size={48} className="text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Trợ lý Thị giác</h2>
        <p className="text-gray-600">Sử dụng Camera và Micro để nhận cảnh báo chướng ngại vật theo thời gian thực.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 w-full">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="relative w-full aspect-[3/4] bg-gray-900 rounded-2xl overflow-hidden mb-8 shadow-lg">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {!isStarted && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <p className="text-white font-medium">Camera đang tắt</p>
          </div>
        )}
        
        {isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm text-white">
            <Loader2 size={32} className="animate-spin mb-2" />
            <p className="font-medium">Đang kết nối AI...</p>
          </div>
        )}
      </div>

      <div className="w-full">
        {!isStarted ? (
          <button
            onClick={startSession}
            disabled={isConnecting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-lg shadow-md transition-colors flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                Đang khởi động...
              </>
            ) : (
              <>
                <Play size={24} />
                Bắt đầu hướng dẫn
              </>
            )}
          </button>
        ) : (
          <button
            onClick={stopSession}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-md transition-colors flex items-center justify-center gap-2 animate-pulse"
          >
            <Square size={24} className="fill-current" />
            Dừng lại
          </button>
        )}
      </div>
    </div>
  );
}
