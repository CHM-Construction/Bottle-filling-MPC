import React from 'react';
import { MoveRight } from 'lucide-react';

export default function ConveyorVisualizer({ containerRef, itemCount }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 overflow-hidden shrink-0 mt-auto">
            <div className="flex justify-between items-center mb-1">
                <h4 className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <MoveRight size={12}/> Rotary Filler Tracking
                </h4>
                <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                    QUEUE: {itemCount}
                </span>
            </div>
            <div className="h-24 bg-slate-50 rounded-lg relative border border-slate-100 flex items-center overflow-hidden">
               <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:10%_100%]"></div>
               <div className="absolute right-2 top-0 bottom-0 flex items-center z-20">
                   <div className="w-8 h-12 bg-slate-200 border border-slate-300 rounded flex items-center justify-center shadow-inner">
                       <span className="text-[7px] font-bold text-slate-500 -rotate-90">CHECK</span>
                   </div>
               </div>
               <div ref={containerRef} className="absolute inset-0 pointer-events-none"></div>
            </div>
        </div>
    );
}
