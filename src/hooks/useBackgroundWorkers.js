import { useEffect } from 'react';
import { engine } from '../store/physicsStore';
import { WATCHDOG_TIMEOUT_MS } from '../utils/constants';
import { getCurrentShift } from '../utils/apcEngine';

export function useBackgroundWorkers(isLoggedIn, silState) {
    // 1. Shift Rotation Worker
    useEffect(() => {
        const shiftWorker = setInterval(() => { 
            engine.mutate(s => { s.currentShift = getCurrentShift(); }); 
            engine.commit(); 
        }, 60000); 
        return () => clearInterval(shiftWorker);
    }, []);

    // 2. Cloud Sync Telemetry Worker
    useEffect(() => {
        if (!isLoggedIn) return;
        const cloudWorker = setInterval(() => {
            engine.mutate(P => {
                if (P.cloudQueue && P.cloudQueue.length > 0 && Math.random() > 0.1) { 
                    P.cloudSyncStatus = 'SYNCING';
                    P.cloudQueueSize = P.cloudQueue.length;
                    engine.commit();
                    
                    // Simulate network delay
                    setTimeout(() => { 
                        engine.mutate(S => { 
                            S.cloudQueue.splice(0, 50); 
                            S.cloudQueueSize = S.cloudQueue.length; 
                            S.lastSync = Date.now(); 
                            S.cloudSyncStatus = 'IDLE'; 
                        }); 
                        engine.commit(); 
                    }, 400); 
                }
            });
        }, 2000);
        return () => clearInterval(cloudWorker);
    }, [isLoggedIn]);

    // 3. SIL-3 Hardware Watchdog
    useEffect(() => {
      if (!isLoggedIn) return;
      const watchdogInterval = setInterval(() => {
        let state = engine.getSnapshot();
        if (state.simMode === 'RUN' && !state.eStopActive) {
          if (Date.now() - state.lastTick > WATCHDOG_TIMEOUT_MS) {
            if (state.silState !== 'MPC_LOST' && state.silState !== 'RECOVERY' && state.silState !== 'E_STOP') {
                engine.mutate(s => { s.silState = 'MPC_LOST'; s.heartbeatActive = false; });
                engine.commit();
            }
          }
        }
      }, 500); 
      return () => clearInterval(watchdogInterval);
    }, [isLoggedIn]);

    // 4. Auto-Recovery Sequencer (Fixes the permanent freeze)
    useEffect(() => {
      if (silState === 'MPC_LOST') {
          const rebootTimer = setTimeout(() => {
              engine.mutate(P => {
                  P.lastTick = Date.now(); 
                  P.silState = 'RECOVERY'; 
                  P.recoveryStep = 0;
                  P.heartbeatActive = true; 
                  P.scanBuffer = []; 
              });
              engine.commit();
          }, 1500);
          return () => clearTimeout(rebootTimer);
      }
    }, [silState]);
}
