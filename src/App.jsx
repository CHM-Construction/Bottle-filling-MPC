import React, { useState, useRef, useCallback } from 'react';
import { AlertOctagon, Lock, Thermometer } from 'lucide-react';
import { usePhysicsStore, engine } from './store/physicsStore';
import { useSimulationLoop } from './hooks/useSimulationLoop';
import { useBackgroundWorkers } from './hooks/useBackgroundWorkers';
import { PRODUCTS, PRICE_PER_LITER, REWORK_COST_PER_UNIT } from './utils/constants';
import { initStats } from './utils/apcEngine';

// Components
import Header from './components/Header';
import Faceplate from './components/Faceplate';
import ConveyorVisualizer from './components/ConveyorVisualizer';
import TrendPanel from './components/TrendPanel';
import KPIPanel from './components/KPIPanel';
import ProductionDataView from './components/ProductionDataView';
import TuningPanel from './components/TuningPanel';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('CONTROL'); 

  const uiState = usePhysicsStore();

  const s1PathRef = useRef(null); 
  const s2PathRef = useRef(null); 
  const cwPathRef = useRef(null); 
  const tempPathRef = useRef(null);
  const conveyorRef = useRef(null); 

  // Initialize the engine loop and background workers
  const { runPhysicsTick, renderVisuals } = useSimulationLoop({
      isLoggedIn, s1PathRef, s2PathRef, cwPathRef, tempPathRef, conveyorRef
  });
  useBackgroundWorkers(isLoggedIn, uiState.silState);

  // Action Dispatchers
  const setConfig = useCallback((key, val) => { engine.mutate(s => { s[key] = val; }); engine.commit(); }, []);
  
  const handleTuningChange = useCallback((key, value) => {
      engine.mutate(s => { s.tuning[key] = value; }); engine.commit();
  }, []);

  const handleTuningMode = useCallback((mode) => {
      engine.mutate(s => { s.tuningMode = mode; }); engine.commit();
  }, []);

  const handleManualInput = useCallback((key, value) => {
    if (uiState.opMode !== 'MANUAL' || uiState.silState !== 'NORMAL') return;
    engine.mutate(s => { s.mvs[key] = parseFloat(value) / 100; }); engine.commit(); 
  }, [uiState.opMode, uiState.silState]);

  const handleToggleScale = useCallback((scaleKey) => { engine.mutate(s => { s.active[scaleKey] = !s.active[scaleKey]; }); engine.commit(); }, []);
  const handleLoadInject = useCallback((ch, amt) => { engine.mutate(s => { s.loads[ch] += amt; }); engine.commit(); }, []);
  const handleDriftInject = useCallback((ch, amt) => { engine.mutate(s => { s.drift[ch] += amt; }); engine.commit(); }, []);
  const handleTargetAdjust = useCallback((delta) => { engine.mutate(s => { s.targetVol = parseFloat((s.targetVol + delta).toFixed(3)); }); engine.commit(); }, []);
  const handleTempAdjust = useCallback((delta) => { engine.mutate(s => { s.activeProduct.targetTemp = parseFloat((s.activeProduct.targetTemp + delta).toFixed(1)); }); engine.commit(); }, []);

  const resetProcess = (P, recipeVal, product) => {
      const targetMassS1 = recipeVal * (1 - product.ratio) * PRODUCTS[0].sg20;
      const targetMassS2 = recipeVal * product.ratio * product.sg20;
      P.conveyor = []; 
      P.pvsVol = { s1: recipeVal * (1 - product.ratio), s2: recipeVal * product.ratio, cw: 0.00 }; 
      P.pvsMass = { s1: targetMassS1, s2: targetMassS2, cw: 0.00 };
      
      P.pvsTemp = product.targetTemp; P.projectedTemp = product.targetTemp;
      P.dynamicSG = (PRODUCTS[0].sg20 * (1 - product.ratio)) + (product.sg20 * product.ratio);
      
      P.plant = { y11: 0, y22: 0, y21: 0, temp_y: product.targetTemp }; 
      P.internal_model = { y11: 0, y22: 0, y21: 0, temp_y: product.targetTemp }; 
      
      const startSteam = Math.max(0, (product.targetTemp - 20) / 100);
      P.mvs = { mv1: 0.450, mv2: 0.450, steam: startSteam }; 
      P.actual_mvs = { mv1: 0.450, mv2: 0.450, steam: startSteam };
      
      P.mv_hist = { mv1: Array(50).fill(0.45), mv2: Array(50).fill(0.45), steam: Array(50).fill(startSteam) };
      P.req_mv_hist = { mv1: Array(50).fill(0.45), mv2: Array(50).fill(0.45), steam: Array(50).fill(startSteam) };
      
      P.kalman = { x_est: 0.0, p_est: 1.0, q: 0.001, r: 0.05 }; P.smithBuffer = [];
      P.biases = { s1: 0.00, s2: 0.00, temp: 0.00 };
      
      P.drift = { s1: 0.00, s2: 0.00, temp: 0.00 }; P.loads = { s1: 0.00, s2: 0.00 }; 
      P.scanBuffer = []; P.counters = { over: 0, under: 0, total: 0 }; P.history = [];
      P.batchStats = initStats(); P.lastVolumes = []; P.cipMode = false;
  };

  const handleRecipeSelect = useCallback((recipeVal) => { engine.mutate(P => { P.targetVol = recipeVal; P.baseRecipeVol = recipeVal; resetProcess(P, recipeVal, P.activeProduct); }); engine.commit(); }, []);
  const handleProductSelect = useCallback((product) => { engine.mutate(P => { P.activeProduct = product; resetProcess(P, P.baseRecipeVol, product); }); engine.commit(); }, []);
  const handleCIPToggle = useCallback(() => { engine.mutate(P => { P.cipMode = !P.cipMode; if(P.cipMode){ P.simMode = 'RUN'; P.eStopActive = false; P.silState = 'NORMAL'; } }); engine.commit(); }, []);
  const triggerEStop = useCallback(() => { engine.mutate(s => { s.eStopActive = true; s.simMode = 'PAUSE'; s.silState = 'E_STOP'; }); engine.commit(); }, []);
  const clearEStop = useCallback(() => { engine.mutate(s => { s.eStopActive = false; s.silState = 'NORMAL'; s.simMode = 'RUN'; }); engine.commit(); }, []);
  const triggerCrash = useCallback(() => { engine.mutate(s => { s.simMode = 'RUN'; s.silState = 'MPC_LOST'; s.heartbeatActive = false; }); engine.commit(); }, []);
  const handleStep = useCallback(() => { setConfig('simMode', 'PAUSE'); for(let i=0; i<15 + 5; i++) runPhysicsTick(); renderVisuals(engine.getSnapshot()); engine.commit(); }, [setConfig, runPhysicsTick, renderVisuals]);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    const P = engine.getSnapshot();
    const header = "Job ID,Start Time,End Time,Shift,Product,Target Vol (L),Total Bottles,Net Vol (L),Giveaway (L),Waste (L),Savings (ZAR),Net Optimization (ZAR)\n";
    const rows = P.recipeRuns.map(run => {
        const endTimeStr = run.endTime ? new Date(run.endTime).toLocaleString() : 'Running';
        const wasteCost = (run.wasteVol * PRICE_PER_LITER) + (run.t2Errors * REWORK_COST_PER_UNIT);
        const netOpt = ((run.savingsVol * PRICE_PER_LITER) - (run.giveawayVol * PRICE_PER_LITER) - wasteCost).toFixed(2);
        return [
            run.id, new Date(run.startTime).toLocaleString(), endTimeStr, run.shift, run.product,
            run.recipeVol.toFixed(3), run.count, run.volume.toFixed(3), run.giveawayVol.toFixed(3),
            run.wasteVol.toFixed(3), (run.savingsVol * PRICE_PER_LITER).toFixed(2), netOpt
        ].join(",");
    }).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `CHM_Beverage_Data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }, []);

  const handlePrintReport = useCallback(() => { window.print(); }, []);

  if (!isLoggedIn) return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;

  return (
    <div className="h-screen w-full bg-slate-100 text-slate-800 font-sans flex flex-col overflow-hidden relative">
      {uiState.eStopActive && (
          <div className="absolute inset-0 z-50 bg-red-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white">
              <AlertOctagon size={120} className="mb-6 animate-pulse text-red-400" />
              <h1 className="text-6xl font-black tracking-widest mb-2">E-STOP ENGAGED</h1>
              <p className="text-xl font-mono text-red-200 mb-8 tracking-wide">PUMPS & VALVES DE-ENERGIZED (SIL 3)</p>
              <button onClick={clearEStop} className="px-8 py-4 bg-red-600 hover:bg-red-500 rounded-lg text-2xl font-bold shadow-2xl border-2 border-red-400 transition-all active:scale-95 text-white flex items-center gap-3"><Lock size={28} /> RESET INTERLOCK</button>
          </div>
      )}

      <Header uiState={uiState} setConfig={setConfig} handleRecipeSelect={handleRecipeSelect} handleProductSelect={handleProductSelect} activeTab={activeTab} setActiveTab={setActiveTab} handleStep={handleStep} triggerEStop={triggerEStop} triggerCrash={triggerCrash} handleCIPToggle={handleCIPToggle} />
      
      <main className="flex-1 p-4 overflow-y-auto overflow-x-hidden bg-slate-50 relative">
        {uiState.cipMode && (
           <div className="absolute inset-4 z-40 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl flex flex-col items-center justify-center">
              <div className="bg-amber-100 p-6 rounded-full border-4 border-amber-300 shadow-lg mb-6 relative">
                 <Thermometer size={64} className="text-amber-600" />
                 <div className="absolute top-0 right-0 w-6 h-6 bg-rose-500 rounded-full animate-ping"></div>
              </div>
              <h2 className="text-4xl font-black text-slate-800 mb-2 uppercase tracking-wide">CIP Thermal Washdown</h2>
              <p className="text-slate-500 font-bold mb-8">STERILIZATION LOOP ACTIVE (HX LAG MODEL)</p>
              <div className="flex items-center gap-6 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-inner border border-slate-700">
                  <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Manifold Temp</span>
                      <span className={`text-4xl font-mono font-black ${uiState.cipTemp > 85 ? 'text-rose-400' : 'text-amber-400'}`}>{uiState.cipTemp.toFixed(1)}°C</span>
                  </div>
                  <div className="h-12 w-px bg-slate-700"></div>
                  <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Target Temp</span>
                      <span className="text-2xl font-mono font-bold text-emerald-400">95.0°C</span>
                  </div>
              </div>
              <button onClick={handleCIPToggle} className="mt-8 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded shadow transition-all active:scale-95">ABORT CIP & COOL DOWN</button>
           </div>
        )}

        {/* TAB ROUTING */}
        {activeTab === 'CONTROL' && (
           <div className="max-w-[1920px] mx-auto w-full grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4 h-full relative z-10">
             <div className="flex flex-col gap-2 min-w-0">
                <div className="flex flex-col gap-2">
                   <Faceplate tag="cw" title="Check Weigher" subtitle={`IMC Observer (SG: ${uiState.dynamicSG?.toFixed(3)})`} val={uiState.pvsVol.cw} massVal={uiState.pvsMass.cw} sp={uiState.targetVol} nominal={uiState.baseRecipeVol} unit="L" accent="slate" master onAdjust={handleTargetAdjust} silState={uiState.silState} biasVal={0} isActive={true} hotVol={uiState.pvsMass.cw / uiState.dynamicSG} />
                   <Faceplate tag="hx" title="Steam Exchanger" subtitle={`Thermal MPC Predicted: ${uiState.projectedTemp?.toFixed(1)}°C`} val={uiState.pvsTemp} mv={uiState.mvs.steam} actualMv={uiState.actual_mvs.steam} sp={uiState.activeProduct.targetTemp} unit="°C" accent="amber" onChange={(v) => handleManualInput('steam', v)} readOnly={uiState.opMode === 'AUTO'} silState={uiState.silState} load={uiState.drift.temp} onLoadChange={(amt) => handleDriftInject('temp', amt)} isActive={true} isTemp={true} dynamicSG={uiState.dynamicSG} onAdjust={handleTempAdjust} />
                   <Faceplate tag="s1" title="Valve 1: Base Flow" subtitle={`Density FFwd MPC (${(100 - uiState.activeProduct.ratio*100).toFixed(0)}%)`} val={uiState.pvsVol.s1} mv={uiState.mvs.mv1} actualMv={uiState.actual_mvs.mv1} pred={uiState.pssVol.pss1} sp={uiState.targetVol * (1 - uiState.activeProduct.ratio)} unit="L" accent="blue" onChange={(v) => handleManualInput('mv1', v)} readOnly={uiState.opMode === 'AUTO'} silState={uiState.silState} load={uiState.loads.s1} onLoadChange={(amt) => handleLoadInject('s1', amt)} isActive={uiState.active.s1} onToggle={() => handleToggleScale('s1')} imcBias={uiState.biases.s1 / PRODUCTS[0].sg20} biasVal={uiState.drift.s1} onDriftSim={(v) => handleDriftInject('s1', v)} />
                   <Faceplate tag="s2" title="Valve 2: Dosing" subtitle={`Density FFwd MPC (${(uiState.activeProduct.ratio*100).toFixed(0)}%)`} val={uiState.pvsVol.s2} mv={uiState.mvs.mv2} actualMv={uiState.actual_mvs.mv2} pred={uiState.pssVol.pss2} sp={uiState.targetVol * uiState.activeProduct.ratio} unit="L" accent="fuchsia" onChange={(v) => handleManualInput('mv2', v)} readOnly={uiState.opMode === 'AUTO'} silState={uiState.silState} load={uiState.loads.s2} onLoadChange={(amt) => handleLoadInject('s2', amt)} isActive={uiState.active.s2} onToggle={() => handleToggleScale('s2')} imcBias={uiState.activeProduct.ratio > 0 ? uiState.biases.s2 / uiState.activeProduct.sg20 : 0} biasVal={uiState.drift.s2} onDriftSim={(v) => handleDriftInject('s2', v)} />
                </div>
             </div>
             <div className="flex flex-col gap-4 min-w-0 h-full">
                <ConveyorVisualizer containerRef={conveyorRef} itemCount={uiState.conveyor.length} />
                <TrendPanel s1Ref={s1PathRef} s2Ref={s2PathRef} cwRef={cwPathRef} tempRef={tempPathRef} uiState={uiState} />
                <KPIPanel uiState={uiState} />
             </div>
           </div>
        )}

        {activeTab === 'DATA' && (
           <ProductionDataView uiState={uiState} onExportCSV={handleExportCSV} onPrintReport={handlePrintReport} />
        )}

        {activeTab === 'TUNING' && (
           <TuningPanel uiState={uiState} setTuning={handleTuningChange} setTuningMode={handleTuningMode} />
        )}

      </main>
    </div>
  );
}
