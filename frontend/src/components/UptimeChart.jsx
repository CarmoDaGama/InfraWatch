import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function UptimeChart({ uptimeStats }) {
  if (!uptimeStats || uptimeStats.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Uptime Last 24 Hours</h2>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          No data available
        </div>
      </div>
    )
  }

  const data = {
    labels: uptimeStats.map((s) => s.name || s.deviceName || `Device ${s.deviceId}`),
    datasets: [
      {
        label: 'Uptime %',
        data: uptimeStats.map((s) => parseFloat(s.uptimePercent ?? s.uptime ?? 0)),
        backgroundColor: 'rgba(34, 197, 94, 0.75)',
        borderColor: 'rgba(22, 163, 74, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          callback: (v) => `${v}%`,
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        grid: { display: false },
      },
    },
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Uptime Last 24 Hours</h2>
      <Bar data={data} options={options} />
    </div>
  )
}
