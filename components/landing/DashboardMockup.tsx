// CSS/SVG-based dashboard preview shown in the Hero section.
// Simulates the TradeDesk technical analysis view without a real screenshot.
export default function DashboardMockup() {
  const chartLine =
    'M0,132 L22,125 L44,115 L66,120 L88,108 L110,98 L132,104 L154,90 L176,82 L198,88 L220,72 L242,60 L264,66 L286,52 L308,42 L330,46 L352,34 L374,24 L396,18 L400,16'
  const chartFill = `${chartLine} L400,150 L0,150 Z`

  return (
    <div
      className="relative w-full max-w-[520px]"
      style={{ filter: 'drop-shadow(0 0 50px rgba(47,128,237,0.12))' }}
    >
      {/* Main window frame */}
      <div className="border border-[#1E2D4A] rounded-[6px] bg-[#0F1729] overflow-hidden">
        {/* Window chrome bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#1E2D4A] bg-[#0A0F1E]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF4D4D]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#00C896]/60" />
          <span className="ml-3 text-[11px] text-[#8A99B3]">TradeDesk — Technical Analysis</span>
        </div>

        <div className="flex">
          {/* Mini sidebar */}
          <div className="w-11 bg-[#0A0F1E] border-r border-[#1E2D4A] flex flex-col items-center py-4 gap-4 shrink-0">
            {[
              { color: '#2F80ED', active: true },
              { color: '#8A99B3', active: false },
              { color: '#8A99B3', active: false },
              { color: '#8A99B3', active: false },
              { color: '#8A99B3', active: false },
              { color: '#8A99B3', active: false },
            ].map((item, i) => (
              <div
                key={i}
                className="w-5 h-1 rounded-sm"
                style={{ backgroundColor: item.color, opacity: item.active ? 1 : 0.4 }}
              />
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-3 min-w-0">
            {/* Ticker row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[#F0F4FF] font-bold text-sm"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  NVDA
                </span>
                <span className="text-[#00C896] text-xs font-medium">$875.40</span>
                <span className="text-[#00C896] text-xs">+3.21%</span>
              </div>
              <div className="flex gap-1">
                {['1D', '1W', '1M', '1Y'].map((t, i) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded-[3px]"
                    style={
                      i === 0
                        ? { backgroundColor: '#2F80ED', color: '#fff' }
                        : { color: '#8A99B3' }
                    }
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Chart area */}
            <div
              className="relative bg-[#0A0F1E] rounded-[4px] mb-3 overflow-hidden"
              style={{ height: 152 }}
            >
              <svg
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="none"
                viewBox="0 0 400 150"
              >
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2F80ED" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#2F80ED" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid */}
                {[30, 60, 90, 120].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="400"
                    y2={y}
                    stroke="#1E2D4A"
                    strokeWidth="0.5"
                  />
                ))}
                {[80, 160, 240, 320].map((x) => (
                  <line
                    key={x}
                    x1={x}
                    y1="0"
                    x2={x}
                    y2="150"
                    stroke="#1E2D4A"
                    strokeWidth="0.5"
                  />
                ))}
                {/* Fill */}
                <path d={chartFill} fill="url(#chartFill)" />
                {/* Line */}
                <path
                  d={chartLine}
                  fill="none"
                  stroke="#2F80ED"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                {/* Live dot */}
                <circle cx="400" cy="16" r="3" fill="#2F80ED" />
                <circle cx="400" cy="16" r="6" fill="#2F80ED" fillOpacity="0.25" />
              </svg>
            </div>

            {/* Indicator cards */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'RSI (14)', value: '72.4', color: '#F59E0B', tag: 'OB' },
                { label: 'MACD', value: '+2.18', color: '#00C896', tag: '↑' },
                { label: 'SMA 50', value: '$821.5', color: '#8A99B3', tag: '' },
              ].map((ind) => (
                <div
                  key={ind.label}
                  className="bg-[#0A0F1E] rounded-[4px] px-2 py-1.5 border border-[#1E2D4A]"
                >
                  <div className="text-[#8A99B3] text-[10px] mb-0.5">{ind.label}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: ind.color }}>
                      {ind.value}
                    </span>
                    {ind.tag && (
                      <span className="text-[9px] text-[#8A99B3]">{ind.tag}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating AI response card */}
      <div
        className="absolute -bottom-5 -right-5 bg-[#0F1729] border border-[#2F80ED]/30 rounded-[6px] px-4 py-3 w-52"
        style={{
          boxShadow:
            'inset 0 0 0 1px rgba(47,128,237,0.1), 0 0 24px rgba(47,128,237,0.12)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-full bg-[#2F80ED]/20 flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2F80ED]" />
          </div>
          <span className="text-[#8A99B3] text-[10px] uppercase tracking-wide">AI Assistant</span>
        </div>
        <p className="text-[#F0F4FF] text-[11px] leading-relaxed">
          "NVDA's RSI at 72 signals overbought territory — buying pressure may
          be exhausting near this level..."
        </p>
      </div>

      {/* Floating voice pill */}
      <div
        className="absolute -top-4 -left-4 bg-[#0F1729] border border-[#1E2D4A] rounded-full px-3 py-1.5 flex items-center gap-2"
        style={{ boxShadow: '0 0 16px rgba(47,128,237,0.1)' }}
      >
        <div className="flex items-end gap-[3px] h-3.5">
          {[3, 5, 8, 5, 3].map((h, i) => (
            <div
              key={i}
              className="w-[3px] bg-[#2F80ED] rounded-sm"
              style={{
                height: h * 1.5,
                animation: `waveform 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
              }}
            />
          ))}
        </div>
        <span className="text-[10px] text-[#8A99B3] whitespace-nowrap">
          TradeDesk AI, listening...
        </span>
      </div>
    </div>
  )
}
