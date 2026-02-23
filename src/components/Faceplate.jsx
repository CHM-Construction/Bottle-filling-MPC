import React from 'react';
import { Power, Plus, Minus, Cpu, Thermometer, RefreshCw } from 'lucide-react';
import { ADC_MAX_COUNTS, ADC_ZERO_OFFSET } from '../utils/constants';

export default function Faceplate({ tag, title, subtitle, val, massVal, sp, mv, actualMv, unit, accent, master, onChange, readOnly, onAdjust, silState, nominal, pred, load, onLoadChange, isActive, onToggle, biasVal, imcBias, onDriftSim, isTemp, dynamicSG, hotVol }) {
  const isFrozen = silState === 'MPC_LOST';
  const isInactive = isActive === false;
  const isTempAlarm = isTemp && Math.abs(val - sp) >= 3.0;

  const accentColorClass = accent === 'blue' ? 'bg-blue-600' : accent === 'fuchsia' ? 'bg-fuchsia-600' : accent === 'amber' ? 'bg-amber-500' : 'bg-slate-900';
  const inputAccentClass = accent === 'blue' ? 'accent-blue-600' : accent === 'fuchsia' ? 'accent-fuchsia-600' : accent === 'amber' ? 'accent-amber-500' : 'accent-slate-600';

  const rawCounts = massVal !== undefined ? Math.max(0, Math.min(ADC_MAX_COUNTS, ADC_ZERO_OFFSET + Math.floor((massVal) * 2000000))) : null; 
  const hexCode = rawCounts !== null ? `0x${rawCounts.toString(16).toUpperCase().padStart(6, '0')}` : null;

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden shrink-0 transition-all ${isFrozen ? 'border-rose-200 bg-rose-50/10' : (isInactive ? 'opacity-50 grayscale border-slate-100' : (isTempAlarm ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'border-slate-200'))}`}>
       <div className="p-3">
          <div className="flex justify-between items-start mb-1">
             <div className="flex items-center gap-2">
                {onToggle && !master && !isTemp && <button onClick={onToggle} className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Power size={12} className={isActive ? "fill-current" : ""} /></button>}
                <div>
                   <h3 className="font-bold text-slate-700 text-sm flex items-center gap-1">
                      {isTemp && <Thermometer size={14} className={isTempAlarm ? 'text-amber-500 animate-pulse' : 'text-rose-500'} />}
                      {title}
                   </h3>
                   <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-tight">{subtitle}</p>
                </div>
             </div>
             {master ? <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1"><Cpu size={10} /> MASTER</span> : <div className={`w-2 h-2 rounded-full ${isFrozen ? 'bg-rose-500' : 'bg-green-500 animate-pulse'}`}></div>}
          </div>
          <div className="flex items-baseline justify-between mt-2">
             <div className="flex items-baseline gap-1"><span id={`val-${tag}`} className={`text-2xl font-mono font-bold tracking-tight ${isTempAlarm ? 'text-amber-600' : 'text-slate-800'}`}>{val ? val.toFixed(isTemp ? 1 : 3) : "0.000"}</span><span className="text-xs text-slate-400 font-medium">{unit}</span></div>
             {pred !== undefined && !master && !isInactive && !isTemp && <div className="text-right"><p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Pred Vol</p><p className={`text-[10px] font-mono font-bold ${Math.abs(pred - sp) < 0.05 ? 'text-emerald-600' : 'text-amber-600'}`}>{pred ? pred.toFixed(3) : "0.000"}</p></div>}
             {(master || isTemp) && (
                 <div className="text-right flex flex-col items-end">
                     <div className="flex items-center gap-1 mb-0.5"><p className="text-[8px] text-slate-400 font-bold uppercase">Target</p>{nominal && !isTemp && <span className="text-[8px] bg-slate-100 text-slate-500 px-1 rounded">Nom: {nominal.toFixed(3)}</span>}</div>
                     <div className="flex items-center gap-2"><p className="text-sm font-mono font-bold text-blue-600">{sp.toFixed(isTemp ? 1 : 3)}</p>
                     <div className="flex flex-col gap-0.5">
                         <button onClick={() => onAdjust(isTemp ? 1.0 : 0.01)} disabled={isFrozen} className="p-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-50"><Plus size={8} /></button>
                         <button onClick={() => onAdjust(isTemp ? -1.0 : -0.01)} disabled={isFrozen} className="p-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-50"><Minus size={8} /></button>
                     </div>
                     </div>
                 </div>
             )}
          </div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
             <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-300 z-10" />
             <div className={`h-full rounded-full transition-all duration-[50ms] ease-out ${isTempAlarm ? 'bg-amber-500' : accentColorClass}`} style={{ width: `${isTemp ? Math.min(val, 100) : Math.min(Math.abs(val - sp) * 50, 50)}%`, marginLeft: (isTemp || val >= sp) ? '0%' : `${50 - Math.min(Math.abs(val - sp) * 50, 50)}%`, opacity: isInactive ? 0.3 : 0.8 }} />
          </div>
          
          {master && massVal !== undefined && (
             <div className="mt-3 pt-2 border-t border-slate-50">
                 <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                     <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 flex justify-between items-center">
                         <span className="text-[8px] text-slate-400 font-bold">HOT VOL</span>
                         <span className="text-[10px] font-mono font-bold text-rose-500">{hotVol ? hotVol.toFixed(4) : "0.000"} L</span>
                     </div>
                     <div className="bg-emerald-50 border border-emerald-100 rounded px-1.5 py-1 flex justify-between items-center">
                         <span className="text-[8px] text-emerald-600 font-bold">LEGAL 20°C</span>
                         <span className="text-[10px] font-mono font-bold text-emerald-700">{val ? val.toFixed(4) : "0.000"} L</span>
                     </div>
                 </div>
                 <div className="flex justify-between items-center mb-1">
                     <span className="text-[8px] font-bold text-slate-400 uppercase">TI ADS1232 Load Cell Telemetry</span>
                     <span className="text-[8px] font-bold text-emerald-500 uppercase flex items-center gap-1"><Cpu size={10}/> Sync</span>
                 </div>
                 <div className="grid grid-cols-2 gap-1.5">
                     <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 flex justify-between items-center">
                         <span className="text-[8px] text-slate-400 font-bold">RAW MASS</span>
                         <span className="text-[9px] font-mono font-bold text-slate-700">{massVal.toFixed(3)} kg</span>
                     </div>
                     <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 flex justify-between items-center">
                         <span className="text-[8px] text-slate-400 font-bold">HEX BUFFER</span>
                         <span className="text-[9px] font-mono text-blue-600">{hexCode}</span>
                     </div>
                 </div>
             </div>
          )}

          {isTemp && (
             <div className="mt-3 pt-2 border-t border-slate-50 flex justify-between items-center">
                 <span className="text-[8px] font-bold text-slate-400 uppercase">Dynamic Metrology SG</span>
                 <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{dynamicSG?.toFixed(4)}</span>
             </div>
          )}

          {!master && (
             <div className="mt-3 pt-2 border-t border-slate-50">
                <div className="flex justify-between items-center mb-1">
                    <div className="flex gap-2 items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{isTemp ? 'IMC Steam Out' : (readOnly ? 'IMC Flow Req' : 'Manual Output')}</span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{(mv * 100).toFixed(1)}%</span>
                    </div>
                    {actualMv !== undefined && (
                        <div className="flex gap-1 items-center">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Physical Valve</span>
                            <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${Math.abs(mv - actualMv) > 0.001 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{(actualMv * 100).toFixed(1)}%</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onChange && onChange(Math.max(0, (mv * 100) - 1).toFixed(1))} disabled={readOnly || isFrozen || isInactive} className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-50"><Minus size={12} /></button>
                    <input type="range" min="0" max="100" step="0.1" value={mv * 100} disabled={readOnly || isFrozen || isInactive} onChange={(e) => onChange && onChange(e.target.value)} className={`flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer ${inputAccentClass} ${readOnly || isFrozen || isInactive ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    <button onClick={() => onChange && onChange(Math.min(100, (mv * 100) + 1).toFixed(1))} disabled={readOnly || isFrozen || isInactive} className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-50"><Plus size={12} /></button>
                </div>
             </div>
          )}

          {imcBias !== undefined && !isTemp && !master && (
             <div className="mt-3 pt-2 border-t border-slate-50 flex justify-between items-center">
                 <span className="text-[8px] font-bold text-amber-500 uppercase flex items-center gap-1"><RefreshCw size={10}/> IMC Bias Feedback</span>
                 <span className={`text-[10px] font-mono font-bold ${Math.abs(imcBias) > 0.0001 ? 'text-amber-600' : 'text-slate-400'}`}>{imcBias > 0 ? '+' : ''}{(imcBias).toFixed(4)} L</span>
             </div>
          )}
          
          {onDriftSim && !isTemp && !master && (
             <div className="mt-1 flex justify-between items-center">
                 <span className="text-[8px] font-bold text-slate-400 uppercase">Inject Disturbance</span>
                 <div className="flex gap-1 items-center">
                     <button onClick={() => onDriftSim(-0.01)} disabled={isFrozen} className="px-1.5 py-0.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded text-[10px] font-bold disabled:opacity-50">-</button>
                     <span className={`text-[10px] font-mono w-8 text-center font-bold ${biasVal !== 0 ? 'text-rose-500' : 'text-slate-400'}`}>{biasVal > 0 ? '+' : ''}{biasVal.toFixed(2)}</span>
                     <button onClick={() => onDriftSim(0.01)} disabled={isFrozen} className="px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600 rounded text-[10px] font-bold disabled:opacity-50">+</button>
                 </div>
             </div>
          )}
       </div>
    </div>
  );
}
