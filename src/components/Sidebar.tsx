import React from 'react';
import { Languages, ScanSearch, Menu, X, Sparkles, MessageSquareText } from 'lucide-react';

interface SidebarProps {
  currentApp: string;
  setCurrentApp: (app: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ currentApp, setCurrentApp, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: 'translator', icon: Languages, label: 'Dịch thuật AI' },
    { id: 'analyzer', icon: ScanSearch, label: 'Đếm & Tìm Vật thể' },
    { id: 'describer', icon: MessageSquareText, label: 'Mô tả Không gian' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <Sparkles size={24} />
            <span className="text-xl font-bold text-gray-800">AI Studio</span>
          </div>
          <button 
            className="md:hidden p-1 text-gray-500 hover:bg-gray-100 rounded-md"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentApp === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentApp(item.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <Icon size={20} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-400 text-center">
            Powered by Gemini 3.1 Flash Lite
          </div>
        </div>
      </aside>
    </>
  );
}
