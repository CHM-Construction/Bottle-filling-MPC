import { useEffect, useRef, useCallback } from 'react';
import { engine } from '../store/physicsStore';
import { 
    TICK_RATE_MS, NOMINAL_PRESSURE, VALVE_DEADBAND, 
    BOTTLE_GENERATION_TICKS, CONTROL_BATCH_SIZE, PRODUCTS, 
    ZERO_POINT_MV, VALVE_CAPACITY_VOL, MAX_DELTA_MV, 
    BELT_SPEED_PPS, HISTORY_BUFFER_SIZE, RECOVERY_CYCLES 
} from '../utils/constants';
import { SupervisoryAPC, applyStiction, getTolerableDeficiency } from '../utils/apcEngine';

export function genPath(data, key, targetVal, baseRecipeVol, isTemp = false) {
    if (data.length < 2) return "";
    const stepX = 1000 / (HISTORY_BUFFER_SIZE - 1);
    let pixelsPerUnit = isTemp ? 50 / 5.0 : 20 / getTolerableDeficiency(baseRecipeVol);
    
    const points = data.map((d, i) => {
      const displayIndex = data.length - 1 - i;
      const xPos = 1000 - (displayIndex * stepX); 
      const lowerBound = targetVal - (60 / pixelsPerUnit);
      const upperBound = targetVal + (60 / pixelsPerUnit);
      const val = Math.max(lowerBound, Math.min(upperBound, d[key] || targetVal));
      const y = 50 - ((val - targetVal) * pixelsPerUnit); 
      return `${xPos.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${points.join(" L ")}`;
}

export function useSimulationLoop({ isLoggedIn, s1PathRef, s2PathRef, cwPathRef, tempPathRef, conveyorRef }) {
    const prevTimeRef = useRef(); 
    const accRef = useRef(0); 
    const requestRef = useRef();

    const runPhysicsTick = useCallback(() => {
        engine.mutate(P => {
            if (P.eStopActive || P.silState === 'E_STOP') {
                P.mvs.mv1 = 0; P.mvs.mv2 = 0; P.mvs.steam = 0; P.pvsMass.s1 *= 0.9; P.pvsMass.s2 *= 0.9; P.cipTemp = Math.max(25, P.cipTemp - 0.1); P.lastTick = Date.now(); return; 
            }

            const activeTargetTemp = P.activeProduct?.targetTemp || 72.0;

            // --- ADAPTIVE AUTO-TUNING ROUTINE ---
            if (P.tuningMode === 'AUTO') {
                const keys = Object.keys(P.tuning);
                keys.forEach(k => {
                    const delta = P.ideal_tuning[k] - P.tuning[k];
                    if (Math.abs(delta) > 0.001) P.tuning[k] += delta * 0.02; // Converge back to physical truth
                });
            }
            if (P.silState === 'MPC_LOST') return;
            
            const now = Date.now(); const dt_sec = (now - P.lastTick) / 1000.0 || (TICK_RATE_MS/1000.0); P.lastTick = now; 
            const T = P.tuning; const noise = () => (Math.random() - 0.5) * 0.005; 
  
            if (P.cipMode) {
                const alphaT = Math.exp(-dt_sec / 2.0); P.cipTemp = alphaT * P.cipTemp + (1 - alphaT) * 95.0 + noise()*100; return; 
            } else P.cipTemp = Math.max(25, P.cipTemp - 0.05);
  
            const dynamicPressureDrop = (P.actual_mvs.mv1 + P.actual_mvs.mv2) * 0.8; 
            P.pneumaticHealth = NOMINAL_PRESSURE - dynamicPressureDrop + (Math.random() - 0.5) * 0.1;
            const pressureDisturbance = P.pneumaticHealth - NOMINAL_PRESSURE;
  
            P.ambientTemp = 23.5 + 8.5 * Math.sin(((now / 30000) % 24 - 8) * (Math.PI / 12)); 
  
            P.mv_hist.mv1.push(P.actual_mvs.mv1); P.mv_hist.mv2.push(P.actual_mvs.mv2); P.mv_hist.steam.push(P.actual_mvs.steam);
            if (P.mv_hist.mv1.length > 50) P.mv_hist.mv1.shift(); if (P.mv_hist.mv2.length > 50) P.mv_hist.mv2.shift(); if (P.mv_hist.steam.length > 50) P.mv_hist.steam.shift();
  
            P.req_mv_hist.mv1.push(P.mvs.mv1); P.req_mv_hist.mv2.push(P.mvs.mv2); P.req_mv_hist.steam.push(P.mvs.steam);
            if (P.req_mv_hist.mv1.length > 50) P.req_mv_hist.mv1.shift(); if (P.req_mv_hist.mv2.length > 50) P.req_mv_hist.mv2.shift(); if (P.req_mv_hist.steam.length > 50) P.req_mv_hist.steam.shift();
  
            const getU = (hist, delaySec) => hist[Math.max(0, hist.length - 1 - Math.floor(delaySec / (TICK_RATE_MS / 1000)))] || 0;
  
            // THERMAL PHYSICS
            const a_temp = Math.exp(-dt_sec / 3.75); 
            const u_steam_plant = getU(P.mv_hist.steam, 0.85); 
            const plantFlowLoad = (P.actual_mvs.mv1 + P.actual_mvs.mv2);
            
            P.plant.temp_y = a_temp * P.plant.temp_y + (1 - a_temp) * (20 + (u_steam_plant * 100) - (plantFlowLoad * 15));
            P.pvsTemp = P.plant.temp_y + P.drift.temp + noise() * 10;
  
            const u_steam_req = getU(P.req_mv_hist.steam, 0.85);
            const reqFlowLoad = (P.mvs.mv1 + P.mvs.mv2);
            P.internal_model.temp_y = a_temp * P.internal_model.temp_y + (1 - a_temp) * (20 + (u_steam_req * 100) - (reqFlowLoad * 15));
            
            const imc_pvsTemp = P.internal_model.temp_y;
            const rawTempDisturbance = P.pvsTemp - imc_pvsTemp;
            const filterAlpha = Math.exp(-dt_sec / 2.0); 
            P.biases.temp = filterAlpha * P.biases.temp + (1 - filterAlpha) * rawTempDisturbance;
  
            let tempTrajectory = new Array(60).fill(P.pvsTemp);
            if (P.opMode === 'AUTO' && P.silState === 'NORMAL') {
                const thermalOutput = SupervisoryAPC.solveThermal(
                    activeTargetTemp, P.internal_model.temp_y, P.mvs.steam, P.req_mv_hist.steam, P.biases.temp, dt_sec, reqFlowLoad
                );
                P.mvs.steam = thermalOutput.steamMV;
                tempTrajectory = thermalOutput.trajectory;
                P.projectedTemp = tempTrajectory[tempTrajectory.length - 1];
            }
  
            const tempDelta = P.pvsTemp - 20.0;
            const dynamicSG_Base = PRODUCTS[0].sg20 / (1 + PRODUCTS[0].thermalExp * tempDelta);
            const dynamicSG_Active = P.activeProduct.sg20 / (1 + P.activeProduct.thermalExp * tempDelta);
            P.dynamicSG = (dynamicSG_Base * (1 - P.activeProduct.ratio)) + (dynamicSG_Active * P.activeProduct.ratio);
  
            const targetMassS1 = P.targetVol * (1 - P.activeProduct.ratio) * PRODUCTS[0].sg20;
            const targetMassS2 = P.targetVol * P.activeProduct.ratio * P.activeProduct.sg20;
  
            // FLOW MPC
            if (P.opMode === 'AUTO' && P.silState === 'NORMAL') {
                P.scanBuffer.push(1);
                if (P.scanBuffer.length >= CONTROL_BATCH_SIZE) {
                    const sgBaseProfile = tempTrajectory.map(t => PRODUCTS[0].sg20 / (1 + PRODUCTS[0].thermalExp * (t - 20.0)));
                    const sgActiveProfile = tempTrajectory.map(t => P.activeProduct.sg20 / (1 + P.activeProduct.thermalExp * (t - 20.0)));
                    
                    const p_dist_vol_s1 = P.active.s1 ? (pressureDisturbance * 0.05) : 0;
                    const p_dist_vol_s2 = P.active.s2 ? (pressureDisturbance * 0.05) : 0;
  
                    const limit = (o, n) => Math.max(0, Math.min(1, o + Math.max(-MAX_DELTA_MV, Math.min(MAX_DELTA_MV, n - o))));
  
                    if (P.active.s1) {
                        P.mvs.mv1 = limit(P.mvs.mv1, SupervisoryAPC.solveValve(
                            targetMassS1, P.mvs.mv1, P.internal_model.y11, null,
                            sgBaseProfile, p_dist_vol_s1, P.biases.s1, T.gain_s1, T.tau_11, T.imcLambda, dt_sec
                        ));
                    } else P.mvs.mv1 = 0;
  
                    const getCouplingTrajectory = () => {
                        const traj = [];
                        let temp_y21 = P.internal_model.y21;
                        const a21 = Math.exp(-dt_sec / Math.max(0.01, T.tau_21));
                        const thetaSteps = Math.floor(T.dt_21 / dt_sec);
                        
                        for (let k = 1; k <= 60; k++) {
                            let past_u1 = k <= thetaSteps ? (P.req_mv_hist.mv1[Math.max(0, P.req_mv_hist.mv1.length - 1 - (thetaSteps - k))] || P.mvs.mv1) : P.mvs.mv1;
                            const past_u1_eff = Math.max(0, (past_u1 - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
                            temp_y21 = a21 * temp_y21 + (1 - a21) * (T.coupling * VALVE_CAPACITY_VOL * past_u1_eff);
                            traj.push(P.decouplerActive ? temp_y21 : 0);
                        }
                        return traj;
                    };
  
                    if (P.active.s2) {
                        const couplingTraj = getCouplingTrajectory();
                        P.mvs.mv2 = limit(P.mvs.mv2, SupervisoryAPC.solveValve(
                            targetMassS2, P.mvs.mv2, P.internal_model.y22, couplingTraj,
                            sgActiveProfile, p_dist_vol_s2, P.biases.s2, T.gain_s2, T.tau_22, T.imcLambda, dt_sec
                        ));
                    } else P.mvs.mv2 = 0;
  
                    P.scanBuffer = [];
                }
            }
  
            const dither = Math.sin(now / 31.8) * 0.021; 
            P.actual_mvs.mv1 = applyStiction(P.mvs.mv1 + (P.active.s1 ? dither : 0), P.actual_mvs.mv1, VALVE_DEADBAND);
            P.actual_mvs.mv2 = applyStiction(P.mvs.mv2 + (P.active.s2 ? dither : 0), P.actual_mvs.mv2, VALVE_DEADBAND);
            P.actual_mvs.steam = applyStiction(P.mvs.steam + dither, P.actual_mvs.steam, VALVE_DEADBAND);
  
            const I = P.ideal_tuning; 
            const a11_true = Math.exp(-dt_sec / Math.max(0.01, I.tau_11)); 
            const a22_true = Math.exp(-dt_sec / Math.max(0.01, I.tau_22)); 
            const a21_true = Math.exp(-dt_sec / Math.max(0.01, I.tau_21));

            const u1_eff_plant = Math.max(0, (P.actual_mvs.mv1 - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
            const u2_eff_plant = Math.max(0, (P.actual_mvs.mv2 - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
            const u1_delayed_eff_plant = Math.max(0, (getU(P.mv_hist.mv1, I.dt_21) - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
  
            P.plant.y11 = a11_true * P.plant.y11 + (1 - a11_true) * (I.gain_s1 * VALVE_CAPACITY_VOL * u1_eff_plant);
            P.plant.y22 = a22_true * P.plant.y22 + (1 - a22_true) * (I.gain_s2 * VALVE_CAPACITY_VOL * u2_eff_plant);
            P.plant.y21 = a21_true * P.plant.y21 + (1 - a21_true) * (I.coupling * VALVE_CAPACITY_VOL * u1_delayed_eff_plant);

            const a11 = Math.exp(-dt_sec / Math.max(0.01, T.tau_11)); 
            const a22 = Math.exp(-dt_sec / Math.max(0.01, T.tau_22)); 
            const a21 = Math.exp(-dt_sec / Math.max(0.01, T.tau_21));

            const u1_req_eff = Math.max(0, (P.mvs.mv1 - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
            const u2_req_eff = Math.max(0, (P.mvs.mv2 - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV));
            const u1_req_delayed_eff = Math.max(0, (getU(P.req_mv_hist.mv1, T.dt_21) - ZERO_POINT_MV) / (1.0 - ZERO_POINT_MV)); 
            
            P.internal_model.y11 = a11 * P.internal_model.y11 + (1 - a11) * (T.gain_s1 * VALVE_CAPACITY_VOL * u1_req_eff);
            P.internal_model.y22 = a22 * P.internal_model.y22 + (1 - a22) * (T.gain_s2 * VALVE_CAPACITY_VOL * u2_req_eff);
            P.internal_model.y21 = a21 * P.internal_model.y21 + (1 - a21) * (T.coupling * VALVE_CAPACITY_VOL * u1_req_delayed_eff);
            
            const p_dist_vol_s1 = P.active.s1 ? (pressureDisturbance * 0.05) : 0;
            const p_dist_vol_s2 = P.active.s2 ? (pressureDisturbance * 0.05) : 0;
  
            P.pvsVol.s1 = Math.max(0, P.plant.y11 + p_dist_vol_s1 + P.loads.s1 + P.drift.s1 + noise());
            P.pvsVol.s2 = Math.max(0, P.plant.y22 + P.plant.y21 + p_dist_vol_s2 + P.loads.s2 + P.drift.s2 + noise());
  
            P.pvsMass.s1 = P.pvsVol.s1 * dynamicSG_Base;
            P.pvsMass.s2 = P.pvsVol.s2 * dynamicSG_Active;
  
            P.pssVol = { 
                pss1: P.active.s1 ? P.internal_model.y11 + p_dist_vol_s1 + (P.biases.s1 / PRODUCTS[0].sg20) : 0, 
                pss2: P.active.s2 ? P.internal_model.y22 + P.internal_model.y21 + p_dist_vol_s2 + (P.biases.s2 / P.activeProduct.sg20) : 0 
            };
  
            P.tickCounter++;
            if (P.tickCounter >= BOTTLE_GENERATION_TICKS) {
                P.tickCounter = 0; P.nextSource = 'MIX';
                
                const imcTempDelta = P.internal_model.temp_y - 20.0;
                const imcSG_Base = PRODUCTS[0].sg20 / (1 + PRODUCTS[0].thermalExp * imcTempDelta);
                const imcSG_Active = P.activeProduct.sg20 / (1 + P.activeProduct.thermalExp * imcTempDelta);
  
                const predVol1 = P.active.s1 ? P.internal_model.y11 + p_dist_vol_s1 : 0;
                const predVol2 = P.active.s2 ? P.internal_model.y22 + P.internal_model.y21 + p_dist_vol_s2 : 0;
                const dynamicPredictedMass = (predVol1 * imcSG_Base) + (predVol2 * imcSG_Active);
  
                if (P.active.s1 || P.active.s2) {
                    const bottleId = `${now}-${Math.floor(Math.random()*1000)}`;
                    P.conveyor.push({ id: bottleId, source: P.nextSource, weightMass: P.pvsMass.s1 + P.pvsMass.s2, currentTemp: P.pvsTemp, position: 0.0, mvSnapshot: { mv1: P.mvs.mv1, mv2: P.mvs.mv2 } });
                    P.smithBuffer.push({ id: bottleId, predictedMass: dynamicPredictedMass });
                }
            }
  
            let bottleAtSensor = null; const nextConveyor = [];
            P.conveyor.forEach(bot => {
                const nextPos = bot.position + BELT_SPEED_PPS;
                if (bot.position < 85.0 && nextPos >= 85.0) bottleAtSensor = bot;
                if (nextPos < 110.0) { bot.position = nextPos; nextConveyor.push(bot); }
            });
            P.conveyor = nextConveyor;
  
            if (bottleAtSensor) {
                const measuredMass = bottleAtSensor.weightMass + noise(); 
                
                const combinedTargetMass = targetMassS1 + targetMassS2;
                const smithRecord = P.smithBuffer.find(b => b.id === bottleAtSensor.id);
                const delayedPredMass = smithRecord ? smithRecord.predictedMass : combinedTargetMass;
                P.smithBuffer = P.smithBuffer.filter(b => b.id !== bottleAtSensor.id); 
                
                const rawDisturbance = measuredMass - delayedPredMass;
  
                let { x_est, p_est, q, r } = P.kalman;
                let p_pred = p_est + q;
                const k_gain = p_pred / (p_pred + r);
                x_est = x_est + k_gain * (rawDisturbance - x_est);
                p_est = (1 - k_gain) * p_pred;
                P.kalman = { x_est, p_est, q, r };
                
                const trueDisturbanceMass = x_est; 
                const filteredMass = delayedPredMass + trueDisturbanceMass; 
  
                const legalSg20Mix = (PRODUCTS[0].sg20 * (1 - P.activeProduct.ratio)) + (P.activeProduct.sg20 * P.activeProduct.ratio);
                const measuredVol = filteredMass / legalSg20Mix; 
                P.pvsVol.cw = measuredVol; P.pvsMass.cw = filteredMass;
  
                if (P.opMode === 'AUTO') {
                    const safeCombinedTarget = combinedTargetMass || 1;
                    const maxBias = combinedTargetMass * 0.15;
                    
                    const targetBias1 = trueDisturbanceMass * (targetMassS1/safeCombinedTarget);
                    const targetBias2 = trueDisturbanceMass * (targetMassS2/safeCombinedTarget);
  
                    P.biases.s1 = Math.max(-maxBias, Math.min(maxBias, (P.biases.s1 * (1 - T.bias_filter)) + (targetBias1 * T.bias_filter)));
                    P.biases.s2 = Math.max(-maxBias, Math.min(maxBias, (P.biases.s2 * (1 - T.bias_filter)) + (targetBias2 * T.bias_filter)));
  
                    const botVol = P.pvsVol.cw;
                    const T_val_vol = getTolerableDeficiency(P.baseRecipeVol);
                    const T1_limit_vol = P.baseRecipeVol - T_val_vol;
                    const T2_limit_vol = P.baseRecipeVol - (2 * T_val_vol);
                    
                    let giveawayVol = 0; let underfillVol = 0; let savingsVol = 0;
                    if (botVol > P.baseRecipeVol) giveawayVol = botVol - P.baseRecipeVol; 
                    else if (botVol >= T1_limit_vol) savingsVol = P.baseRecipeVol - botVol; 
                    else underfillVol = P.baseRecipeVol - botVol; 
  
                    const accumulate = (stats) => {
                        stats.count++; stats.volume += botVol; stats.giveawayVol += giveawayVol;
                        stats.underfillVol += underfillVol; stats.savingsVol += savingsVol;
                        const delta = botVol - stats.mean; stats.mean += delta / stats.count;
                        stats.M2 += delta * (botVol - stats.mean);
                        stats.stdDev = stats.count > 1 ? Math.sqrt(stats.M2 / (stats.count - 1)) : 0.0;
                    };
                    
                    if (Math.abs(P.pvsTemp - activeTargetTemp) < 3.0) {
                        accumulate(P.batchStats); accumulate(P.shiftStats[P.currentShift]); accumulate(P.dayStats);
                        P.lastVolumes.push(botVol); if (P.lastVolumes.length > 120) P.lastVolumes.shift(); 
  
                        const activeRun = P.recipeRuns.length > 0 ? P.recipeRuns[P.recipeRuns.length - 1] : null;
                        if(activeRun) {
                            activeRun.count++; activeRun.volume += botVol;
                            activeRun.giveawayVol += giveawayVol; activeRun.wasteVol += underfillVol; activeRun.savingsVol += savingsVol;
                        }
  
                        P.cloudQueue.push({ t: now, v: botVol, m: P.pvsMass.cw, p: P.activeProduct.id });
                        P.cloudQueueSize = P.cloudQueue.length;
                        P.counters.total++; 
                        
                        if (botVol < T2_limit_vol) { P.batchStats.t2Errors++; P.counters.under++; if(activeRun) activeRun.t2Errors++; } 
                        else if (botVol < T1_limit_vol) { P.batchStats.t1Errors++; P.counters.under++; if(activeRun) activeRun.t1Errors++; } 
                        else if (botVol > P.baseRecipeVol) { P.counters.over++; }
                    }
                }
            }
            
            if (!P.trendFrozen && P.pvsVol.cw > 0.05) { 
                const baseVolS1 = targetMassS1 / PRODUCTS[0].sg20;
                const baseVolS2 = targetMassS2 / (targetMassS2 > 0 ? P.activeProduct.sg20 : 1);
                P.history.push({ 
                    s1_dev: P.targetVol + (P.pvsVol.s1 - baseVolS1), 
                    s2_dev: P.targetVol + (P.pvsVol.s2 - baseVolS2), 
                    cw_vol: P.pvsVol.cw, 
                    temp: P.pvsTemp,
                    t: now 
                }); 
                if (P.history.length > HISTORY_BUFFER_SIZE) P.history.shift(); 
            }
            if (P.silState === 'RECOVERY' && bottleAtSensor) {
                P.recoveryStep++;
                if (P.recoveryStep >= RECOVERY_CYCLES) { P.silState = 'NORMAL'; P.recoveryStep = 0; }
            }
        });
    }, []);

    const renderVisuals = useCallback((P) => {
        const visualTargetTemp = P.activeProduct?.targetTemp || 72.0; 
        
        if (s1PathRef.current && s2PathRef.current && cwPathRef.current && tempPathRef.current && P.history.length > 1) {
            s1PathRef.current.setAttribute('d', genPath(P.history, 's1_dev', P.targetVol, P.baseRecipeVol));
            s2PathRef.current.setAttribute('d', genPath(P.history, 's2_dev', P.targetVol, P.baseRecipeVol));
            cwPathRef.current.setAttribute('d', genPath(P.history, 'cw_vol', P.targetVol, P.baseRecipeVol));
            tempPathRef.current.setAttribute('d', genPath(P.history, 'temp', visualTargetTemp, P.baseRecipeVol, true));
        }
        
        if (conveyorRef.current) {
            const container = conveyorRef.current;
            const bottles = P.conveyor;
            const T_val_vol = getTolerableDeficiency(P.baseRecipeVol);
            const pixelsPerL = 20 / T_val_vol; 
            const divertMode = Math.abs(P.pvsTemp - visualTargetTemp) >= 3.0;
  
            while (container.children.length < bottles.length) {
                const div = document.createElement('div');
                div.style.position = 'absolute'; div.style.top = '50%'; div.style.border = '2px solid rgba(255,255,255,0.8)'; 
                div.style.display = 'flex'; div.style.flexDirection = 'column'; div.style.alignItems = 'center';
                div.style.justifyContent = 'flex-end'; div.style.color = 'white'; div.style.fontSize = '8px';
                div.style.fontWeight = 'bold'; div.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.2)';
                div.style.overflow = 'hidden'; div.setAttribute('data-id', '');
                
                const fill = document.createElement('div');
                fill.style.width = '100%'; fill.style.transition = 'height 0.1s ease';
                div.appendChild(fill);
  
                const textSpan = document.createElement('div');
                textSpan.style.position = 'absolute'; textSpan.style.top = '50%'; textSpan.style.transform = 'translateY(-50%)'; textSpan.style.textAlign = 'center';
                div.appendChild(textSpan);
                container.appendChild(div);
            }
            
            while (container.children.length > bottles.length + 10) container.removeChild(container.lastChild);
            for (let i = bottles.length; i < container.children.length; i++) container.children[i].style.display = 'none';
  
            bottles.forEach((bot, i) => {
                const div = container.children[i]; div.style.display = 'flex';
                const fillDiv = div.children[0]; const textDiv = div.children[1];
                
                const botDeltaT = bot.currentTemp - 20.0;
                const botSG_Base = PRODUCTS[0].sg20 / (1 + PRODUCTS[0].thermalExp * botDeltaT);
                const botSG_Active = P.activeProduct.sg20 / (1 + P.activeProduct.thermalExp * botDeltaT);
                const hotSgMix = (botSG_Base * (1 - P.activeProduct.ratio)) + (botSG_Active * P.activeProduct.ratio);
                
                const botHotVol = bot.weightMass / hotSgMix; 
  
                if (div.getAttribute('data-id') !== bot.id) {
                    div.setAttribute('data-id', bot.id);
                    let liquidColor = P.activeProduct.color;
                    if (divertMode) liquidColor = '#64748b'; 
                    else if (botHotVol < P.baseRecipeVol - 2*T_val_vol) liquidColor = '#ef4444'; 
                    else if (botHotVol < P.baseRecipeVol - T_val_vol) liquidColor = '#f59e0b'; 
                    
                    div.style.backgroundColor = '#e2e8f0'; div.style.borderRadius = '4px 4px 2px 2px';
                    div.style.width = '20px'; div.style.height = '42px'; 
                    
                    const fillPct = Math.min(100, Math.max(0, (botHotVol / P.baseRecipeVol) * 100));
                    fillDiv.style.height = `${fillPct}%`; fillDiv.style.backgroundColor = liquidColor;
                    textDiv.innerHTML = `<span style="opacity: 0.75; transform: scale(0.65); display: block; line-height: 1; text-shadow: 0px 1px 2px rgba(0,0,0,0.8);">${divertMode ? 'DUMP' : 'MIX'}</span><span style="font-size:6px; text-shadow: 0px 1px 2px rgba(0,0,0,0.8);">${(botHotVol*1000).toFixed(0)}</span>`;
                }
                
                const partialTick = Math.min(1.0, (Date.now() - P.lastTick) / TICK_RATE_MS);
                const smoothPos = bot.position + (BELT_SPEED_PPS * partialTick);
                const leftPos = 8 + (smoothPos * 0.82);
                const dev = botHotVol - P.targetVol;
                
                const mergeFactor = Math.min(1, Math.max(0, (smoothPos - 70) / 20)); 
                const finalOffset = (0 * (1 - mergeFactor)) - (dev * pixelsPerL); 
                const clampedY = Math.max(-40, Math.min(40, finalOffset)); 
                
                div.style.left = `${leftPos}%`; div.style.transform = `translateY(${clampedY}px) translate(-50%, -50%)`;
            });
        }
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;
        let lastRenderTime = 0;
        
        const animate = (time) => {
            const P = engine.getSnapshot();
            if (prevTimeRef.current !== undefined && P.simMode === 'RUN' && !P.eStopActive) {
                let deltaTime = time - prevTimeRef.current;
                if (deltaTime > 1000) deltaTime = 1000; 
                accRef.current += deltaTime;
                while (accRef.current >= TICK_RATE_MS) { 
                    runPhysicsTick(); 
                    accRef.current -= TICK_RATE_MS; 
                }
            }
            prevTimeRef.current = time;
            renderVisuals(engine.getSnapshot());
            
            if (time - lastRenderTime > 200) {
                engine.mutate(s => { s.riskAlert = s.pvsVol.cw < (s.baseRecipeVol - getTolerableDeficiency(s.baseRecipeVol)); });
                engine.commit(); 
                lastRenderTime = time;
            }
            requestRef.current = requestAnimationFrame(animate);
        };
        
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [isLoggedIn, runPhysicsTick, renderVisuals]);

    return { runPhysicsTick, renderVisuals };
}
