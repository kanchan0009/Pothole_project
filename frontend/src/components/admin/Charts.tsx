import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { SEVERITY_META, SEVERITY_ORDER } from '../../lib/constants';

// Register Chart.js pieces once (tree-shaken to what these charts need).
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler);

const FONT = 'Inter, system-ui, -apple-system, sans-serif';
const GRID = 'rgba(11, 31, 58, 0.06)';
const TICK = 'rgba(11, 31, 58, 0.55)';

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { color: GRID },
      ticks: { color: TICK, font: { family: FONT, size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: GRID },
      ticks: { color: TICK, font: { family: FONT, size: 11 }, precision: 0 },
    },
  },
};

/** Report volume over time — line chart with a soft area fill. */
export function TrendLine({ labels, data, height = 260 }: { labels: string[]; data: number[]; height?: number }) {
  return (
    <div style={{ height }}>
      <Line
        options={{
          ...BASE_OPTIONS,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#0B1F3A', titleFont: { family: FONT }, bodyFont: { family: FONT } },
          },
        }}
        data={{
          labels,
          datasets: [
            {
              data,
              borderColor: '#00B4D8',
              backgroundColor: 'rgba(0, 180, 216, 0.15)',
              fill: true,
              tension: 0.4,
              borderWidth: 2.5,
              pointRadius: 3,
              pointBackgroundColor: '#00B4D8',
            },
          ],
        }}
      />
    </div>
  );
}

/** Severity distribution — doughnut with spec severity colors. */
export function SeverityDoughnut({ data, height = 260 }: { data: Record<string, number>; height?: number }) {
  return (
    <div style={{ height }}>
      <Doughnut
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: TICK,
                font: { family: FONT, size: 12, weight: 600 },
                padding: 14,
                usePointStyle: true,
                pointStyle: 'circle',
              },
            },
            tooltip: { backgroundColor: '#0B1F3A', titleFont: { family: FONT }, bodyFont: { family: FONT } },
          },
        }}
        data={{
          labels: SEVERITY_ORDER.map((s) => SEVERITY_META[s].label),
          datasets: [
            {
              data: SEVERITY_ORDER.map((s) => data[s] ?? 0),
              backgroundColor: SEVERITY_ORDER.map((s) => SEVERITY_META[s].color),
              borderWidth: 0,
            },
          ],
        }}
      />
    </div>
  );
}

/** Most-complained roads — horizontal bar chart. */
export function TopRoadsBar({ labels, data, height = 260 }: { labels: string[]; data: number[]; height?: number }) {
  return (
    <div style={{ height }}>
      <Bar
        options={{
          ...BASE_OPTIONS,
          indexAxis: 'y' as const,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#0B1F3A', titleFont: { family: FONT }, bodyFont: { family: FONT } },
          },
        }}
        data={{
          labels,
          datasets: [
            {
              data,
              backgroundColor: '#153B6B',
              hoverBackgroundColor: '#00B4D8',
              borderRadius: 6,
              maxBarThickness: 22,
            },
          ],
        }}
      />
    </div>
  );
}
