// --- BEVERAGE & FLUID PROFILES ---
export const PRODUCTS = [
    { id: 'WATER', name: 'Spring Water', sg20: 0.998, thermalExp: 0.00021, targetTemp: 15.0, color: '#3b82f6', ratio: 0.00 },
    { id: 'BEER', name: 'Craft Beer', sg20: 1.015, thermalExp: 0.00025, targetTemp: 4.0, color: '#eab308', ratio: 0.00 },
    { id: 'JUICE', name: 'Apple Juice', sg20: 1.045, thermalExp: 0.00030, targetTemp: 72.0, color: '#84cc16', ratio: 0.00 },
    { id: 'SYRUP_MIX', name: 'Carbonated Soda', sg20: 1.080, thermalExp: 0.00035, targetTemp: 3.0, color: '#f59e0b', ratio: 0.18 } 
];

export const RECIPES = [0.33, 0.50, 1.50, 2.00]; 
export const PRICE_PER_KILOLITER = 25000.00; 
export const PRICE_PER_LITER = PRICE_PER_KILOLITER / 1000; 
export const REWORK_COST_PER_UNIT = 1.20; 

export const WATCHDOG_TIMEOUT_MS = 2000; 
export const RECOVERY_CYCLES = 10;        
export const MAX_DELTA_MV = 0.25; 

// PHYSICS & HARDWARE CONFIGURATION
export const TICK_RATE_MS = 100;            
export const BELT_SPEED_PPS = 2.5;          
export const BOTTLE_GENERATION_TICKS = 15;    
export const CONTROL_BATCH_SIZE = 1;        
export const HISTORY_BUFFER_SIZE = 150;    
export const ADC_MAX_COUNTS = 16777215;    
export const ADC_ZERO_OFFSET = 8388608;    
export const VALVE_CAPACITY_VOL = 2.5; // Absolute Max Liters per second

// --- PC-CONTROLAB KERNEL ---
export const ZERO_POINT_MV = 0.450;
export const NOMINAL_PRESSURE = 4.5; 
export const VALVE_DEADBAND = 0.02;
