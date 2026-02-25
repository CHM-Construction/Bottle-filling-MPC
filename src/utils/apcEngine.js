import { ZERO_POINT_MV } from './constants';

export const getTolerableDeficiency = (nomL) => {
    if (Math.abs(nomL - 0.33) < 0.001) return 0.0099; 
    if (Math.abs(nomL - 0.50) < 0.001) return 0.0150; 
    if (Math.abs(nomL - 1.50) < 0.001) return 0.0225; 
    if (Math.abs(nomL - 2.00) < 0.001) return 0.0300; 
    if (Math.abs(nomL - 4.00) < 0.001) return 0.0600;

    const nomML = nomL * 1000;
    let t_ml = 0;
    if (nomML <= 50) t_ml = nomML * 0.09;
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
    if (Math.abs(recipe - 4.00) < 0.01) return 200;  
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
    solveThermal: (targetTemp, internalTemp, currentSteamMV, steamHistory, biasTemp, dt, flowFF = 0) => {
        const Np = 60; 
        const tau = 3.75; const theta = 0.85; 
        const thetaSteps = Math.floor(theta / dt);
        const a = Math.exp(-dt / tau);
        
        const safeTargetTemp = targetTemp || 75.0; 
        const getHist = (ticks) => steamHistory[Math.max(0, steamHistory.length - 1 - ticks)] || currentSteamMV;

        const simulateCost = (u_cand) => {
            let cost = 0; let temp = internalTemp; 
            for(let k = 1; k <= Np; k++) {
                let past_u = k <= thetaSteps ? getHist(thetaSteps - k) : u_cand;
                const thermal_effect = past_u >= 0.45 ? ((past_u - 0.45) / 0.55) * 80 : ((past_u - 0.45) / 0.45) * 20;
                temp = a * temp + (1 - a) * (20 + thermal_effect - (flowFF * 5));
                const e = (safeTargetTemp - (temp + biasTemp)) / 100.0;
                cost += (e * e) * (k / Np); 
            }
            return (cost / Np) + 0.05 * Math.pow(u_cand - currentSteamMV, 2);
        };

        let best_u = currentSteamMV; let min_cost = Infinity;
        for (let u = 0.0; u <= 1.0; u += 0.05) {
            const cost = simulateCost(u);
            if (cost < min_cost) { min_cost = cost; best_u = u; }
        }
        let u_opt = best_u; let fine_min_cost = min_cost;
        for (let u = Math.max(0, best_u - 0.05); u <= Math.min(1, best_u + 0.05); u += 0.005) {
            const cost = simulateCost(u);
            if (cost < fine_min_cost) { fine_min_cost = cost; u_opt = u; }
        }

        const trajectory = []; let temp = internalTemp;
        for(let k = 1; k <= Np; k++) { 
             let past_u = k <= thetaSteps ? getHist(thetaSteps - k) : u_opt;
             const thermal_effect = past_u >= 0.45 ? ((past_u - 0.45) / 0.55) * 80 : ((past_u - 0.45) / 0.45) * 20;
             temp = a * temp + (1 - a) * (20 + thermal_effect - (flowFF * 5));
             trajectory.push(temp + biasTemp);
        }
        return { steamMV: u_opt, trajectory };
    },

    // WORLD CLASS FIX: Integrated T13 / T8 Horizon & Move Suppression Damping
    solveValve: (targetMass, currentMV, imc_y_state, couplingTraj, sgProfile, pDistVol, biasMass, gain, tau, lambda_tuning, dt, capacityLimit) => {
        if (targetMass <= 0.0001) return ZERO_POINT_MV;
        
        const PREDICTION_HORIZON = 13; 
        const a = Math.exp(-dt / Math.max(0.01, tau));
        
        // Massive move-suppression penalty for stability (Damping)
        // The smaller the target, the more suppressed it must be to avoid wild oscillation
        const size_multiplier = targetMass < 0.5 ? 4.0 : 1.0;
        const lambda = Math.max(lambda_tuning, 0.01) * 30.0 * size_multiplier; 

        const simulateCost = (u_cand) => {
            let cost = 0; let y = imc_y_state; 
            let u_eff = Math.max(0, (u_cand - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
            
            for(let k = 1; k <= PREDICTION_HORIZON; k++) {
                y = a * y + (1 - a) * (gain * capacityLimit * u_eff);
                const coupling_y = couplingTraj ? (couplingTraj[k-1] || 0) : 0;
                
                const pred_vol = Math.max(0, y + coupling_y + pDistVol); 
                const safeSG = (sgProfile && sgProfile[k-1]) ? sgProfile[k-1] : 1.0;
                const pred_mass = (pred_vol * safeSG) + biasMass;
                
                const err = (targetMass - pred_mass);
                const norm_err = err / Math.max(0.1, targetMass);
                
                // Enforce T8 and T13 Coincidence Points
                let weight = (k / PREDICTION_HORIZON);
                if (k === 8) weight *= 4.0;   
                if (k === 13) weight *= 8.0;  
                
                cost += (norm_err * norm_err) * weight;
            }
            return (cost / PREDICTION_HORIZON) + (lambda * Math.pow(u_cand - currentMV, 2));
        };

        // Slew-rate limiting to strictly forbid 100% erratic valve swings
        const max_move = 0.15; 
        const lower_bound = Math.max(ZERO_POINT_MV, currentMV - max_move);
        const upper_bound = Math.min(1.0, currentMV + max_move);

        let best_u = currentMV; let min_cost = simulateCost(currentMV);
        
        for (let u = lower_bound; u <= upper_bound; u += 0.02) {
            const cost = simulateCost(u);
            if (cost < min_cost) { min_cost = cost; best_u = u; }
        }

        let u_opt = best_u; let fine_min_cost = min_cost;
        for(let u = Math.max(lower_bound, best_u - 0.02); u <= Math.min(upper_bound, best_u + 0.02); u += 0.002) {
            const cost = simulateCost(u);
            if (cost < fine_min_cost) { fine_min_cost = cost; u_opt = u; }
        }
        
        if (Math.abs(u_opt - currentMV) < 0.005) return currentMV;
        return u_opt;
    }
};
