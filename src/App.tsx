import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock3,
  GitBranch,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Shuffle,
  ExternalLink,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type RiskLevel = 'normal' | 'watch' | 'high'

type ChainSupply = {
  chain: string
  current: number
  share: number
  dayChange: number
  weekChange: number
}

type StableAsset = {
  id: string
  name: string
  symbol: string
  pegMechanism: string
  price: number
  deviationBps: number
  absoluteDeviationBps: number
  priceType?: 'peg' | 'nav'
  priceNote?: string
  rawDeviationBps?: number
  isNavStyle?: boolean
  supply: number
  dayChange: number
  weekChange: number
  dayChangePct: number
  weekChangePct: number
  risk: RiskLevel
  chains: ChainSupply[]
}

type StablecoinPayload = {
  updatedAt: string
  source: string
  summary: {
    totalSupply: number
    count: number
    highRisk: number
    watchRisk: number
    minDisplaySupply: number
    largestDeviation?: StableAsset
  }
  watchlist: StableAsset[]
  topBySupply: StableAsset[]
  topMovers: StableAsset[]
}

type ChainOption = {
  id: number
  name: string
  key: string
  coin: string
}

type RouteStep = {
  id: string
  type: string
  tool: string
  toolName: string
  fromChain: string | number
  toChain: string | number
  fromToken: string
  toToken: string
  executionDuration: number
  gasUsd: number
  feeUsd: number
}

type RoutePayload = {
  updatedAt: string
  source: string
  request: {
    fromChain: number
    toChain: number
    symbol: string
    amount: number
  }
  route: {
    id: string
    tool: string
    bridgeTools: string[]
    fromAmountUSD: number
    toAmountUSD: number
    executionDuration: number
    gasUsd: number
    feeUsd: number
    steps: RouteStep[]
  }
}

type YieldAsset = {
  symbol: string
  name: string
  note: string
  bestPrice: number
  chains: {
    chainId: number
    chain: string | number
    address: string
    price: number
    confidence: number
  }[]
}

type YieldPayload = {
  updatedAt: string
  source: string
  assets: YieldAsset[]
}

type RedemptionAsset = {
  symbol: string
  name: string
  kind: string
  showInFocus?: boolean
  source: string
  quote: string
  marketQuote: string
  marketPrice: number
  normalizedMarketPrice: number
  marketQuality: string
  redemptionReference: number
  referenceLabel: string
  referenceQuality: string
  opportunityTag?: string | null
  opportunityScore?: number
  opportunityLevel?: 'A0' | 'A1' | 'A2' | '观察'
  opportunityReason?: string
  opportunity: string
  pendleMarket?: {
    name: string
    expiry: string
    impliedApy: number
    liquidity: number
    address: string
  } | null
  spreadPct: number | null
  annualizedPct: number | null
  waitDays: number
  wait: string
  redemptionPath: string[]
  entryUrl: string
  marketChain?: string | number
}

type RedemptionPayload = {
  updatedAt: string
  source: string
  assets: RedemptionAsset[]
}

type ChainSpreadRow = {
  chainId: number
  chain: string | number
  symbol: string
  address: string
  price: number
}

type ChainSpreadOpportunity = {
  symbol: string
  low: ChainSpreadRow
  high: ChainSpreadRow
  spreadBps: number
  alert: boolean
  direction: string
  routeSupported: boolean
  chainPrices: ChainSpreadRow[]
  opportunityScore?: number
  opportunityLevel?: 'A0' | 'A1' | 'A2' | '观察'
  opportunityReason?: string
}

type ChainSpreadPayload = {
  updatedAt: string
  source: string
  thresholdBps: number
  opportunities: ChainSpreadOpportunity[]
}

type ExchangeTicker = {
  exchange: string
  symbol: string
  pair: string
  quote: string
  price: number
  usdPrice?: number
  buyUsdPrice?: number
  sellUsdPrice?: number
  bid: number
  ask: number
  volumeQuote: number
  changePct24h: number
  usable: boolean
  deviationBps: number
  alert: boolean
  opportunityScore?: number
  opportunityLevel?: 'A0' | 'A1' | 'A2' | '观察'
  opportunityReason?: string
}

type ExchangeOpportunity = {
  symbol: string
  low: ExchangeTicker
  high: ExchangeTicker
  spreadBps: number
  alert: boolean
  direction: string
  opportunityScore?: number
  opportunityLevel?: 'A0' | 'A1' | 'A2' | '观察'
  opportunityReason?: string
}

type ExchangePayload = {
  updatedAt: string
  source: string
  stableRows: ExchangeTicker[]
  redemptionRows: ExchangeTicker[]
  opportunities: ExchangeOpportunity[]
}

type NotificationPayload = {
  updatedAt: string
  config: {
    enabled: boolean
    channels: string[]
    configured: boolean
    smsReady: boolean
    callReady: boolean
    webhookReady: boolean
    cooldownMinutes: number
  }
  state: {
    checkedAt: string | null
    lastSentAt: string | null
    lastError: string | null
    lastA0Count: number
  }
}

