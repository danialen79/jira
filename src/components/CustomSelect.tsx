import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  avatar?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showSearch?: boolean;
  className?: string;
  isRtl?: boolean;
  disabled?: boolean;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  showSearch = false,
  className = "",
  isRtl = false,
  disabled = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full text-slate-700 ${className}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer min-h-[38px] disabled:opacity-60 disabled:bg-slate-50 disabled:cursor-not-allowed"
      >
        <span className="truncate flex items-center gap-2">
          {selectedOption ? (
            <>
              {selectedOption.avatar && (
                <img 
                  src={selectedOption.avatar} 
                  alt="" 
                  className="w-4 h-4 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="font-medium text-slate-800">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-xs text-slate-400 font-normal">({selectedOption.sublabel})</span>
              )}
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto ${isRtl ? 'right-0' : 'left-0'}`}>
          {showSearch && (
            <div className="sticky top-0 bg-white p-2 border-b border-slate-100 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder={isRtl ? "جستجو..." : "Search..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border-none rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          )}
          <div className="py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-start transition duration-150 cursor-pointer hover:bg-slate-50 ${
                      isSelected ? 'bg-blue-50/50 text-blue-600 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      {opt.avatar && (
                        <img 
                          src={opt.avatar} 
                          alt="" 
                          className="w-4 h-4 rounded-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span>{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-slate-400 font-normal">({opt.sublabel})</span>
                      )}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">
                {isRtl ? "یافت نشد" : "No matches found"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
