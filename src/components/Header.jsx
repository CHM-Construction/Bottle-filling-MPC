import React from 'react';
import { Activity, BarChart3, Play, Pause, SkipForward, Snowflake, Droplets, Droplet, Cable, Thermometer, AlertOctagon, Sliders } from 'lucide-react';
import ChmLogo from './ChmLogo';
import { RECIPES, PRODUCTS } from '../utils/constants';

export default function Header({ activeTab, setActiveTab, handleRecipeSelect, handleProductSelect, setConfig, triggerEStop, uiState, handleStep, handleCIPToggle }) {
    return (
      <header className="h-16 bg-slate-900 px-4 flex items-center justify-between shrink-0 shadow-md z-30 border-b border-slate-700 overflow-hidden">
        <div className="flex items-center gap-4 shrink-0 mr-4">
          <div className="flex items-center gap-3"><ChmLogo size={32} /><div className="hidden md:block"><h1 className="font-black text-sm tracking-wider text-white">CHM AUTOMATION</h1><p className="text-[10px] text-cyan-400 font-mono">BEVERAGE DIVISION <span className="text-slate-500">| CASCADE IMC V6.1</span></p></div></div>
          <div className="h-8 w-px bg-slate-700 hidden md:block"></div>
        </div>
        
        <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade pr-2">
          {/* MAIN TABS */}
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shrink-0 gap-1">
               <button onClick={() => setActiveTab('CONTROL')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'CONTROL' ? 'bg-cyan-900 text-cyan-300 border border-cyan-700 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Activity size={14}/> PROCESS HMI</button>
               <button onClick={() => setActiveTab('DATA')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'DATA' ? 'bg-cyan-900 text-cyan-300 border border-cyan-700 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><BarChart3 size={14}/> HISTORIAN {uiState.cloudQueueSize > 0 && <span className="bg-amber-500 text-black text-[9px] px-1.5 rounded-full">{uiState.cloudQueueSize}</span>}</button>
               <button onClick={() => setActiveTab('TUNING')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'TUNING' ? 'bg-cyan-900 text-cyan-300 border border-cyan-700 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Sliders size={14}/> ADAPTIVE TUNING</button>
          </div>

          <div className="h-8 w-px bg-slate-700 hidden md:block shrink-0"></div>
          
          {/* SIMULATION CONTROLS */}
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shrink-0 items-center gap-1 ml-2">
              <button onClick={() => setConfig('simMode', 'RUN')} className={`p-1.5 rounded ${uiState.simMode === 'RUN' ? 'bg-slate-900 text-emerald-400 shadow' : 'text-slate-500 hover:bg-slate-700'}`} title="Run"><Play size={14}/></button>
              <button onClick={() => setConfig('simMode', 'PAUSE')} className={`p-1.5 rounded ${uiState.simMode === 'PAUSE' ? 'bg-slate-900 text-amber-400 shadow' : 'text-slate-500 hover:bg-slate-700'}`} title="Pause"><Pause size={14}/></button>
              <button onClick={handleStep} disabled={uiState.simMode === 'RUN'} className="p-1.5 rounded text-slate-500 hover:bg-slate-700 hover:text-cyan-400 disabled:opacity-30" title="Step Container"><SkipForward size={14}/></button>
              <div className="w-px h-4 bg-slate-600 mx-1"></div>
              <button onClick={() => setConfig('trendFrozen', !uiState.trendFrozen)} className={`p-1.5 rounded ${uiState.trendFrozen ? 'bg-cyan-900/50 text-cyan-400 ring-1 ring-cyan-700' : 'text-slate-500 hover:bg-slate-700'}`} title="Freeze Trend"><Snowflake size={14}/></button>
          </div>

          {/* DYNAMIC TAB CONTROLS */}
          {activeTab === 'CONTROL' && (
            <>
            <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-700 shrink-0 ml-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase px-2 flex items-center gap-1"><Droplets size={12}/> Vol:</span>
                {RECIPES.map(r => (<button key={r} onClick={() => handleRecipeSelect(r)} className={`px-3 py-1 text-[10px] font-bold rounded transition-colors whitespace-nowrap ${Math.abs(uiState.baseRecipeVol - r) < 0.001 ? 'bg-cyan-900 text-cyan-300 border border-cyan-700' : 'text-slate-500 hover:bg-slate-700 hover:text-white'}`}>{r < 1 ? (r*1000).toFixed(0)+'ml' : r.toFixed(1)+'L'}</button>))}
            </div>
            <div className="flex items-center gap-1 bg-slate-800 p-1.5 rounded-lg border border-slate-700 shrink-0 ml-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase px-2"><Droplet size={12}/> Fluid:</span>
                {PRODUCTS.map(p => (
                    <button key={p.id} onClick={() => handleProductSelect(p)} className={`px-2 py-1 text-[9px] font-bold rounded transition-colors whitespace-nowrap ${uiState.activeProduct.id === p.id ? 'bg-emerald-900 text-emerald-300 border border-emerald-700' : 'text-slate-500 hover:bg-slate-700 hover:text-white'}`}>{p.name}</button>
                ))}
            </div>
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shrink-0 ml-2">
                <button onClick={() => setConfig('opMode', 'MANUAL')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${uiState.opMode === 'MANUAL' ? 'bg-cyan-900 text-cyan-300 shadow-sm border border-cyan-700' : 'text-slate-500 hover:text-white'}`}>MANUAL</button>
                <button onClick={() => setConfig('opMode', 'AUTO')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${uiState.opMode === 'AUTO' ? 'bg-cyan-900 text-cyan-300 shadow-sm border border-cyan-700' : 'text-slate-500 hover:text-white'}`}>CASCADE IMC</button>
            </div>
            {uiState.opMode === 'AUTO' && (
                <button onClick={() => setConfig('decouplerActive', !uiState.decouplerActive)} className={`px-2 py-1 text-[9px] font-bold rounded flex items-center gap-1 border transition-colors ml-2 ${uiState.decouplerActive ? 'bg-indigo-900 text-indigo-300 border-indigo-700 shadow-[0_0_10px_rgba(79,70,229,0.3)]' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-white'}`} title="MIMO RGA Decoupling">
                    <Cable size={12}/> DECOUPLER
                </button>
            )}
            </>
          )}
        </div>

        <div className="hidden lg:flex flex-col items-end shrink-0 pl-4 border-l border-slate-700 ml-2 gap-1">
             <div className="flex items-center gap-2">
                 <button onClick={handleCIPToggle} className={`px-2 py-1 text-[9px] font-bold rounded flex items-center gap-1 border transition-colors ${uiState.cipMode ? 'bg-amber-900 text-amber-400 border-amber-700 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}><Thermometer size={12}/> CIP</button>
                 <button onClick={triggerEStop} className={`px-3 py-1 text-[10px] font-bold rounded border flex items-center gap-1 ${uiState.eStopActive ? 'bg-rose-600 text-white border-rose-700 animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.5)]' : 'bg-red-900/30 text-red-400 border-red-900 hover:bg-red-900/50'}`}>
                   <AlertOctagon size={12}/> {uiState.eStopActive ? 'RELEASE E-STOP' : 'E-STOP'}
                 </button>
             </div>
             <div className="text-[8px] font-mono text-slate-500 flex gap-2">
                 <span>THERMAL FFWD: <span className="text-emerald-400 font-bold">ACTIVE</span></span> | <span>IMC BIAS: <span className="text-amber-400 font-bold">ALIGNED</span></span>
             </div>
        </div>
      </header>
    );
}
