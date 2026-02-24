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

// ==========================================
// ELITE SUPERVISORY CASCADE IMC ENGINE
// ==========================================
export const SupervisoryAPC = {
    // BRANCH A: THERMAL IMC (Delay-Free Prediction + Bias + Flow Feedforward)
    solveThermal: (targetTemp, internalTemp, currentSteamMV, steamHistory, biasTemp, dt, flowFF = 0) => {
        const Np = 60; 
        const tau = 3.75; const theta = 0.85; 
        const thetaSteps = Math.floor(theta / dt);
        const a = Math.exp(-dt / tau);
        
        // Safety fallback for missing recipe values
        const safeTargetTemp = targetTemp || 75.0; 
        const getHist = (ticks) => steamHistory[Math.max(0, steamHistory.length - 1 - ticks)] || currentSteamMV;

        const simulateCost = (u_cand) => {
            let cost = 0;
            let temp = internalTemp; 
            
            for(let k = 1; k <= Np; k++) {
                let past_u = k <= thetaSteps ? getHist(thetaSteps - k) : u_cand;
                
                // TRUE FEEDFORWARD: Preemptively calculates cooling load from incoming liquid
                const steadyStateTemp = 20 + (past_u * 100) - (flowFF * 15);
                temp = a * temp + (1 - a) * steadyStateTemp;
                
                const pred_temp = temp + biasTemp; 
                
                const e = (safeTargetTemp - pred_temp) / safeTargetTemp;
                cost += (e * e) * (k / Np); 
            }
            // Reduced move penalty so the heater accurately targets the setpoint
            return (cost / Np) + 0.05 * Math.pow(u_cand - currentSteamMV, 2);
        };

        let u_opt = currentSteamMV;
        let v_u = 0; const lr = 0.2; const h = 0.001; const beta = 0.85;
        
        for(let i=0; i<20; i++) {
            const currentCost = simulateCost(u_opt);
            const grad = (simulateCost(u_opt + h) - currentCost) / h;
            v_u = beta * v_u + (1 - beta) * grad;
            u_opt = Math.max(0, Math.min(1.0, u_opt - lr * v_u));
        }

        const trajectory = [];
        let temp = internalTemp;
        for(let k = 1; k <= Np; k++) {
             let past_u = k <= thetaSteps ? getHist(thetaSteps - k) : u_opt;
             const steadyStateTemp = 20 + (past_u * 100) - (flowFF * 15);
             temp = a * temp + (1 - a) * steadyStateTemp;
             trajectory.push(temp + biasTemp);
        }

        return { steamMV: u_opt, trajectory };
    },

    // BRANCH B: FLOW MPC (Absolute Physical Model + Future Coupling + SG Feedforward)
    solveValve: (targetMass, currentMV, imc_y_state, couplingTraj, sgProfile, pDistVol, biasMass, gain, tau, lambda_tuning, dt) => {
        if (targetMass <= 0.0001) return 0;
        
        const Np = 60;
        const a = Math.exp(-dt / Math.max(0.01, tau));
        const lambda = Math.max(lambda_tuning * 0.1, 0.001);

        const simulateCost = (u_cand) => {
            let cost = 0;
            let y = imc_y_state; 
            
            // BUG FIX: "Leaky Slope" prevents Gradient Descent from flatlining in the deadband!
            let u_eff = (u_cand - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV);
            if (u_eff < 0) u_eff = u_eff * 0.05; 
            else if (u_eff > 1) u_eff = 1.0 + (u_eff - 1.0) * 0.05;
            
            for(let k=0; k<Np; k++) {
                y = a * y + (1 - a) * (gain * VALVE_CAPACITY_VOL * u_eff);
                
                const coupling_y = couplingTraj ? couplingTraj[k] : 0;
                const pred_vol = y + coupling_y + pDistVol; 
                
                const safeSG = (sgProfile && sgProfile[k]) ? sgProfile[k] : 1.0;
                const pred_mass = (pred_vol * safeSG) + biasMass;
                
                const err = (targetMass - pred_mass) / (targetMass || 1);
                cost += (err * err) * ((k+1) / Np);
            }
            return (cost / Np) + lambda * Math.pow(u_cand - currentMV, 2);
        };

        let u_opt = currentMV;
        let v = 0; const beta = 0.85; const h = 0.001; const lr = 0.2;
        
        for(let i=0; i<25; i++) {
            const currentCost = simulateCost(u_opt);
            const grad = (simulateCost(u_opt + h) - currentCost) / h;
            v = beta * v + (1 - beta) * grad;
            u_opt = Math.max(0, Math.min(1.0, u_opt - lr * v)); // Clamp result securely at the end
        }
        return u_opt;
    }
};
