import React from 'react';
import { ClipboardCheck, Box, AlertOctagon } from 'lucide-react';
import { getTolerableDeficiency, getPalletSize } from '../utils/apcEngine';

function SPCBellCurve({ stats, baseRecipeVol }) {
    const tVal = getTolerableDeficiency(baseRecipeVol);
    const mean = stats.mean || baseRecipeVol;
    const stdDev = stats.stdDev || 0.05;
    
    const width = 300; const height = 80;
    const minX = baseRecipeVol - (4 * tVal); const maxX = baseRecipeVol + (4 * tVal);
    const range = maxX - minX;
    const getX = (val) => ((val - minX) / range) * width;
    
    let path = `M 0,${height} `;
    for (let i = 0; i <= width; i+=2) {
        const xVal = minX + (i / width) * range;
        const z = (xVal - mean) / stdDev;
        const yVal = Math.exp(-0.5 * z * z);
        path += `L ${i},${height - (yVal * (height-10))} `;
    }
    path += `L ${width},${height}`;

    const xT1 = getX(baseRecipeVol - tVal);
    const xT2 = getX(baseRecipeVol - 2*tVal);
    const xTarget = getX(baseRecipeVol);

    return (
        <div className="relative w-full h-20 bg-slate-50 border border-slate-200 rounded overflow-hidden mt-2 flex items-end">
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                <rect x="0" y="0" width={Math.max(0, xT2)} height={height} fill="#fee2e2" opacity="0.5" />
                <rect x={Math.max(0, xT2)} y="0" width={Math.max(0, xT1 - xT2)} height={height} fill="#fef3c7" opacity="0.5" />
                <line x1={xT1} y1="0" x2={xT1} y2={height} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                <line x1={xT2} y1="0" x2={xT2} y2={height} stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
                <line x1={xTarget} y1="0" x2={xTarget} y2={height} stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                <path d={path} fill="#3b82f6" fillOpacity="0.2" stroke="#2563eb" strokeWidth="2" />
            </svg>
            <div className="absolute top-1 text-[8px] font-bold text-rose-500" style={{left: Math.max(2, xT2 - 20)}}>T2</div>
            <div className="absolute top-1 text-[8px] font-bold text-amber-500" style={{left: Math.max(10, xT1 + 4)}}>T1</div>
        </div>
    );
}

export default function KPIPanel({ uiState }) {
    const { batchStats: stats, baseRecipeVol, counters, lastVolumes, pvsTemp, activeProduct } = uiState;
    const T_val = getTolerableDeficiency(baseRecipeVol);
    const T1_Limit = baseRecipeVol - T_val;
    const Cpl = stats.stdDev > 0.001 ? ((stats.mean - T1_Limit) / (3 * stats.stdDev)).toFixed(2) : '0.00';
    
    const palletSize = getPalletSize(baseRecipeVol);
    const palletProgress = (stats.count % palletSize);
    const validSample = (lastVolumes || []).slice(-palletSize);
    const rollingMean = validSample.length > 0 ? validSample.reduce((a,b)=>a+b,0) / validSample.length : baseRecipeVol;
    
    const isMeanViolation = validSample.length >= Math.min(10, palletSize) && rollingMean < baseRecipeVol;
    const isTempAlarm = Math.abs(pvsTemp - activeProduct.targetTemp) >= 3.0;

    return (
        <div className="h-auto bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-4 shrink-0">
           <div className="flex-[1.5]">
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2"><ClipboardCheck size={12} /> SPC Volumetric Analytics</div>
                  <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">KALMAN</span>
                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${parseFloat(Cpl) >= 1.33 ? 'bg-emerald-100 text-emerald-700' : (parseFloat(Cpl) >= 1.0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}`}>Cpk: {Cpl}</span>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                 <div className={`p-1.5 rounded border flex flex-col items-center ${isMeanViolation ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[8px] font-bold uppercase ${isMeanViolation ? 'text-rose-500' : 'text-slate-400'}`}>Batch Mean ($\mu$)</p>
                    <p className={`text-xs font-mono font-black ${isMeanViolation ? 'text-rose-700' : 'text-slate-700'}`}>{stats.mean.toFixed(4)}L</p>
                 </div>
                 <div className="bg-slate-50 p-1.5 rounded border border-slate-200 flex flex-col items-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Std Deviation ($\sigma$)</p>
                    <p className="text-xs font-mono font-black text-slate-700">±{stats.stdDev.toFixed(4)}L</p>
                 </div>
              </div>
              {isTempAlarm && (
                  <div className="mb-2 bg-amber-100 border border-amber-300 p-1.5 rounded flex items-center justify-center gap-2 text-amber-800 shadow-sm animate-pulse">
                      <AlertOctagon size={14} />
                      <span className="text-[9px] font-bold uppercase">PRODUCT DIVERT: TEMPERATURE OUT OF SPEC</span>
                  </div>
              )}
              <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Pallet Progress ({palletSize} units)</span>
                      <span className="text-[8px] font-mono font-bold text-slate-600">{palletProgress} / {palletSize}</span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${(palletProgress / palletSize) * 100}%` }}></div>
                  </div>
              </div>
              {stats.count > 2 ? <SPCBellCurve stats={stats} baseRecipeVol={baseRecipeVol} /> : <div className="h-20 flex items-center justify-center text-[10px] text-slate-400 border border-slate-100 rounded bg-slate-50 mt-2">Awaiting data...</div>}
           </div>
           <div className="h-px md:h-auto md:w-px bg-slate-100"></div>
           <div className="flex-1 flex flex-col justify-center gap-2">
              <div className="flex items-center justify-between mb-1 bg-slate-50 p-1.5 rounded border border-slate-200">
                  <div className="flex items-center gap-2"><Box size={12} className="text-slate-500" /><span className="text-[8px] font-bold text-slate-600 uppercase">Total Bottles</span></div>
                  <span className="text-xs font-mono font-black text-slate-700">{counters.total}</span>
              </div>
              <div className="bg-rose-50 p-1.5 rounded border border-rose-100 flex justify-between items-center">
                 <p className="text-[8px] font-bold text-rose-400 uppercase">T2 Reject (&lt;{(baseRecipeVol - 2*T_val).toFixed(3)}L)</p>
                 <p className="text-xs font-mono font-black text-rose-600">{stats.t2Errors}</p>
              </div>
              <div className="bg-amber-50 p-1.5 rounded border border-amber-100 flex justify-between items-center">
                 <p className="text-[8px] font-bold text-amber-400 uppercase">T1 Warn (&lt;{(baseRecipeVol - T_val).toFixed(3)}L)</p>
                 <p className="text-xs font-mono font-black text-amber-600">{stats.t1Errors}</p>
              </div>
           </div>
        </div>
    );
}
