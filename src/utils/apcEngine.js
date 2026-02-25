import { ZERO_POINT_MV, VALVE_CAPACITY_VOL } from './constants';

export const getTolerableDeficiency = (nomL) => {
    if (Math.abs(nomL - 0.33) < 0.001) return 0.0099; 
    if (Math.abs(nomL - 0.50) < 0.001) return 0.0150; 
    if (Math.abs(nomL - 1.50) < 0.001) return 0.0225; 
    if (Math.abs(nomL - 2.00) < 0.001) return 0.0300; 

    const nomML = nomL * 1000;
    let t_ml = 0;
    if (nomML < 5) t_ml = 0; 
    else if (nomML <= 50) t_ml = nomML * 0.09;
    else if (nomML <= 100) t_ml = 4.5;
    else if (nomML <= 200) t_ml = nomML * 0.045;
    else if (nomML <= 300) t_ml = 9.0;
    else if (nomML <= 500) t_ml = nomML * 0.03;
    else if (nomML <= 1000) t_ml = 15.0;
    else if (nomML <= 10000) t_ml = nomML * 0.015;
    else if (nomML <= 15000) t_ml = 150.0;
    else t_ml = nomML * 0.01;

    return (nomML > 1000 ? Math.ceil(t_ml) : (Math.ceil(t_ml * 10) / 10)) / 1000;
};

export const getPalletSize = (recipe) => {
    if (Math.abs(recipe - 0.33) < 0.01) return 2400; 
    if (Math.abs(recipe - 0.50) < 0.01) return 1200; 
    if (Math.abs(recipe - 1.50) < 0.01) return 600;
    if (Math.abs(recipe - 2.00) < 0.01) return 400;  
    return 1000; 
};

export const initStats = () => ({ count: 0, volume: 0.0, giveawayVol: 0.0, underfillVol: 0.0, savingsVol: 0.0, mean: 0.0, M2: 0.0, stdDev: 0.0, t1Errors: 0, t2Errors: 0 });
export const getCurrentShift = () => { const h = new Date().getHours(); return h >= 6 && h < 14 ? 'MORNING' : h >= 14 && h < 22 ? 'AFTERNOON' : 'NIGHT'; };

export const applyStiction = (targetMV, actualMV, stickSlipPct) => {
    const delta = targetMV - actualMV;
    if (Math.abs(delta) > stickSlipPct) return targetMV; 
    return actualMV; 
};

export const SupervisoryAPC = {
    // BRANCH A: THERMAL IMC 
    solveThermal: (targetTemp, internalTemp, currentSteamMV, steamHistory, biasTemp, dt, flowFF = 0) => {
        const Np = 60; 
        const tau = 3.75; const theta = 0.85; 
        const thetaSteps = Math.floor(theta / dt);
        const a = Math.exp(-dt / tau);
        
        const safeTargetTemp = targetTemp || 75.0; 
        const getHist = (ticks) => steamHistory[Math.max(0, steamHistory.length - 1 - ticks)] || currentSteamMV;

        const simulateCost = (u_cand) => {
            let cost = 0;
            let temp = internalTemp; 
            for(let k = 1; k <= Np; k++) {
                let past_u = k <= thetaSteps ? getHist(thetaSteps - k) : u_cand;
                
                // FIX 1: Split-Range Cooling & Heating Logic (Below 45% runs a chiller down to 2 degrees)
                const thermal_effect = past_u >= 0.45 ? ((past_u - 0.45) / 0.55) * 80 : ((past_u - 0.45) / 0.45) * 18;
                const steadyStateTemp = 20 + thermal_effect - (flowFF * 5);
                
                temp = a * temp + (1 - a) * steadyStateTemp;
                const pred_temp = temp + biasTemp; 
                
                // Normalized error prevents tiny numbers from exploding
                const e = (safeTargetTemp - pred_temp) / 100.0;
                cost += (e * e) * (k / Np); 
            }
            return (cost / Np) + 0.05 * Math.pow(u_cand - currentSteamMV, 2);
        };

        // FIX 2: Elite Two-Pass Grid Search (100% immune to gradient momentum traps)
        let best_u = currentSteamMV;
        let min_cost = Infinity;
        for (let u = 0.0; u <= 1.0; u += 0.05) {
            const cost = simulateCost(u);
            if (cost < min_cost) { min_cost = cost; best_u = u; }
        }

        let u_opt = best_u;
        let fine_min_cost = min_cost;
        const lower = Math.max(0.0, best_u - 0.05);
        const upper = Math.min(1.0, best_u + 0.05);
        for (let u = lower; u <= upper; u += 0.005) {
            const cost = simulateCost(u);
            if (cost < fine_min_cost) { fine_min_cost = cost; u_opt = u; }
        }

        const trajectory = [];
        let temp = internalTemp;
        for(let k = 1; k <= Np; k++) {
             let past_u = k <= thetaSteps ? getHist(thetaSteps - k) : u_opt;
             const thermal_effect = past_u >= 0.45 ? ((past_u - 0.45) / 0.55) * 80 : ((past_u - 0.45) / 0.45) * 18;
             const steadyStateTemp = 20 + thermal_effect - (flowFF * 5);
             temp = a * temp + (1 - a) * steadyStateTemp;
             trajectory.push(temp + biasTemp);
        }

        return { steamMV: u_opt, trajectory };
    },

    // BRANCH B: FLOW MPC 
    solveValve: (targetMass, currentMV, imc_y_state, couplingTraj, sgProfile, pDistVol, biasMass, gain, tau, lambda_tuning, dt) => {
        if (targetMass <= 0.0001) return 0;
        
        const Np = 60;
        const a = Math.exp(-dt / Math.max(0.01, tau));
        const lambda = Math.max(lambda_tuning * 0.1, 0.001);

        const simulateCost = (u_cand) => {
            let cost = 0;
            let y = imc_y_state; 
            
            let u_eff = (u_cand - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV);
            if (u_eff < 0) u_eff = 0; 
            
            for(let k=0; k<Np; k++) {
                y = a * y + (1 - a) * (gain * VALVE_CAPACITY_VOL * u_eff);
                const coupling_y = couplingTraj ? couplingTraj[k] : 0;
                
                // FIX 3: Keep gradient alive even if mathematically negative so Valve 2 breaks the deadband!
                const pred_vol_raw = y + coupling_y + pDistVol; 
                
                const safeSG = (sgProfile && sgProfile[k]) ? sgProfile[k] : 1.0;
                const pred_mass = (pred_vol_raw * safeSG) + biasMass;
                
                // FIX 4: Soften gradient division so tiny recipes (0.33L) don't explode the solver
                const err = (targetMass - pred_mass) / Math.max(0.5, targetMass);
                cost += (err * err) * ((k+1) / Np);
            }
            return (cost / Np) + lambda * Math.pow(u_cand - currentMV, 2);
        };

        let best_u = currentMV;
        let min_cost = simulateCost(currentMV);
        
        for (let u = 0.0; u <= 1.0; u += 0.02) {
            const cost = simulateCost(u);
            if (cost < min_cost) { min_cost = cost; best_u = u; }
        }

        let u_opt = best_u;
        let fine_min_cost = min_cost;
        const lower = Math.max(0.0, best_u - 0.02);
        const upper = Math.min(1.0, best_u + 0.02);
        for (let u = lower; u <= upper; u += 0.002) {
            const cost = simulateCost(u);
            if (cost < fine_min_cost) { fine_min_cost = cost; u_opt = u; }
        }
        
        return u_opt;
    }
};
