import json, sqlite3, os
from datetime import datetime, timezone

BASE = os.path.expanduser('~/workspace/stablecoin-risk-desk')
seed = json.load(open(f'{BASE}/build_arb/seed_list.json'))
pull = json.load(open(f'{BASE}/build_arb/borrow_pull.json'))
DB = f'{BASE}/state/arb_addresses.sqlite'
if os.path.exists(DB):
    os.remove(DB)
con = sqlite3.connect(DB)
con.executescript('''
CREATE TABLE addresses (
  address TEXT PRIMARY KEY,
  tier INTEGER NOT NULL DEFAULT 1,
  label TEXT,
  source TEXT NOT NULL,
  first_seen_event TEXT,
  first_seen_at TEXT,
  event_summary TEXT,
  event_borrowed_eth REAL,
  event_borrow_count INTEGER,
  event_repaid_eth REAL,
  event_supplied_usd REAL,
  pnl_est_usd REAL,
  pnl_note TEXT,
  last_active_at TEXT,
  last_active_block INTEGER,
  status TEXT NOT NULL DEFAULT 'watching',
  notes TEXT,
  added_at TEXT NOT NULL
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  protocol TEXT, event_type TEXT, asset TEXT,
  amount REAL, amount_usd REAL,
  block_number INTEGER, tx_hash TEXT,
  event_time TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_events_addr ON events(address);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
''')

T_START = 1793305451  # ts of first block >= 2026-10-29T20:24Z
B_START = pull['window']['from']
BLOCK_SEC = (1793327039 - 1793305451) / (pull['window']['to'] - pull['window']['from'])
def ts_of(block):
    return datetime.fromtimestamp(T_START + (block - B_START) * BLOCK_SEC, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def mins_of(block):
    return (block - B_START) * BLOCK_SEC / 60.0

NOW = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
EVENT = '2026-10-30 币安被盗预言机窗口'
SRC = 'Aave V3 主网 Borrow(WETH) 事件链上拉取 2026-10-29T20:24Z~10-30T02:24Z'

rows = sorted(seed['seed'], key=lambda r: -r['totalBorrowedEth'])
for i, r in enumerate(rows, 1):
    sup_usd = r['suppliedUsdt'] + r['suppliedUsdc']
    repaid_txt = '窗口内全额还清' if r['repaidFull'] else (f"窗口内还 {r['totalRepaidEth']:.1f} ETH" if r['totalRepaidEth'] > 0 else '窗口内未还款（疑窗口后平仓或仍持仓）')
    summary = (f"窗口内借 WETH {r['borrowCount']} 笔共 {r['totalBorrowedEth']:.1f} ETH，{repaid_txt}；"
               f"窗口内补充稳定币抵押约 ${sup_usd:,.0f}（USDT {r['suppliedUsdt']:,} / USDC {r['suppliedUsdc']:,}）；"
               f"首借约在事发后 {mins_of(r['firstBorrowBlock']):.0f} 分钟（区块 {r['firstBorrowBlock']}）")
    label = f"币安被盗夜套利地址·借款量第{i}"
    pnl, pnl_note = None, '未逐笔还原 DEX 买卖价，暂不估算'
    if r['address'].startswith('0x0cdd'):
        label = '币安被盗夜套利第一名（用户复盘）'
        pnl, pnl_note = 3470000, '用户复盘链上统计：卖 12,289 ETH 均价 2580、买回 12,314 ETH 均价 2297，未扣 gas；链上核验：18 笔共借 11,701 ETH、窗口内全额还清、首借在事发后 24 分 23 秒'
        summary += '；DEX 侧卖出 12,289 ETH（比借入多 588，应连自有 ETH 一并卖出）'
    con.execute('INSERT INTO addresses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        (r['address'], 1, label, SRC, EVENT, ts_of(r['firstBorrowBlock']), summary,
         r['totalBorrowedEth'], r['borrowCount'], r['totalRepaidEth'], sup_usd,
         pnl, pnl_note, ts_of(r['lastBorrowBlock']), r['lastBorrowBlock'], 'watching',
         f"借款 tx {len(r['borrowTxs'])} 笔已存 build_arb/seed_list.json", NOW))

