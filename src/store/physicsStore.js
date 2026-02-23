import { useSyncExternalStore } from 'react';
import { PRODUCTS } from '../utils/constants';
import { initStats, getCurrentShift } from '../utils/apcEngine';

class PhysicsEngineStore {
    constructor() {
        const initialTargetMassS1 = 0.50 * (1 - PRODUCTS[2].ratio) * PRODUCTS[0].sg20;
        const initialTargetMassS2 = 0.50 * PRODUCTS[2].ratio * PRODUCTS[2].sg20;
        
        this.state = {
            opMode: 'AUTO', simMode: 'RUN', trendFrozen: false, targetVol: 0.50, baseRecipeVol: 0.50,
            activeProduct: PRODUCTS[2], 
            silState: 'NORMAL', recoveryStep: 0, heartbeatActive: true, currentShift: getCurrentShift(), riskAlert: false,
            eStopActive: false, pneumaticHealth: 4.5, cipMode: false, cipTemp: 25.0, active: { s1: true, s2: true }, 
            
            // Stiction-affected Plant History
            mv_hist: { mv1: Array(50).fill(0.450), mv2: Array(50).fill(0.450), steam: Array(50).fill(0.52) },
            // Pure MPC Output History (For True IMC Alignment)
            req_mv_hist: { mv1: Array(50).fill(0.450), mv2: Array(50).fill(0.450), steam: Array(50).fill(0.52) },
            
            plant: { y11: 0, y22: 0, y21: 0, temp_y: 72.0 }, 
            internal_model: { y11: 0, y22: 0, y21: 0, temp_y: 72.0 }, 
            ambientTemp: 23.5,
            
            actual_mvs: { mv1: 0.450, mv2: 0.450, steam: 0.52 }, pvsVol: { s1: 0.50, s2: 0.00, cw: 0.50 }, pvsMass: { s1: initialTargetMassS1, s2: initialTargetMassS2, cw: initialTargetMassS1+initialTargetMassS2 },
            pvsTemp: 72.0, dynamicSG: PRODUCTS[2].sg20, mvs: { mv1: 0.450, mv2: 0.450, steam: 0.52 }, projectedTemp: 72.0,
            loads: { s1: 0.00, s2: 0.00 }, conveyor: [], nextSource: 's1', drift: { s1: 0.00, s2: 0.00, temp: 0.00 }, pssVol: { pss1: 0.50, pss2: 0.00 }, 
            
            // BRANCH C: UNIFIED IMC BIASES (Directly corrects MPC prediction)
            biases: { s1: 0.00, s2: 0.00, temp: 0.00 },
            kalman: { x_est: 0.0, p_est: 1.0, q: 0.001, r: 0.05 }, smithBuffer: [], decouplerActive: true,
            
            tuning: { imcLambda: 0.1, gain_s1: 1.0, gain_s2: 1.0, coupling: -0.35, bias_filter: 0.30, tau_11: 0.25, tau_22: 0.25, tau_21: 0.25, dt_21: 0.8 },
            
            history: [], cloudQueue: [], cloudSyncStatus: 'IDLE', cloudQueueSize: 0,
            recipeRuns: [{ id: Date.now(), recipeVol: 0.50, product: PRODUCTS[2].name, startTime: Date.now(), endTime: null, count: 0, volume: 0.0, shift: getCurrentShift(), giveawayVol: 0.0, wasteVol: 0.0, savingsVol: 0.0, t1Errors: 0, t2Errors: 0 }],
            batchStats: initStats(), shiftStats: { MORNING: initStats(), AFTERNOON: initStats(), NIGHT: initStats() }, dayStats: initStats(),
            counters: { over: 0, under: 0, total: 0 }, tickCounter: 0, scanBuffer: [], lastTick: Date.now(), lastSync: Date.now(), lastVolumes: [] 
        };
        this.listeners = new Set();
    }
    subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    getSnapshot = () => this.state;
    mutate = (fn) => { fn(this.state); }
    commit = () => {
        this.state = { 
            ...this.state, mvs: { ...this.state.mvs }, actual_mvs: { ...this.state.actual_mvs }, pvsVol: { ...this.state.pvsVol }, pvsMass: { ...this.state.pvsMass }, active: { ...this.state.active }, biases: { ...this.state.biases },
            loads: { ...this.state.loads }, drift: { ...this.state.drift }, counters: { ...this.state.counters }, tuning: { ...this.state.tuning },
            internal_model: { ...this.state.internal_model }, kalman: { ...this.state.kalman },
            mv_hist: { ...this.state.mv_hist }, req_mv_hist: { ...this.state.req_mv_hist },
            batchStats: { ...this.state.batchStats }, shiftStats: { MORNING: { ...this.state.shiftStats.MORNING }, AFTERNOON: { ...this.state.shiftStats.AFTERNOON }, NIGHT: { ...this.state.shiftStats.NIGHT } }, 
            dayStats: { ...this.state.dayStats }, recipeRuns: this.state.recipeRuns.map(r => ({...r})), lastVolumes: [...this.state.lastVolumes]
        };
        this.listeners.forEach(l => l());
    }
}

export const engine = new PhysicsEngineStore();
export const usePhysicsStore = () => useSyncExternalStore(engine.subscribe, engine.getSnapshot);
