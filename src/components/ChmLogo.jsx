import React from 'react';
import { Droplets } from 'lucide-react';

export default function ChmLogo({ size = 40 }) {
  return (
    <div className={`relative flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 shadow-xl overflow-hidden`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 opacity-30">
        <svg viewBox="0 0 100 100" className="w-full h-full stroke-cyan-400 fill-none stroke-[1]">
          <path d="M50,50 L50,10 M50,50 L90,50 M50,50 L10,50 M50,50 L50,90 M10,10 L30,30 M90,10 L70,30 M10,90 L30,70 M90,90 L70,70" />
          <circle cx="50" cy="50" r="15" className="fill-slate-800 stroke-cyan-500" />
          <circle cx="50" cy="50" r="40" className="stroke-cyan-500 stroke-[0.5] opacity-50" />
        </svg>
      </div>
      <Droplets size={size * 0.5} className="text-cyan-400 relative z-10 fill-slate-900/80" />
    </div>
  );
}
