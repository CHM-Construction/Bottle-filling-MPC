import React from 'react';
import ChmLogo from './ChmLogo';

export default function LoginScreen({ onLogin }) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-800 border-2 border-slate-700 shadow-2xl p-8 rounded-2xl flex flex-col items-center text-center relative overflow-hidden">
          <div className="p-4 bg-slate-900 rounded-full mb-6 border-2 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse">
            <ChmLogo size={80} />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">CHM LIQUID DYNAMICS</h2>
          <div className="h-1 w-24 bg-cyan-500 rounded-full mb-3"></div>
          <p className="text-xs text-cyan-400 mb-2 font-bold tracking-widest uppercase">Cascade IMC V6.1</p>
          <p className="text-sm text-slate-400 italic font-medium mb-6">"Feedforward Precision Under Pressure."</p>
          <button onClick={onLogin} className="w-full py-4 bg-cyan-600 text-white font-bold rounded-lg shadow-lg hover:bg-cyan-500 mt-6 transition-transform active:scale-95">Initialize Factory Interface</button>
        </div>
      </div>
    );
}