# hacker: excluded blacklist row
con.execute('INSERT INTO addresses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    (seed['hacker'], 0, '黑客地址（排除）', SRC, EVENT, '2026-10-29T21:01:00Z',
     'Binance Hot Wallet Exploiter 3（theccpress 标记）：窗口内分两笔存入 USDT 共 60,000,000、分两笔借 WETH 共 19,762.4 ETH、未还款。主攻击地址 0x7c8601d4645b93cea45f71e118a729332e6b5ca0 本身未在 Aave 借款。',
     19762.4, 2, 0, 60000000, None, '被盗资金，非套利', None, 26300951, 'excluded',
     '跟踪时忽略其行为，不作套利信号', NOW))

# tier-2 initiators
for a in seed['userOnly']:
    con.execute('INSERT INTO addresses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        (a, 2, '关联操作地址（借入发起方）', SRC, EVENT, None,
         '窗口内作为 Borrow 的 user（发起方）出现、自身非仓位所有者，疑为代操作合约/EOA；其发起的仓位已在一线名单内。', None, None, None, None, None,
         '口径对账用：复盘 61 个与链上可复现 53 个核心地址的差额或含此类地址', None, None, 'watching',
         '二线观察：其发起的新仓位会经仓位所有者被一线跟踪捕获，此档仅作归因补充', NOW))

con.executemany('INSERT INTO meta VALUES (?,?)', [
    ('created_at', NOW),
    ('seed_event', EVENT),
    ('window_utc', '2026-10-29T20:24:00Z/2026-10-30T02:24:00Z'),
    ('window_blocks', f"{pull['window']['from']}-{pull['window']['to']}"),
    ('count_note', '链上可复现：窗口内 Aave V3 主网 Borrow(WETH) 仓位地址 54 个（含黑客 1）→ 核心种子 53；tx 发送者口径 55、仓位∪发起方并集 59、放宽至 20:00Z 仓位 57、Aave V2 为 0。用户复盘的 61 无法唯一还原，未凑数。'),
    ('hacker_excluded', seed['hacker']),
])
con.commit()

# md export
lines = ['# 元套利地址名单（种子）', '',
         f"来源：{EVENT}，Aave V3 主网 Borrow(WETH) 事件链上拉取，窗口 2026-10-29 20:24 UTC – 10-30 02:24 UTC（区块 {pull['window']['from']}–{pull['window']['to']}）。",
         '数据库：`state/arb_addresses.sqlite`（本名单为其导出）。', '',
         '## 口径说明（与复盘「61 个」的对账）', '',
         '- 链上可复现的仓位地址（onBehalfOf）共 **54** 个，其中黑客 1 个，核心种子 **53** 个（下表）。',
         '- 其他口径实测：交易发送者 55、仓位∪发起方并集 59、窗口放宽到 20:00 UTC 时仓位 57、Aave V2 同期借 WETH 为 0、WETH 闪电贷为 0。',
         '- 复盘的 61 无法唯一还原（大概率把发起合约/代操作地址也计入），**未凑数**；5 个发起方地址单列二线（tier 2）。', '',
         '## 一线核心地址（53，按事件期借款量降序）', '',
         '| # | 地址 | 借 ETH | 笔数 | 已还 ETH | 存入稳定币抵押(USD) | 备注 |',
         '|---|------|--------|------|----------|---------------------|------|']
for i, r in enumerate(rows, 1):
    note = '复盘第一名，赚约 $3.47M' if r['address'].startswith('0x0cdd') else ('' if r['repaidFull'] else '窗口内未还清')
    lines.append(f"| {i} | `{r['address']}` | {r['totalBorrowedEth']:.1f} | {r['borrowCount']} | {r['totalRepaidEth']:.1f} | {r['suppliedUsdt']+r['suppliedUsdc']:,} | {note} |")
lines += ['', '## 二线关联操作地址（5，借入发起方、非仓位所有者）', '']
for a in seed['userOnly']:
    lines.append(f'- `{a}`')
lines += ['', '## 排除（黑客）', '',
          f"- `{seed['hacker']}` — Binance Hot Wallet Exploiter 3：存 6000 万 USDT、借 19,762.4 ETH、未还；跟踪时忽略。", '']
open(f'{BASE}/arb_addresses.md', 'w').write('\n'.join(lines))
print('db rows:', con.execute('SELECT tier, COUNT(*) FROM addresses GROUP BY tier').fetchall())
print('md written')
con.close()
