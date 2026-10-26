import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';

// Owns a Chart.js instance: created from `config`, destroyed on change/unmount.
export default function ChartCanvas({ config }) {
  const ref = useRef(null);
  useEffect(() => {
    const chart = new Chart(ref.current.getContext('2d'), config);
    return () => chart.destroy();
  }, [config]);
  return <canvas ref={ref}></canvas>;
}