const routeSymbols = ['USDC', 'USDT', 'DAI', 'FRAX', 'USDE', 'sUSDe']
const redemptionFocusLimit = 20
const coreRedemptionSymbols = new Set([
  'sUSDe',
  'sDAI',
  'sUSDS',
  'sfrxUSD',
  'PT-sUSDe',
  'PT-USDe',
  'PT-sUSDS',
  'PT-sfrxUSD',
  'syrupUSDC',
  'syrupUSDT',
  'stETH',
  'wstETH',
  'rETH',
  'sfrxETH',
])
const coreRedemptionRank: Record<string, number> = {
  sUSDe: 0,
  sDAI: 1,
  sUSDS: 2,
  sfrxUSD: 3,
  'PT-sUSDe': 4,
  'PT-USDe': 5,
  'PT-sUSDS': 6,
  'PT-sfrxUSD': 7,
  syrupUSDC: 8,
  syrupUSDT: 9,
  stETH: 10,
  wstETH: 11,
  rETH: 12,
  sfrxETH: 13,
}

const defaultChains: ChainOption[] = [
  { id: 1, name: 'Ethereum', key: 'eth', coin: 'ETH' },
  { id: 8453, name: 'Base', key: 'bas', coin: 'ETH' },
  { id: 42161, name: 'Arbitrum', key: 'arb', coin: 'ETH' },
  { id: 10, name: 'OP Mainnet', key: 'opt', coin: 'ETH' },
  { id: 137, name: 'Polygon', key: 'pol', coin: 'POL' },
  { id: 43114, name: 'Avalanche', key: 'ava', coin: 'AVAX' },
  { id: 56, name: 'BSC', key: 'bsc', coin: 'BNB' },
]

function formatUsd(value: number, compact = true) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 2 : 4,
  }).format(value || 0)
}

function formatNumber(value?: number | null, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--'

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value || 0)
}

function formatPct(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '不计年化'

  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, 2)}%`
}

function formatAnnualized(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--'
  return formatPct(value)
}

function isPositiveRedemption(asset: RedemptionAsset) {
  return (asset.spreadPct ?? 0) > 0 && (asset.annualizedPct ?? 0) > 0
}

function annualizedNote(asset: RedemptionAsset) {
  if (asset.annualizedPct === null) return '已从列表剔除'
  if (!isPositiveRedemption(asset)) return '市场溢价，赎回方向为负'
  return `按约 ${asset.waitDays} 天占用`
}

function riskLabel(risk: RiskLevel) {
  if (risk === 'high') return '高风险'
  if (risk === 'watch') return '观察'
  return '正常'
}

function riskIcon(risk: RiskLevel) {
  if (risk === 'high') return <ShieldAlert size={16} />
  if (risk === 'watch') return <AlertTriangle size={16} />
  return <CheckCircle2 size={16} />
}

function chainLabel(chains: ChainOption[], id: number) {
  return chainNameZh(chains.find((chain) => chain.id === id)?.name || String(id))
}

function chainNameZh(name: string | number) {
  const key = String(name)
  const names: Record<string, string> = {
    Ethereum: '以太坊',
    Base: 'Base',
    Arbitrum: 'Arbitrum',
    'OP Mainnet': 'Optimism',
    Polygon: 'Polygon',
    Avalanche: 'Avalanche',
    BSC: 'BNB Chain',
    Linea: 'Linea',
    Unichain: 'Unichain',
    'World Chain': 'World Chain',
    Tron: 'Tron',
    Solana: 'Solana',
    Sui: 'Sui',
    Aptos: 'Aptos',
    Noble: 'Noble',
  }
  return names[key] || key
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function getJson<T>(url: string, retries = 3): Promise<T> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || response.statusText)
      }
      return response.json()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await sleep(700 + attempt * 900)
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('数据请求失败')
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  href,
}: {
  label: string
  value: string
  detail: string
  icon: React.ReactNode
  href?: string
}) {
  const content = (
    <>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </>
  )

  if (href) {
    return (
      <a className="metric metric-link" href={href}>
        {content}
      </a>
    )
  }

  return (
    <div className="metric">
      {content}
    </div>
  )
}

function RiskPill({ risk }: { risk: RiskLevel }) {
  return (
    <span className={`risk-pill ${risk}`}>
      {riskIcon(risk)}
      {riskLabel(risk)}
    </span>
  )
}

function OpportunityBadge({
  level,
  score,
}: {
  level?: 'A0' | 'A1' | 'A2' | '观察'
  score?: number
}) {
  if (!level || level === '观察') return null

  return (
    <em className={`opportunity-badge ${level.toLowerCase()}`}>
      {level} · {score ?? 0}
    </em>
  )
}

type AlertOpportunity = {
  id: string
  level: 'A0' | 'A1' | 'A2' | '观察'
  score: number
  title: string
  detail: string
  href: string
}

function AssetRow({
  asset,
  selected,
  onSelect,
}: {
  asset: StableAsset
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button className={`asset-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="asset-main">
        <span className="token-badge">{asset.symbol.slice(0, 4)}</span>
        <div>
          <strong>{asset.symbol}</strong>
          <small>{asset.name}</small>
        </div>
      </div>
      <div className="asset-price">
        <strong>${formatNumber(asset.price, 5)}</strong>
        {asset.isNavStyle ? (
          <small className="neutral">{asset.priceNote || 'NAV 口径'}</small>
        ) : (
          <small className={asset.deviationBps >= 0 ? 'positive' : 'negative'}>
            {asset.deviationBps >= 0 ? '+' : ''}
            {formatNumber(asset.deviationBps, 1)} bps
          </small>
        )}
      </div>
      <div className="asset-supply">
        <strong>{formatUsd(asset.supply)}</strong>
        <small className={asset.dayChangePct >= 0 ? 'positive' : 'negative'}>
          {formatPct(asset.dayChangePct)} 24小时
        </small>
      </div>
      <RiskPill risk={asset.risk} />
    </button>
  )
}

