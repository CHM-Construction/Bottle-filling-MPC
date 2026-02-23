import React from 'react';
import { TrendingUp, ShieldAlert, Activity, Zap } from 'lucide-react';
import { getTolerableDeficiency } from '../utils/apcEngine';

function Legend({ color, label }) { 
    return (
        <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full shadow-sm`} style={{ backgroundColor: color }} />
            <span className="text-xs font-bold text-slate-600">{label}</span>
        </div>
    ); 
}

export default function TrendPanel({ s1Ref, s2Ref, cwRef, tempRef, uiState }) {
    const { targetVol, baseRecipeVol, silState, riskAlert, heartbeatActive, eStopActive, activeProduct, decouplerActive } = uiState;
    const tVal = getTolerableDeficiency(baseRecipeVol);
    const pixelsPerL = 20 / tVal; 
    
    const yNominal = 50 - ((baseRecipeVol - targetVol) * pixelsPerL);
    const yT1_bot = 50 - ((baseRecipeVol - tVal - targetVol) * pixelsPerL);
    const yT2_bot = 50 - ((baseRecipeVol - 2*tVal - targetVol) * pixelsPerL);
    
    return (
        <div className="flex-[2] min-h-[250px] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
               <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={14} /></div>
                   <div>
                       <h3 className="text-xs font-bold text-slate-800 leading-tight">Process Response</h3>
                       <p className="text-[9px] text-slate-400 font-medium leading-tight">PURE IMC-MPC + THERMAL FFWD {decouplerActive ? '+ RGA DECOUPLED' : ''}</p>
                   </div>
               </div>
               <div className="flex gap-4 sm:gap-6 flex-wrap">
                   <Legend color="#1e293b" label="Total Vol" />
                   <Legend color="#3b82f6" label="Water Base" />
                   <Legend color={activeProduct.color} label="Syrup Mix" />
                   <Legend color="#f59e0b" label="Temp °C" />
               </div>
            </div>
            <div className="flex-1 relative bg-slate-50/30 w-full min-h-[200px]">
               <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
               {(silState === 'MPC_LOST' || eStopActive) && (
                   <div className="absolute inset-0 bg-rose-900/20 z-20 flex items-center justify-center backdrop-blur-[2px]">
                       <div className={`bg-white p-4 rounded-xl shadow-2xl border-2 border-rose-500 flex flex-col items-center gap-2 ${eStopActive ? '' : 'animate-bounce'}`}>
                           <ShieldAlert size={32} className="text-rose-600 animate-pulse" />
                           <div className="text-center">
                               <h3 className="text-xl font-black text-rose-700">{eStopActive ? 'EMERGENCY STOP' : 'MPC_LOST'}</h3>
                               <p className="text-[10px] font-bold text-rose-500 uppercase">{eStopActive ? 'HARDWARE INTERLOCK ENGAGED' : 'CONTROL FREEZE ACTIVE'}</p>
                           </div>
                       </div>
                   </div>
               )}
               <div className="absolute inset-4 top-4 bottom-12">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none">
                      <defs><clipPath id="chartArea"><rect x="0" y="0" width="1000" height="100" /></clipPath></defs>
                      <g clipPath="url(#chartArea)">
                         <line x1="0" y1="50" x2="1000" y2="50" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
                         {Math.abs(baseRecipeVol - targetVol) > 0.001 && <line x1="0" y1={yNominal} x2="1000" y2={yNominal} stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 4" strokeOpacity="0.5" />}
                         <line x1="0" y1={yT1_bot} x2="1000" y2={yT1_bot} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.8" />
                         <line x1="0" y1={yT2_bot} x2="1000" y2={yT2_bot} stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.8" />
                         
                         <path ref={s2Ref} fill="none" stroke={activeProduct.color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                         <path ref={s1Ref} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                         <path ref={tempRef} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
                         <path ref={cwRef} fill="none" stroke={riskAlert ? "#ef4444" : "#1e293b"} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm" />
                      </g>
                  </svg>
               </div>
               <div className="absolute right-2 top-2 text-[9px] font-bold text-slate-400 bg-white/80 px-1 rounded shadow-sm">{(targetVol + (50/pixelsPerL)).toFixed(3)} L</div>
               <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded border border-blue-100">{targetVol.toFixed(3)} L</div>
               <div className="absolute right-2 bottom-12 text-[9px] font-bold text-slate-400 bg-white/80 px-1 rounded shadow-sm">{(targetVol - (50/pixelsPerL)).toFixed(3)} L</div>
               <div className="absolute bottom-0 left-0 right-0 h-8 bg-white border-t border-slate-200 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2"><Activity size={12} className={heartbeatActive ? "text-emerald-500 animate-pulse" : "text-slate-300"} /><span className="text-[9px] font-bold text-slate-500">HEARTBEAT</span></div>
                  </div>
               </div>
            </div>
        </div>
    );
}
