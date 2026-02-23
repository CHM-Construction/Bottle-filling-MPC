import React from 'react';
import { Info, AlertCircle, ThumbsDown, ThumbsUp, Clock, HardDrive, Cpu, Cloud, Printer, DownloadCloud, Droplets, Layers, Database, FileSpreadsheet } from 'lucide-react';
import { PRICE_PER_LITER, REWORK_COST_PER_UNIT } from '../utils/constants';

function BucketCard({ title, icon, data, color }) {
    const colors = { blue: 'border-t-blue-500 text-blue-600', amber: 'border-t-amber-500 text-amber-600', slate: 'border-t-slate-500 text-slate-600' };
    const wasteCost = (data.underfillVol * PRICE_PER_LITER) + (data.t2Errors * REWORK_COST_PER_UNIT);
    const netOptZAR = (data.savingsVol * PRICE_PER_LITER) - (data.giveawayVol * PRICE_PER_LITER) - wasteCost;
    
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 ${colors[color].split(' ')[0]} p-6 flex flex-col gap-4`}>
            <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">{icon} {title}</span></div>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div><span className="text-[10px] font-bold text-slate-400 uppercase">Unit Count</span><p className="text-3xl font-black text-slate-800">{data.count}</p></div>
                <div className="text-right"><span className="text-[10px] font-bold text-slate-400 uppercase">Total Volume</span><p className="text-3xl font-black text-slate-800">{(data.volume / 1000).toFixed(3)} <span className="text-sm font-medium text-slate-400">kL</span></p></div>
            </div>
            <div className="h-px bg-slate-100 w-full"></div>
            
            <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 rounded p-2 border border-slate-200"><span className="text-[9px] font-bold text-slate-600 uppercase">Average Fill</span><p className="text-lg font-mono font-bold text-slate-700">{data.mean.toFixed(3)}<span className="text-[9px]">L</span></p></div>
                 <div className="bg-indigo-50 rounded p-2 border border-indigo-100"><span className="text-[9px] font-bold text-indigo-600 uppercase">Consistency</span><p className="text-lg font-mono font-bold text-indigo-700">±{data.stdDev.toFixed(4)}</p></div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 rounded p-2 border border-emerald-100"><span className="text-[8px] font-bold text-emerald-600 uppercase">Savings</span><p className="text-sm font-mono font-bold text-emerald-700">+{data.savingsVol.toFixed(3)}L</p></div>
                <div className="bg-rose-50 rounded p-2 border border-rose-100"><span className="text-[8px] font-bold text-rose-400 uppercase">Rejects</span><p className="text-sm font-mono font-bold text-rose-700">-{data.t2Errors}</p></div>
                <div className="bg-amber-50 rounded p-2 border border-amber-100"><span className="text-[8px] font-bold text-amber-400 uppercase">Overfill</span><p className="text-sm font-mono font-bold text-amber-700">-{data.giveawayVol.toFixed(3)}L</p></div>
            </div>

            <div className={`rounded p-3 border flex items-center justify-between ${netOptZAR >= 0 ? 'bg-slate-800 border-slate-700 text-white' : 'bg-rose-100 border-rose-200 text-rose-900'}`}>
                <div>
                     <span className={`text-[9px] font-bold uppercase ${netOptZAR >= 0 ? 'text-slate-400' : 'text-rose-700'}`}>Net Optimization</span>
                     <p className={`text-[8px] ${netOptZAR >= 0 ? 'text-slate-500' : 'text-rose-500'}`}>ZAR Profit/Loss</p>
                </div>
                <div className="text-right">
                    <p className="text-xl font-mono font-black">{netOptZAR >= 0 ? '+' : ''}R{Math.abs(netOptZAR).toFixed(2)}</p>
                </div>
            </div>
        </div>
    );
}

export default function ProductionDataView({ uiState, onExportCSV, onPrintReport }) {
    const activeShift = uiState.currentShift; 
    const currentStats = uiState.shiftStats[activeShift];
    const runs = [...uiState.recipeRuns].reverse();

    const getInsight = () => {
        if (currentStats.count === 0) return { title: "Waiting for Production", desc: "No bottles processed in this shift yet.", color: "slate", icon: <Info size={24}/> };
        const rejectRate = currentStats.count > 0 ? (currentStats.t1Errors + currentStats.t2Errors) / currentStats.count : 0;
        if (rejectRate > 0.05) return { title: "Quality Alert", desc: "Too many rejected bottles (Underfilled). Check manifold pressures.", color: "rose", icon: <AlertCircle size={24}/> };
        if (currentStats.giveawayVol > (currentStats.volume * 0.005)) return { title: "Efficiency Warning", desc: "Giving away too much product (Overfilling). Optimization needed.", color: "amber", icon: <ThumbsDown size={24}/> };
        return { title: "Performance Good", desc: "Production is running efficiently with high quality and low waste.", color: "emerald", icon: <ThumbsUp size={24}/> };
    };

    const insight = getInsight();
    const insightColors = { slate: 'bg-slate-50 border-slate-200 text-slate-600', rose: 'bg-rose-50 border-rose-200 text-rose-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700' };

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-6 h-full pb-10">
            <div className={`w-full p-4 rounded-xl border-l-4 shadow-sm flex items-start gap-4 ${insightColors[insight.color]} border-l-${insight.color}-500`}>
                <div className="p-2 bg-white rounded-full shadow-sm text-current">{insight.icon}</div>
                <div><h3 className="font-bold text-lg">Manager's Insight: {insight.title}</h3><p className="text-sm opacity-80">{insight.desc}</p></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${activeShift === 'MORNING' ? 'border-blue-500' : (activeShift === 'AFTERNOON' ? 'border-amber-500' : 'border-purple-500')} flex items-center justify-between`}>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Current Shift</p><h2 className={`text-2xl font-black ${activeShift === 'MORNING' ? 'text-blue-600' : (activeShift === 'AFTERNOON' ? 'text-amber-600' : 'text-purple-600')}`}>{activeShift}</h2></div>
                    <Clock size={24} className="text-slate-300"/>
                </div>
                
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Local Cache (NVMe)</p>
                         <HardDrive size={16} className="text-slate-300" />
                    </div>
                    <div className="flex items-center gap-3">
                         <h2 className="text-2xl font-black text-slate-700">{uiState.cloudQueueSize || 0}</h2>
                         <span className="text-[10px] font-bold text-slate-400">Events Buffered</span>
                    </div>
                    <div className="absolute bottom-1 right-2 text-[7px] text-emerald-500 font-bold">36-MONTH RETENTION</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Metrology Core</p>
                         <Cpu size={14} className="text-slate-300" />
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1">
                         <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500">Fluid Density</span><span className="text-[9px] font-bold text-emerald-600 font-mono">{uiState.activeProduct.name}</span></div>
                         <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500">Thermal PID Comp</span><span className="text-[9px] font-bold text-blue-600">ACTIVE</span></div>
                         <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500">OIML Rules</span><span className="text-[9px] font-bold text-slate-700">R 87 (2016)</span></div>
                    </div>
                </div>
                
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Enterprise Sync</p>
                            <Cloud size={14} className={uiState.cloudSyncStatus === 'SYNCING' ? 'text-blue-500 animate-bounce' : 'text-emerald-500'} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-sm font-bold ${uiState.cloudSyncStatus === 'SYNCING' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                {uiState.cloudSyncStatus === 'SYNCING' ? 'SYNCING...' : 'ONLINE'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button onClick={onPrintReport} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-300 px-3 py-2 rounded shadow-sm hover:bg-slate-100 active:scale-95 transition-all"><Printer size={14}/> PRINT</button>
                        <button onClick={onExportCSV} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 px-3 py-2 rounded shadow hover:bg-indigo-500 active:scale-95 transition-all"><DownloadCloud size={14}/> CSV</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <BucketCard title="CURRENT BATCH" icon={<Droplets size={18}/>} data={uiState.batchStats} color="blue" />
                <BucketCard title={`SHIFT TOTALS (${activeShift})`} icon={<Layers size={18}/>} data={uiState.shiftStats[activeShift]} color="amber" />
                <BucketCard title="DAY AGGREGATE" icon={<Database size={18}/>} data={uiState.dayStats} color="slate" />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50 font-bold text-xs text-slate-500 uppercase flex items-center gap-2"><FileSpreadsheet size={14}/> Job History (Recipe Runs)</div>
                  <div className="overflow-y-auto max-h-[300px]">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                              <tr>
                                  <th className="p-3 pl-4">Time / Product</th>
                                  <th className="p-3">Target Vol</th>
                                  <th className="p-3 text-right">Units</th>
                                  <th className="p-3 text-right">Net Vol (L)</th>
                                  <th className="p-3 text-right">Given Away (L)</th>
                                  <th className="p-3 text-right pr-4">Net Opt (ZAR)</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {runs.map((run) => {
                                  const wasteCost = (run.wasteVol * PRICE_PER_LITER) + (run.t2Errors * REWORK_COST_PER_UNIT);
                                  const netOpt = ((run.savingsVol * PRICE_PER_LITER) - (run.giveawayVol * PRICE_PER_LITER) - wasteCost).toFixed(2);
                                  return (
                                       <tr key={run.id} className={run.endTime === null ? 'bg-emerald-50/30' : ''}>
                                            <td className="p-3 pl-4"><div className="flex flex-col"><span className="font-bold text-slate-700 text-xs">{new Date(run.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span><span className="text-[9px] text-slate-400 font-bold">{run.shift} | {run.product}</span></div></td>
                                            <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-mono font-bold text-xs">{run.recipeVol.toFixed(3)}L</span></td>
                                            <td className="p-3 text-right font-mono text-slate-600 font-bold">{run.count}</td>
                                            <td className="p-3 text-right font-mono text-slate-600 text-xs">{run.volume.toFixed(3)}</td>
                                            <td className="p-3 text-right font-mono text-amber-600 text-xs">{run.giveawayVol.toFixed(3)}</td>
                                            <td className="p-3 text-right pr-4"><span className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${netOpt >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{netOpt >= 0 ? '+' : ''}R{Math.abs(netOpt).toFixed(2)}</span></td>
                                       </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
            </div>
        </div>
    );
}