function ChainBreakdown({ asset }: { asset: StableAsset | undefined }) {
  if (!asset) return null

  const max = Math.max(...asset.chains.map((chain) => chain.current), 1)

  return (
    <div className="panel chain-panel">
      <div className="panel-title">
        <div>
          <span>链上供应分布</span>
          <h2>{asset.symbol} 各链供应量</h2>
        </div>
        <GitBranch size={20} />
      </div>
      <div className="panel-note">这里显示的是各链供应规模，不是各链价格。</div>
      <div className="chain-list">
        {asset.chains.map((chain) => (
          <div className="chain-item" key={chain.chain}>
            <div className="chain-line">
              <strong>{chainNameZh(chain.chain)}</strong>
              <span>{formatUsd(chain.current)}</span>
            </div>
            <div className="bar-track">
              <div style={{ width: `${Math.max((chain.current / max) * 100, 2)}%` }} />
            </div>
            <div className="chain-meta">
              <span>{formatNumber(chain.share, 2)}% 占比</span>
              <span className={chain.dayChange >= 0 ? 'positive' : 'negative'}>
                {chain.dayChange >= 0 ? '+' : ''}
                {formatUsd(chain.dayChange)} 24小时
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RouteSimulator({
  chains,
  routeSeed,
}: {
  chains: ChainOption[]
  routeSeed?: {
    symbol: string
    fromChain: number
    toChain: number
  } | null
}) {
  const [symbol, setSymbol] = useState('USDC')
  const [fromChain, setFromChain] = useState(8453)
  const [toChain, setToChain] = useState(42161)
  const [amount, setAmount] = useState('1000')
  const [route, setRoute] = useState<RoutePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadRoute() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        symbol,
        fromChain: String(fromChain),
        toChain: String(toChain),
        amount,
      })
      const data = await getJson<RoutePayload>(`/api/routes?${params.toString()}`)
      setRoute(data)
    } catch (routeError) {
      setRoute(null)
      setError(routeError instanceof Error ? routeError.message : '路径查询失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!routeSeed) return

    setSymbol(routeSeed.symbol)
    setFromChain(routeSeed.fromChain)
    setToChain(routeSeed.toChain)
  }, [routeSeed])

  const lossUsd = route
    ? route.route.fromAmountUSD - route.route.toAmountUSD + route.route.gasUsd
    : 0

  return (
    <div className="panel route-panel">
      <div className="panel-title">
        <div>
          <span>跨链路径</span>
          <h2>路径与成本模拟器</h2>
        </div>
        <Route size={20} />
      </div>

      <div className="route-form">
        <label>
          币种
          <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
            {routeSymbols.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          源链
          <select
            value={fromChain}
            onChange={(event) => setFromChain(Number(event.target.value))}
          >
            {chains.map((chain) => (
              <option value={chain.id} key={chain.id}>
                {chainNameZh(chain.name)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-button"
          onClick={() => {
            setFromChain(toChain)
            setToChain(fromChain)
          }}
          title="交换源链和目标链"
          type="button"
        >
          <Shuffle size={18} />
        </button>
        <label>
          目标链
          <select
            value={toChain}
            onChange={(event) => setToChain(Number(event.target.value))}
          >
            {chains.map((chain) => (
              <option value={chain.id} key={chain.id}>
                {chainNameZh(chain.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          数量
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <button className="primary-button" onClick={loadRoute} disabled={loading}>
          {loading ? <RefreshCw className="spin" size={16} /> : <Search size={16} />}
          查询
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {route && (
        <div className="route-result">
          <div className="quote-strip">
            <div>
              <span>路径</span>
              <strong>
                {chainLabel(chains, fromChain)}
                <ArrowRight size={15} />
                {chainLabel(chains, toChain)}
              </strong>
            </div>
            <div>
              <span>桥/工具</span>
              <strong>{route.route.bridgeTools.join(', ') || route.route.tool}</strong>
            </div>
            <div>
              <span>预计到账价值</span>
              <strong>{formatUsd(route.route.toAmountUSD, false)}</strong>
            </div>
            <div>
              <span>成本拖累</span>
              <strong className={lossUsd > 0 ? 'negative' : 'positive'}>
                {formatUsd(lossUsd, false)}
              </strong>
            </div>
            <div>
              <span>预计时间</span>
              <strong>{route.route.executionDuration || 0}s</strong>
            </div>
          </div>

          <div className="step-list">
            {route.route.steps.map((step, index) => (
              <div className="step-item" key={step.id || `${step.tool}-${index}`}>
                <div className="step-index">{index + 1}</div>
                <div>
                  <strong>{step.toolName}</strong>
                  <small>
                    {chainNameZh(step.fromChain)} {step.fromToken}
                    <ArrowRight size={13} />
                    {chainNameZh(step.toChain)} {step.toToken}
                  </small>
                </div>
                <span className="step-type">{step.type}</span>
                <span>{formatUsd(step.gasUsd + step.feeUsd, false)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChainSpreadPanel({
  spreads,
  onUseRoute,
}: {
  spreads: ChainSpreadPayload | null
  onUseRoute: (seed: { symbol: string; fromChain: number; toChain: number }) => void
}) {
  const rows = spreads?.opportunities || []

  return (
    <div className="panel chain-spread-panel" id="chain-spreads">
      <div className="panel-title">
        <div>
          <span>跨链价差</span>
          <h2>同一稳定币多链价差提醒</h2>
        </div>
        <GitBranch size={20} />
      </div>
      <div className="panel-note">
        这里按 LI.FI 的多链 token 报价扫描同名稳定币，只作为观察线索；它不是净套利报价，也不进入首页 A0/A1 复核榜。真正能不能做，要再看桥费、滑点、目标链卖出深度和提现限制。
      </div>
      <div className="spread-list">
        {rows.slice(0, 10).map((item) => (
          <div className={`spread-row ${item.alert ? 'alert' : ''}`} key={item.symbol}>
            <div>
              <strong>{item.symbol}</strong>
              <small>{item.direction}</small>
              <OpportunityBadge level={item.opportunityLevel} score={item.opportunityScore} />
            </div>
            <div className="spread-route">
              <span>
                {chainNameZh(item.low.chain)}
                <b>{formatNumber(item.low.price, 6)}</b>
              </span>
              <ArrowRight size={14} />
              <span>
                {chainNameZh(item.high.chain)}
                <b>{formatNumber(item.high.price, 6)}</b>
              </span>
            </div>
            <strong className={item.alert ? 'positive' : ''}>
              {formatNumber(item.spreadBps, 1)} bps
            </strong>
            <button
              className="small-button"
              disabled={!item.routeSupported}
              onClick={() =>
                onUseRoute({
                  symbol: item.symbol,
                  fromChain: item.low.chainId,
                  toChain: item.high.chainId,
                })
              }
              type="button"
            >
              查路径
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExchangePanel({ exchanges }: { exchanges: ExchangePayload | null }) {
  const depegs = exchanges?.stableRows || []
  const spreads = exchanges?.opportunities || []
  const redemptionRows = exchanges?.redemptionRows || []

  return (
    <div className="panel exchange-panel" id="exchange-prices">
      <div className="panel-title">
        <div>
          <span>交易所价格</span>
          <h2>CEX 脱锚、价差和赎回出口</h2>
        </div>
        <Activity size={20} />
      </div>
        <div className="panel-note">
        这里接 Binance、OKX、Gate、Coinbase 公开 ticker。USDT 报价会先按 USDT/USD 折算，低成交量和异常报价只作为二次核查线索。
      </div>
      <div className="exchange-grid">
        <div>
          <h3>脱锚监控</h3>
          <div className="exchange-list">
            {depegs.slice(0, 8).map((row) => (
              <div className={`exchange-row ${row.alert ? 'alert' : ''}`} key={`${row.exchange}-${row.pair}`}>
                <div>
                  <strong>{row.symbol}</strong>
                  <small>{row.exchange} · {row.pair}</small>
                  <OpportunityBadge level={row.opportunityLevel} score={row.opportunityScore} />
                </div>
                <span>
                  {formatNumber(row.price, 6)} {row.quote}
                  {row.usdPrice && row.quote !== 'USD' && (
                    <small>≈ ${formatNumber(row.usdPrice, 6)}</small>
                  )}
                </span>
                <b className={row.deviationBps < 0 ? 'negative' : row.deviationBps > 0 ? 'positive' : ''}>
                  {formatNumber(row.deviationBps, 1)} bps
                </b>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>CEX 价差</h3>
          <div className="exchange-list">
            {spreads.slice(0, 6).map((item) => (
              <div className={`exchange-row ${item.alert ? 'alert' : ''}`} key={item.symbol}>
                <div>
                  <strong>{item.symbol}</strong>
                  <small>{item.direction}</small>
                  <OpportunityBadge level={item.opportunityLevel} score={item.opportunityScore} />
                </div>
                <span>
                  {formatNumber(item.low.buyUsdPrice || item.low.usdPrice || item.low.price, 5)}
                  <ArrowRight size={13} />
                  {formatNumber(item.high.sellUsdPrice || item.high.usdPrice || item.high.price, 5)}
                </span>
                <b className={item.spreadBps > 0 ? 'positive' : ''}>
                  {formatNumber(item.spreadBps, 1)} bps
                </b>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>赎回相关</h3>
          <div className="exchange-list">
            {redemptionRows.map((row) => (
              <div className={`exchange-row ${row.alert ? 'alert' : ''}`} key={`${row.exchange}-${row.pair}`}>
                <div>
                  <strong>{row.symbol}</strong>
                  <small>{row.exchange} · {row.pair}</small>
                </div>
                <span>{formatNumber(row.price, 6)} {row.quote}</span>
                <b className={row.deviationBps < 0 ? 'negative' : row.deviationBps > 0 ? 'positive' : ''}>
                  {formatNumber(row.deviationBps, 1)} bps
                </b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function A0AlertPanel({ opportunities }: { opportunities: AlertOpportunity[] }) {
  const a0 = opportunities.filter((item) => item.level === 'A0')
  const top = a0.length ? a0 : opportunities.slice(0, 4)

  return (
    <section className={`a0-panel ${a0.length ? 'active' : ''}`}>
      <div>
        <span className="eyebrow">A0 复核提醒</span>
        <h2>{a0.length ? `发现 ${a0.length} 个 A0` : '当前没有 A0'}</h2>
      </div>
      <div className="a0-list">
        {top.length ? (
          top.map((item) => (
            <a href={item.href} key={item.id}>
              <strong>
                {item.level} · {item.score} · {item.title}
              </strong>
              <small>{item.detail}</small>
            </a>
          ))
        ) : (
          <small>当前只有观察项；没有达到 A0 复核级别。</small>
        )}
      </div>
    </section>
  )
}

function NotificationStatus({ notifications }: { notifications: NotificationPayload | null }) {
  const config = notifications?.config
  const state = notifications?.state
  const enabled = Boolean(config?.enabled && config.configured)
  const channelText = [
    config?.smsReady ? '短信' : null,
    config?.callReady ? '电话' : null,
    config?.webhookReady ? 'Webhook' : null,
  ].filter(Boolean).join(' / ')

  return (
    <div className={`notification-status ${enabled ? 'ready' : ''}`}>
      <strong>{enabled ? 'A0 复核项外部提醒已开启' : 'A0 复核项外部提醒未开启'}</strong>
      <small>
        {enabled
          ? `${channelText} · 冷却 ${config?.cooldownMinutes || 0} 分钟`
          : '可接短信、电话或 Webhook，需要在 .env 里配置服务商密钥和号码'}
      </small>
      <small>
        最近扫描：{state?.checkedAt ? new Date(state.checkedAt).toLocaleTimeString() : '--'}
        {state?.lastSentAt ? ` · 最近发送 ${new Date(state.lastSentAt).toLocaleTimeString()}` : ''}
      </small>
      {state?.lastError && <small className="negative">发送错误：{state.lastError}</small>}
    </div>
  )
}

function App() {
  const [stablecoins, setStablecoins] = useState<StablecoinPayload | null>(null)
  const [yieldAssets, setYieldAssets] = useState<YieldPayload | null>(null)
  const [redemptions, setRedemptions] = useState<RedemptionPayload | null>(null)
  const [chainSpreads, setChainSpreads] = useState<ChainSpreadPayload | null>(null)
  const [exchanges, setExchanges] = useState<ExchangePayload | null>(null)
  const [notifications, setNotifications] = useState<NotificationPayload | null>(null)
  const [routeSeed, setRouteSeed] = useState<{
    symbol: string
    fromChain: number
    toChain: number
  } | null>(null)
  const [chains, setChains] = useState<ChainOption[]>(defaultChains)
  const [selectedSymbol, setSelectedSymbol] = useState('USDC')
  const [redemptionQuery, setRedemptionQuery] = useState('')
  const [redemptionScope, setRedemptionScope] = useState<'focus' | 'all'>('focus')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const [stablecoinData, chainData] = await Promise.all([
        getJson<StablecoinPayload>('/api/stablecoins'),
        getJson<{ chains: ChainOption[] }>('/api/chains'),
      ])
      getJson<YieldPayload>('/api/yield-assets')
        .then(setYieldAssets)
        .catch(() => setYieldAssets(null))
      getJson<RedemptionPayload>('/api/redemption-spreads')
        .then(setRedemptions)
        .catch(() => setRedemptions(null))
      getJson<ChainSpreadPayload>('/api/chain-spreads')
        .then(setChainSpreads)
        .catch(() => setChainSpreads(null))
      getJson<ExchangePayload>('/api/exchange-prices')
        .then(setExchanges)
        .catch(() => setExchanges(null))
      getJson<NotificationPayload>('/api/notifications')
        .then(setNotifications)
        .catch(() => setNotifications(null))
      setStablecoins(stablecoinData)
      setChains(chainData.chains.length ? chainData.chains : defaultChains)
      if (!stablecoinData.watchlist.some((asset) => asset.symbol === selectedSymbol)) {
        setSelectedSymbol(stablecoinData.watchlist[0]?.symbol || 'USDC')
      }
    } catch (dashboardError) {
      setError(dashboardError instanceof Error ? dashboardError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
    const timer = window.setInterval(loadDashboard, 60_000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined)
    }
  }, [])

  const selectedAsset = useMemo(() => {
    return (
      stablecoins?.watchlist.find((asset) => asset.symbol === selectedSymbol) ||
      stablecoins?.topBySupply.find((asset) => asset.symbol === selectedSymbol)
    )
  }, [stablecoins, selectedSymbol])

  const redemptionQueryText = redemptionQuery.trim().toLowerCase()
  const rankedRedemptions = useMemo(() => {
    const levelRank: Record<string, number> = { A0: 4, A1: 3, A2: 2, 观察: 1 }

    return [...(redemptions?.assets || [])].sort((a, b) => {
      const scoreDiff = (b.opportunityScore || 0) - (a.opportunityScore || 0)
      const levelDiff =
        (levelRank[b.opportunityLevel || '观察'] || 0) -
        (levelRank[a.opportunityLevel || '观察'] || 0)
      const spreadDiff = (b.spreadPct ?? -9999) - (a.spreadPct ?? -9999)
      const annualizedDiff = (b.annualizedPct ?? -9999) - (a.annualizedPct ?? -9999)

      return scoreDiff || levelDiff || spreadDiff || annualizedDiff || a.symbol.localeCompare(b.symbol)
    })
  }, [redemptions])

  const matchingRedemptions = useMemo(() => {
    if (!redemptionQueryText) return rankedRedemptions

    return rankedRedemptions.filter((asset) => {
      const searchable = [
        asset.symbol,
        asset.name,
        asset.kind,
        asset.source,
        asset.quote,
        asset.marketQuote,
        asset.marketQuality,
        asset.referenceLabel,
        asset.referenceQuality,
        asset.opportunityTag,
        asset.opportunityLevel,
        asset.opportunityReason,
        asset.opportunity,
        asset.marketChain ? chainNameZh(asset.marketChain) : '',
        asset.pendleMarket?.name,
        ...asset.redemptionPath,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(redemptionQueryText)
    })
  }, [rankedRedemptions, redemptionQueryText])

  const visibleRedemptions = useMemo(() => {
    if (redemptionQueryText || redemptionScope === 'all') return matchingRedemptions

    const positiveRedemptions = matchingRedemptions.filter(isPositiveRedemption)
    const pinned = positiveRedemptions.filter((asset) => {
      const level = asset.opportunityLevel || '观察'

      return (
        asset.showInFocus ||
        coreRedemptionSymbols.has(asset.symbol) ||
        level === 'A0' ||
        level === 'A1' ||
        level === 'A2' ||
        asset.opportunityTag === '重点复核' ||
        asset.opportunityTag === '可关注'
      )
    })
    const orderedPinned = [...pinned].sort((a, b) => {
      const coreDiff =
        (coreRedemptionRank[a.symbol] ?? 99) - (coreRedemptionRank[b.symbol] ?? 99)
      const annualizedDiff = (b.annualizedPct ?? -9999) - (a.annualizedPct ?? -9999)
      const scoreDiff = (b.opportunityScore || 0) - (a.opportunityScore || 0)

      return coreDiff || annualizedDiff || scoreDiff || a.symbol.localeCompare(b.symbol)
    })
    const seen = new Set(orderedPinned.map((asset) => asset.symbol))
    const filled = [...orderedPinned]

    for (const asset of positiveRedemptions) {
      if (filled.length >= redemptionFocusLimit) break
      if (!seen.has(asset.symbol)) {
        filled.push(asset)
        seen.add(asset.symbol)
      }
    }

    return filled.slice(0, redemptionFocusLimit)
  }, [matchingRedemptions, redemptionQueryText, redemptionScope])

  const positiveRedemptionCount = matchingRedemptions.filter(isPositiveRedemption).length
  const redemptionCountText = redemptionQueryText
    ? `匹配 ${matchingRedemptions.length} / ${rankedRedemptions.length}`
    : redemptionScope === 'all'
      ? `全部 ${rankedRedemptions.length}`
      : `正向年化 ${visibleRedemptions.length} / ${positiveRedemptionCount}`

  const watchlist = stablecoins?.watchlist || []
  const scoredOpportunities = useMemo<AlertOpportunity[]>(() => {
    const redemptionItems =
      redemptions?.assets
        .filter((asset) => (asset.opportunityScore || 0) > 0)
        .map((asset) => ({
          id: `redemption-${asset.symbol}`,
          level: asset.opportunityLevel || '观察',
          score: asset.opportunityScore || 0,
          title: `${asset.symbol} 赎回年化`,
          detail: `${formatPct(asset.spreadPct)} · ${asset.opportunityReason || asset.opportunity}`,
          href: '#redemption-spreads',
        })) || []

    const exchangeSpreadItems =
      exchanges?.opportunities
        .filter((item) => (item.opportunityScore || 0) > 0)
        .map((item) => ({
          id: `exchange-spread-${item.symbol}`,
          level: item.opportunityLevel || '观察',
          score: item.opportunityScore || 0,
          title: `${item.symbol} CEX 价差`,
          detail: `${formatNumber(item.spreadBps, 1)} bps · ${item.opportunityReason || item.direction}`,
          href: '#exchange-prices',
        })) || []

    const exchangeDepegItems =
      exchanges?.stableRows
        .filter((item) => (item.opportunityScore || 0) > 0)
        .map((item) => ({
          id: `exchange-depeg-${item.exchange}-${item.pair}`,
          level: item.opportunityLevel || '观察',
          score: item.opportunityScore || 0,
          title: `${item.symbol} ${item.exchange} 脱锚`,
          detail: `${formatNumber(item.deviationBps, 1)} bps · ${item.opportunityReason || item.pair}`,
          href: '#exchange-prices',
        })) || []

    return [
      ...redemptionItems,
      ...exchangeSpreadItems,
      ...exchangeDepegItems,
    ].sort((a, b) => b.score - a.score)
  }, [redemptions, exchanges])

  const a0Count = scoredOpportunities.filter((item) => item.level === 'A0').length
  const a1Count = scoredOpportunities.filter((item) => item.level === 'A1').length
  const topOpportunity = scoredOpportunities[0]
  const a0Signature = scoredOpportunities
    .filter((item) => item.level === 'A0')
    .map((item) => item.id)
    .join('|')

  useEffect(() => {
    if (!a0Signature || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const first = scoredOpportunities.find((item) => item.level === 'A0')
    if (!first) return
    new Notification('A0 复核提醒', {
      body: `${first.title} · ${first.detail}`,
    })
  }, [a0Signature, scoredOpportunities])
  const redemptionWatchCount =
    redemptions?.assets.filter((asset) => asset.opportunityLevel === 'A2').length || 0
  const exchangeOpportunityCount =
    (exchanges?.opportunities.filter((item) => item.alert).length || 0) +
    (exchanges?.stableRows.filter((item) => item.alert).length || 0)

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <span className="eyebrow">稳定币风险看板</span>
          <h1>脱锚监控与跨链路径模拟</h1>
        </div>
        <button className="secondary-button" onClick={loadDashboard} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} size={16} />
          刷新
        </button>
        <a className="secondary-link" href="#redemption-spreads">
          <ExternalLink size={16} />
          赎回年化
        </a>
      </header>

      {error && <div className="error-box">{error}</div>}

      <A0AlertPanel opportunities={scoredOpportunities} />
      <NotificationStatus notifications={notifications} />

      <section className="metrics-grid">
        <MetricCard
          icon={<BarChart3 size={20} />}
          label="A0复核"
          value={`${a0Count} 个`}
          detail={topOpportunity ? `最高 ${topOpportunity.level} · ${topOpportunity.title}` : '当前没有可提醒复核项'}
          href="#redemption-spreads"
        />
        <MetricCard
          icon={<GitBranch size={20} />}
          label="A1/A2候选"
          value={`${a1Count} A1 / ${redemptionWatchCount} A2`}
          detail="只统计赎回价差和CEX价差；跨链报价单独观察"
          href="#redemption-spreads"
        />
        <MetricCard
          icon={<Activity size={20} />}
          label="交易所价差"
          value={`${exchangeOpportunityCount} 个`}
          detail="CEX 脱锚或交易所间价差提醒"
          href="#exchange-prices"
        />
        <MetricCard
          icon={<Clock3 size={20} />}
          label="数据刷新"
          value={stablecoins ? new Date(stablecoins.updatedAt).toLocaleTimeString() : '--'}
          detail="每 60 秒自动刷新"
        />
      </section>

      <section className="workspace-grid">
        <div className="panel asset-panel">
          <div className="panel-title">
            <div>
              <span>稳定币市值排名</span>
              <h2>
                按市值降序 · {watchlist.length} 个资产 · 门槛{' '}
                {formatUsd(stablecoins?.summary.minDisplaySupply || 0)}
              </h2>
            </div>
            <Bell size={20} />
          </div>
        <div className="asset-header">
          <span>资产</span>
          <span>价格口径</span>
          <span>供应</span>
          <span>风险</span>
        </div>
          <div className="asset-list">
            {watchlist.map((asset) => (
              <AssetRow
                asset={asset}
                selected={asset.symbol === selectedSymbol}
                onSelect={() => setSelectedSymbol(asset.symbol)}
                key={`${asset.id}-${asset.symbol}`}
              />
            ))}
          </div>
        </div>

        <div className="side-stack">
          <ChainBreakdown asset={selectedAsset} />
          <div className="panel mover-panel">
            <div className="panel-title">
              <div>
                <span>供应冲击</span>
                <h2>24小时变化</h2>
              </div>
              <Activity size={20} />
            </div>
            <div className="mover-list">
              {(stablecoins?.topMovers || []).slice(0, 7).map((asset) => (
                <div className="mover-row" key={`${asset.id}-mover`}>
                  <span>{asset.symbol}</span>
                  <strong className={asset.dayChangePct >= 0 ? 'positive' : 'negative'}>
                    {formatPct(asset.dayChangePct)}
                  </strong>
                  <small>{formatUsd(asset.dayChange)}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ExchangePanel exchanges={exchanges} />

      <section className="panel redemption-panel" id="redemption-spreads">
        <div className="panel-title">
          <div>
            <span>赎回复核入口</span>
            <h2>可年化赎回路径：市场价 vs 赎回参考价</h2>
          </div>
          <ExternalLink size={20} />
        </div>
        <div className="panel-note">
        重点只显示正向折价年化；负年化代表市场价高于赎回价值，不是赎回方向，可在“全部可算”里核对。
        </div>
        <div className="redemption-toolbar">
          <label className="redemption-search">
            <Search size={16} />
            <input
              aria-label="搜索赎回资产"
              placeholder="搜索币种、名称、类型、路径"
              value={redemptionQuery}
              onChange={(event) => setRedemptionQuery(event.target.value)}
            />
          </label>
          <div className="redemption-segment" aria-label="赎回资产显示范围">
            <button
              className={redemptionScope === 'focus' ? 'active' : ''}
              onClick={() => setRedemptionScope('focus')}
              type="button"
            >
              重点
            </button>
            <button
              className={redemptionScope === 'all' ? 'active' : ''}
              onClick={() => setRedemptionScope('all')}
              type="button"
            >
              全部可算
            </button>
          </div>
          <small>{redemptionCountText}</small>
        </div>
        <div className="redemption-grid">
          {visibleRedemptions.map((asset) => (
            <div
              className={`redemption-card ${asset.opportunityTag === '重点复核' ? 'hot' : asset.opportunityTag === '可关注' ? 'watch' : !isPositiveRedemption(asset) ? 'premium' : ''}`}
              key={asset.symbol}
            >
              <div className="redemption-head">
                <div>
                  <strong>
                    {asset.symbol}
                    {asset.opportunityTag && (
                      <em className={asset.opportunityTag === '重点复核' ? 'hot-tag' : 'watch-tag'}>
                        {asset.opportunityTag}
                      </em>
                    )}
                    <OpportunityBadge level={asset.opportunityLevel} score={asset.opportunityScore} />
                  </strong>
                  <small>{asset.name} · {asset.kind}</small>
                </div>
                <span
                  className={
                    asset.spreadPct === null
                      ? 'pending'
                      : asset.spreadPct > 0
                        ? 'positive'
                        : asset.spreadPct < 0
                          ? 'negative'
                          : ''
                  }
                >
                  {formatPct(asset.spreadPct)}
                </span>
              </div>
              <div className="redemption-values">
                <div>
                  <span>市场交易价</span>
                  <strong>{formatNumber(asset.marketPrice, 6)} {asset.marketQuote}</strong>
                  <small>
                    {asset.marketChain ? `${chainNameZh(asset.marketChain)} · ` : ''}
                    {asset.marketQuality}
                  </small>
                </div>
                <div>
                  <span>赎回参考</span>
                  <strong>
                    {asset.redemptionReference > 0
                      ? `${formatNumber(asset.redemptionReference, 6)} ${asset.quote}`
                      : '暂无参考'}
                  </strong>
                  <small>{asset.referenceQuality}</small>
                </div>
                <div>
                  <span>折算市场价</span>
                  <strong>{formatNumber(asset.normalizedMarketPrice, 6)} {asset.quote}</strong>
                  <small>用于和赎回单位比较</small>
                </div>
                <div>
                  <span>估算年化</span>
                  <strong>{formatAnnualized(asset.annualizedPct)}</strong>
                  <small>{annualizedNote(asset)}</small>
                </div>
              </div>
              <p>
                {asset.referenceLabel}
                {asset.opportunityReason && `；评分：${asset.opportunityReason}`}
                {asset.pendleMarket &&
                  `；Pendle ${asset.pendleMarket.name} 到期 ${new Date(
                    asset.pendleMarket.expiry,
                  ).toLocaleDateString()}，隐含年化 ${formatPct(asset.pendleMarket.impliedApy)}`}
              </p>
              <div className="path-list">
                {asset.redemptionPath.map((step, index) => (
                  <div key={`${asset.symbol}-${step}`}>
                    <span>{index + 1}</span>
                    <small>{step}</small>
                  </div>
                ))}
              </div>
              <div className="redemption-foot">
                <small>{asset.wait}</small>
                <a href={asset.entryUrl} target="_blank" rel="noreferrer">
                  入口
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
          {visibleRedemptions.length === 0 && (
            <div className="redemption-empty">
              <Search size={18} />
              <strong>没有匹配的赎回资产</strong>
              <small>换一个币种、链名、类型或路径关键词试试。</small>
            </div>
          )}
        </div>
      </section>

      <section className="lower-grid">
        <div className="left-lower-stack" id="route-simulator">
          <ChainSpreadPanel
            spreads={chainSpreads}
            onUseRoute={(seed) => {
              setRouteSeed(seed)
              document
                .getElementById('route-simulator')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
          <RouteSimulator chains={chains} routeSeed={routeSeed} />
        </div>
        <div className="right-lower-stack">
          <div className="panel yield-panel">
            <div className="panel-title">
              <div>
                <span>收益型/衍生稳定币</span>
                <h2>sUSDe、sUSDS 单独观察</h2>
              </div>
              <BarChart3 size={20} />
            </div>
            <div className="yield-list">
              {(yieldAssets?.assets || []).map((asset) => (
                <div className="yield-row" key={asset.symbol}>
                  <div>
                    <strong>{asset.symbol}</strong>
                    <small>{asset.note}</small>
                  </div>
                  <span>{formatUsd(asset.bestPrice, false)}</span>
                  <small>
                    {asset.chains
                      .slice(0, 4)
                      .map((chain) => chainNameZh(chain.chain))
                      .join(' / ')}
                  </small>
                </div>
              ))}
            </div>
          </div>

          <div className="panel playbook-panel">
            <div className="panel-title">
              <div>
                <span>执行检查清单</span>
                <h2>当前版本会检查什么</h2>
              </div>
              <AlertTriangle size={20} />
            </div>
            <div className="playbook">
              <div>
                <strong>优先确认原生资产</strong>
                <span>如果源链和目标链都是原生 USDC，路径应优先看 CCTP。</span>
              </div>
              <div>
                <strong>桥接版本不能混看</strong>
                <span>USDC.e、axlUSDC、lzUSDC、USDT0 都要当成不同资产处理。</span>
              </div>
              <div>
                <strong>报价不等于利润</strong>
                <span>真实净利润还要计算目标链池子深度、CEX 订单簿、gas 和到账延迟。</span>
              </div>
              <div>
                <strong>赎回年化只看可算路径</strong>
                <span>没有链上汇率、明确到期日或可解释等待时间的赎回项，不放进年化监控。</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
