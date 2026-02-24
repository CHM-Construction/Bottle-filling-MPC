import React from 'react';
import { Settings2, Cpu, Zap, Activity } from 'lucide-react';

export default function TuningPanel({ uiState, setTuning, setTuningMode }) {
    const { tuning, tuningMode } = uiState;
    const isAuto = tuningMode === 'AUTO';

    const handleSlider = (key, val) => {
        if (isAuto) return;
        setTuning(key, parseFloat(val));
    };

    const ParameterCard = ({ paramKey, title, desc, min, max, step, unit = "" }) => (
        <div className={`p-4 rounded-xl border ${isAuto ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-blue-200 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h4 className="text-xs font-bold text-slate-700">{title}</h4>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wide">{desc}</p>
                </div>
                <div className="text-sm font-mono font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {tuning[paramKey].toFixed(2)}{unit}
                </div>
            </div>
            <input 
                type="range" min={min} max={max} step={step} 
                value={tuning[paramKey]} 
                onChange={(e) => handleSlider(paramKey, e.target.value)}
                disabled={isAuto}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-2"
            />
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto flex flex-col gap-6 h-full pb-10">
            <div className="bg-slate-900 p-6 rounded-2xl shadow-xl flex items-center justify-between border border-slate-700">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${isAuto ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-amber-500/20 text-amber-400'}`}>
                        <Cpu size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-wide">MPC PARAMETER ESTIMATION</h2>
                        <p className="text-xs text-slate-400">Modify internal FOPDT (First-Order Plus Dead Time) variables.</p>
                    </div>
                </div>
                <div className="flex items-center bg-slate-800 p-1.5 rounded-lg border border-slate-700">
                    <button 
                        onClick={() => setTuningMode('MANUAL')} 
                        className={`px-6 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${!isAuto ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Settings2 size={16} /> MANUAL OVERRIDE
                    </button>
                    <button 
                        onClick={() => setTuningMode('AUTO')} 
                        className={`px-6 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${isAuto ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Zap size={16} /> ADAPTIVE AUTO-TUNE
                    </button>
                </div>
            </div>

            {isAuto && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800">
                    <Activity size={24} className="animate-spin" />
                    <div>
                        <p className="font-bold">Adaptive Tuning is Active</p>
                        <p className="text-xs opacity-80">The Recursive Least Squares algorithm is actively estimating plant parameters and restoring ideal conditions to prevent drift.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ParameterCard paramKey="tau_11" title="Valve 1 Time Constant (τ11)" desc="How fast V1 reaches full flow" min="0.05" max="1.5" step="0.05" unit="s" />
                <ParameterCard paramKey="tau_22" title="Valve 2 Time Constant (τ22)" desc="How fast V2 reaches full flow" min="0.05" max="1.5" step="0.05" unit="s" />
                <ParameterCard paramKey="gain_s1" title="Valve 1 Static Gain (K11)" desc="Flow output per % opening" min="0.1" max="2.0" step="0.1" />
                
                <ParameterCard paramKey="coupling" title="RGA Coupling Interaction (K21)" desc="V1 pressure wave effect on V2" min="-0.8" max="0.0" step="0.05" />
                <ParameterCard paramKey="dt_21" title="Coupling Dead-Time (θ)" desc="Pipe travel delay between valves" min="0.1" max="2.0" step="0.1" unit="s" />
                <ParameterCard paramKey="imcLambda" title="Controller Lambda (λ)" desc="Aggressiveness / Penalty" min="0.01" max="1.0" step="0.01" />
            </div>
        </div>
    );
}
