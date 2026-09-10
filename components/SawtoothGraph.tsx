import React from 'react';

interface SawtoothGraphProps {
  maxStock: number;
  minStock: number;
  rol: number;
  eoq: number;
  leadTimeAvg: number;
  avgConsumption: number;
}

const SawtoothGraph: React.FC<SawtoothGraphProps> = ({
  maxStock, minStock, rol, eoq, leadTimeAvg, avgConsumption
}) => {
  // If no consumption or invalid data, don't try to draw it perfectly
  if (avgConsumption <= 0 || maxStock <= 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Insufficient data for graph</div>;
  }

  // Time to consume EOQ (one cycle length)
  const cycleTime = Math.max(1, eoq / avgConsumption); 
  
  // Create 3 cycles for the visualization
  const cycles = 3;
  const totalTime = cycleTime * cycles;

  const width = 600;
  const height = 200;
  const paddingX = 50;
  const paddingY = 20;

  const graphW = width - paddingX * 2;
  const graphH = height - paddingY * 2;

  // Scale functions
  const scaleX = (time: number) => paddingX + (time / totalTime) * graphW;
  const scaleY = (qty: number) => height - paddingY - (qty / maxStock) * graphH;

  // Generate path for the sawtooth
  let path = `M ${scaleX(0)} ${scaleY(maxStock)}`;
  for (let i = 0; i < cycles; i++) {
    const tStart = i * cycleTime;
    const tEnd = (i + 1) * cycleTime;
    
    // Line down to min stock
    path += ` L ${scaleX(tEnd)} ${scaleY(minStock)}`;
    // Line straight up to max stock (delivery arrives)
    if (i < cycles - 1) {
       path += ` L ${scaleX(tEnd)} ${scaleY(maxStock)}`;
    }
  }

  const yMax = scaleY(maxStock);
  const yMin = scaleY(minStock);
  const yRol = scaleY(rol);
  const yZero = scaleY(0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-full max-w-2xl mx-auto my-4">
      <h3 className="text-sm font-bold text-gray-700 mb-2 text-center">Inventory Depletion Cycle (Ideal Model)</h3>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {/* Axes */}
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#cbd5e1" strokeWidth="2" />

        {/* Level Lines */}
        <line x1={paddingX} y1={yMax} x2={width - paddingX} y2={yMax} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" />
        <text x={paddingX - 5} y={yMax + 4} fontSize="10" fill="#ef4444" textAnchor="end" fontWeight="bold">Max</text>

        <line x1={paddingX} y1={yRol} x2={width - paddingX} y2={yRol} stroke="#eab308" strokeWidth="1" strokeDasharray="4,4" />
        <text x={paddingX - 5} y={yRol + 4} fontSize="10" fill="#eab308" textAnchor="end" fontWeight="bold">ROL</text>

        <line x1={paddingX} y1={yMin} x2={width - paddingX} y2={yMin} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" />
        <text x={paddingX - 5} y={yMin + 4} fontSize="10" fill="#3b82f6" textAnchor="end" fontWeight="bold">Min</text>

        {/* Buffer Stock Area */}
        <rect x={paddingX} y={yMin} width={graphW} height={yZero - yMin} fill="#3b82f6" fillOpacity="0.1" />
        <text x={width - paddingX - 10} y={(yMin + yZero)/2 + 4} fontSize="10" fill="#3b82f6" textAnchor="end" fontWeight="bold">Buffer Stock</text>

        {/* Sawtooth Path */}
        <path d={path} fill="none" stroke="#0f172a" strokeWidth="2" />

        {/* Lead Time Annotations for the first cycle */}
        {leadTimeAvg > 0 && leadTimeAvg < cycleTime && (
          <g>
            <line 
              x1={scaleX(cycleTime - leadTimeAvg)} 
              y1={yRol} 
              x2={scaleX(cycleTime - leadTimeAvg)} 
              y2={yZero + 10} 
              stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" 
            />
            <line 
              x1={scaleX(cycleTime)} 
              y1={yMin} 
              x2={scaleX(cycleTime)} 
              y2={yZero + 10} 
              stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" 
            />
            
            <path d={`M ${scaleX(cycleTime - leadTimeAvg)} ${yZero + 5} L ${scaleX(cycleTime)} ${yZero + 5}`} fill="none" stroke="#64748b" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
            <text x={scaleX(cycleTime - leadTimeAvg / 2)} y={yZero + 15} fontSize="9" fill="#64748b" textAnchor="middle">Lead Time</text>
            
            <circle cx={scaleX(cycleTime - leadTimeAvg)} cy={yRol} r="3" fill="#eab308" />
            <text x={scaleX(cycleTime - leadTimeAvg) - 5} y={yRol - 5} fontSize="9" fill="#eab308" textAnchor="end">Order Placed</text>
            
            <circle cx={scaleX(cycleTime)} cy={yMin} r="3" fill="#3b82f6" />
          </g>
        )}

        {/* Axis Labels */}
        <text x={paddingX / 2} y={height / 2} fontSize="10" fill="#64748b" textAnchor="middle" transform={`rotate(-90, ${paddingX / 2}, ${height / 2})`}>Quantity (Units)</text>
        <text x={width / 2} y={height - 2} fontSize="10" fill="#64748b" textAnchor="middle">Time (Weeks)</text>

        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};

export default SawtoothGraph;
