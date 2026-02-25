import { ZERO_POINT_MV, VALVE_STROKE_TIME_SEC } from './constants';

export const getTolerableDeficiency = (nomL) => {
    if (Math.abs(nomL - 0.33) < 0.001) return 0.0099; 
    if (Math.abs(nomL - 0.50) < 0.001) return 0.0150; 
    if (Math.abs(nomL - 1.50) < 0.001) return 0.0225; 
    if (Math.abs(nomL - 2.00) < 0.001) return 0.0300; 
    if (Math.abs(nomL - 4.00) < 0.001) return 0.0600;
    return nomL * 0.015;
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
        const Np = 60; const tau = 3.75; const theta = 0.85; const thetaSteps = Math.floor(theta / dt); const a = Math.exp(-dt / tau);
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
        for (let u = 0.0; u <= 1.0; u += 0.05) { const cost = simulateCost(u); if (cost < min_cost) { min_cost = cost; best_u = u; } }
        let u_opt = best_u; let fine_min_cost = min_cost;
        for (let u = Math.max(0, best_u - 0.05); u <= Math.min(1, best_u + 0.05); u += 0.005) { const cost = simulateCost(u); if (cost < fine_min_cost) { fine_min_cost = cost; u_opt = u; } }

        const trajectory = []; let temp = internalTemp;
        for(let k = 1; k <= Np; k++) { 
             let past_u = k <= thetaSteps ? getHist(thetaSteps - k) : u_opt;
             const thermal_effect = past_u >= 0.45 ? ((past_u - 0.45) / 0.55) * 80 : ((past_u - 0.45) / 0.45) * 20;
             temp = a * temp + (1 - a) * (20 + thermal_effect - (flowFF * 5));
             trajectory.push(temp + biasTemp);
        }
        return { steamMV: u_opt, trajectory };
    },

    solveValve: (targetMass, currentMV, imc_y_state, couplingTraj, sgProfile, pDistVol, biasMass, gain, tau, lambda_tuning, dt, capacityLimit) => {
        if (targetMass <= 0.0001) return ZERO_POINT_MV;
        
        const PREDICTION_HORIZON = 15; // T15 Prediction
        const a = Math.exp(-dt / Math.max(0.01, tau));
        
        // 1. MPC Receives Target Shift Cascade from IMC
        const effective_target = targetMass - biasMass;
        const lambda = Math.max(lambda_tuning, 0.005); 

        // 2. The internal math model now understands the physical Valve Slew S-Curve!
        const valve_alpha = Math.exp(-dt / Math.max(0.01, VALVE_STROKE_TIME_SEC));

        const simulateCost = (u_cand) => {
            let cost = 0; let y = imc_y_state; 
            let u_eff_target = Math.max(0, (u_cand - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
            
            // Start the internal simulated valve exactly where the physical valve currently sits
            let simulated_u_eff = Math.max(0, (currentMV - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
            
            // 3. Generate a smooth Reference S-Curve Trajectory
            let ref_y = y + pDistVol + biasMass; 
            const ref_alpha = Math.exp(-dt / 0.6); 

            for(let k = 1; k <= PREDICTION_HORIZON; k++) {
                // Advance Kinematic Valve Pos
                simulated_u_eff = valve_alpha * simulated_u_eff + (1 - valve_alpha) * u_eff_target;
                
                y = a * y + (1 - a) * (gain * capacityLimit * simulated_u_eff);
                const coupling_y = couplingTraj ? (couplingTraj[k-1] || 0) : 0;
                
                const pred_vol = Math.max(0, y + coupling_y + pDistVol); 
                const safeSG = (sgProfile && sgProfile[k-1]) ? sgProfile[k-1] : 1.0;
                const pred_mass = (pred_vol * safeSG);
                
                // Advance S-Curve Target
                ref_y = ref_alpha * ref_y + (1 - ref_alpha) * effective_target;
                
                // L1 NORM ABSOLUTE ERROR (Never flattens out, completely prevents underfill)
                const norm_err = Math.abs(ref_y - pred_mass) / Math.max(0.1, targetMass);
                
                let weight = (k / PREDICTION_HORIZON);
                if (k === 8) weight *= 3.0;   // T8 Coincidence
                if (k === 15) weight *= 6.0;  // T15 Tracking
                
                cost += norm_err * weight; 
            }
            return (cost / PREDICTION_HORIZON) + (lambda * Math.pow(u_cand - currentMV, 2));
        };

        const max_move = 0.20; // Slew limit per tick to prevent jump hunting
        const lower_bound = Math.max(ZERO_POINT_MV, currentMV - max_move);
        const upper_bound = Math.min(1.0, currentMV + max_move);

        let best_u = currentMV; let min_cost = simulateCost(currentMV);
        
        for (let u = lower_bound; u <= upper_bound; u += 0.02) {
            const cost = simulateCost(u); if (cost < min_cost) { min_cost = cost; best_u = u; }
        }

        let u_opt = best_u; let fine_min_cost = min_cost;
        for(let u = Math.max(lower_bound, best_u - 0.02); u <= Math.min(upper_bound, best_u + 0.02); u += 0.002) {
            const cost = simulateCost(u); if (cost < fine_min_cost) { fine_min_cost = cost; u_opt = u; }
        }
        
        return u_opt;
    }
};
