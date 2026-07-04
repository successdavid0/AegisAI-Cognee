// Seeded demo dataset mirroring backend response shapes so the UI is fully
// demonstrable before the FastAPI backend exists. Models the PRD demo story:
// a fake Uniswap airdrop domain wired to a drainer wallet, an impersonating
// Telegram handle, a malicious contract, and the scam cluster tying them.
import type {
  EntityType,
  EntityDetail,
  Evidence,
  GraphData,
  Lifecycle,
  MemoryEvent,
  Reason,
  RelatedEntity,
  Report,
  ReportPayload,
  RiskLabel,
  ScanResult,
  Stats,
  RecentScan,
  SystemStatus,
} from "./types";
import { labelForScore } from "./risk";

interface SeedEntity {
  id: string;
  type: EntityType;
  value: string;
  risk_label: RiskLabel;
  risk_score: number;
  confidence: number;
  status: string;
  first_seen: string;
  chain: string | null;
}

const WALLET = "0x9a1f2c3d4e5f60718293a4b5c6d7e8f901234567";
const CONTRACT = "0xdead1111beef2222cafe3333f00d4444abad5555";
const HANDLE = "@uniswap_airdrop_support";
const DOMAIN = "uniswap-airdrop-claim.io";
const DOMAIN2 = "metamask-wallet-verify.com";

export const ENTITIES: Record<string, SeedEntity> = {
  [DOMAIN]: { id: "ent_domain_1", type: "domain", value: DOMAIN, risk_label: "Critical", risk_score: 8, confidence: 0.94, status: "verified", first_seen: "2026-06-21", chain: null },
  [WALLET]: { id: "ent_wallet_1", type: "wallet", value: WALLET, risk_label: "Critical", risk_score: 12, confidence: 0.9, status: "verified", first_seen: "2026-06-18", chain: "ethereum" },
  [HANDLE]: { id: "ent_handle_1", type: "handle", value: HANDLE, risk_label: "High Risk", risk_score: 26, confidence: 0.82, status: "verified", first_seen: "2026-06-22", chain: null },
  [CONTRACT]: { id: "ent_contract_1", type: "contract", value: CONTRACT, risk_label: "High Risk", risk_score: 29, confidence: 0.78, status: "verified", first_seen: "2026-06-19", chain: "ethereum" },
  [DOMAIN2]: { id: "ent_domain_2", type: "domain", value: DOMAIN2, risk_label: "Suspicious", risk_score: 52, confidence: 0.6, status: "pending", first_seen: "2026-06-28", chain: null },
};

const CLUSTER = {
  id: "cluster_1",
  value: "Fake Uniswap Airdrop Campaign",
  member_ids: ["ent_domain_1", "ent_wallet_1", "ent_handle_1", "ent_contract_1"],
};

const RELATIONSHIPS: [string, string, string, number][] = [
  [DOMAIN, WALLET, "drains_to", 0.9],
  [DOMAIN, HANDLE, "promoted_by", 0.85],
  [DOMAIN, CONTRACT, "deploys", 0.8],
  [HANDLE, WALLET, "shares_wallet", 0.7],
  [CONTRACT, WALLET, "owned_by", 0.75],
];

const DOMAIN_EVIDENCE = [
  { description: "Listed on CryptoScamDB as a phishing airdrop page", source: "CryptoScamDB", source_type: "threat_feed", reliability: 0.9 },
  { description: "Drains token approvals to a wallet flagged in 12 reports", source: "Internal graph", source_type: "derived", reliability: 0.85 },
  { description: "Domain registered 12 days ago, typosquats uniswap.org", source: "WHOIS heuristic", source_type: "heuristic", reliability: 0.7 },
  { description: "Promoted by an impersonating Telegram support handle", source: "Community report", source_type: "user_report", reliability: 0.6 },
];

const DOMAIN_REASONS = [
  { text: "Verified scam source (CryptoScamDB)", weight: 40 },
  { text: "Connected to flagged drainer wallet", weight: 25 },
  { text: "Member of an active scam cluster", weight: 20 },
  { text: "Multiple user reports", weight: 15 },
  { text: "Similar scam message pattern detected", weight: 10 },
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const sid = (prefix: string, v: string) => `${prefix}_${hash(v).toString(36).slice(0, 8)}`;
const nowIso = (offsetMin = 0) => new Date(Date.now() - offsetMin * 60000).toISOString();

export function detectType(value: string): EntityType {
  const v = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) return "wallet";
  if (/^0x[a-fA-F0-9]{64}$/.test(v)) return "tx";
  if (v.startsWith("@") || /(t\.me|telegram|twitter|x)\.com\//i.test(v)) return "handle";
  if (/^https?:\/\//i.test(v)) return "url";
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(v)) return "domain";
  if (v.split(/\s+/).length > 3) return "message";
  return "unknown";
}

function relatedFor(value: string): RelatedEntity[] {
  const out: RelatedEntity[] = [];
  const seen = new Set<string>();
  for (const [a, b, rel, conf] of RELATIONSHIPS) {
    const other = a === value ? b : b === value ? a : null;
    if (!other || seen.has(other)) continue;
    seen.add(other);
    const e = ENTITIES[other];
    if (e) out.push({ id: e.id, type: e.type, value: e.value, risk_label: e.risk_label, relationship: rel, confidence: conf });
  }
  return out;
}

export function mockLifecycle(scanId: string, value = "the scanned entity", known = true): Lifecycle {
  const events: MemoryEvent[] = [
    { id: sid("mem", scanId + "recall"), event_type: "recall", summary: `Recalled ${known ? 3 : 0} related memories for ${value}`, reason: "Scan triggered a recall against the global-threat-intel dataset.", timestamp: nowIso(4) },
    { id: sid("mem", scanId + "remember"), event_type: "remember", summary: "Remembered this scan event and its verdict", reason: "Scan events are stored so future recalls see this interaction.", timestamp: nowIso(3) },
  ];
  if (known) {
    events.push(
      { id: sid("mem", scanId + "improve"), event_type: "improve", summary: "Linked entity to the Fake Uniswap Airdrop cluster", reason: "Enrichment matched shared wallet + domain patterns.", timestamp: nowIso(2) },
      { id: sid("mem", scanId + "forget"), event_type: "forget", summary: "Downgraded 1 stale false-positive claim", reason: "A previously reported address was cleared by admin review.", timestamp: nowIso(1) },
    );
  }
  return { scan_id: scanId, events };
}

export function mockScan(value: string): ScanResult {
  const v = value.trim();
  const known = ENTITIES[v];
  const etype = known ? known.type : detectType(v);
  let score: number,
    entityId: string,
    reasons: Reason[],
    evidence: Evidence[],
    related: RelatedEntity[];

  if (known) {
    score = known.risk_score;
    entityId = known.id;
    reasons = etype === "domain" ? DOMAIN_REASONS : DOMAIN_REASONS.slice(0, 3);
    evidence = etype === "domain" ? DOMAIN_EVIDENCE : DOMAIN_EVIDENCE.slice(0, 2);
    related = relatedFor(v);
  } else {
    score = 100 - (hash(v) % 55);
    entityId = sid("ent", v);
    reasons = [{ text: "No verified scam evidence found", weight: 0 }];
    if (score < 70) reasons.push({ text: "Weak similarity to known scam message patterns", weight: 10 });
    evidence = [];
    related = [];
  }

  const label = known ? known.risk_label : labelForScore(score);
  const confidence = known ? known.confidence : Math.round((0.4 + score / 250) * 100) / 100;
  const scanId = sid("scan", v + Date.now());

  return {
    scan_id: scanId,
    input_value: v,
    input_type: etype,
    entity_id: entityId,
    risk_score: score,
    risk_label: label,
    confidence,
    reasons,
    evidence,
    related_entities: related,
    lifecycle_preview: mockLifecycle(scanId, v, !!known).events.slice(0, 2),
  };
}

export function mockGraph(value: string, depth = 1): GraphData {
  const v = value.trim();
  const nodes: Record<string, GraphData["nodes"][number]> = {};
  const edges: GraphData["edges"] = [];

  const addNode = (val: string) => {
    const e = ENTITIES[val];
    if (e && !nodes[e.id]) nodes[e.id] = { id: e.id, value: e.value, type: e.type, risk_label: e.risk_label, risk_score: e.risk_score };
  };

  const root = ENTITIES[v];
  if (!root) {
    const rid = sid("ent", v);
    nodes[rid] = { id: rid, value: v, type: detectType(v), risk_label: "Unknown", risk_score: null };
    return { root: v, nodes: Object.values(nodes), edges: [] };
  }

  addNode(v);
  let frontier = new Set([v]);
  for (let d = 0; d < Math.max(1, depth); d++) {
    const next = new Set<string>();
    for (const [a, b, rel, conf] of RELATIONSHIPS) {
      for (const [src, dst] of [[a, b], [b, a]] as [string, string][]) {
        if (frontier.has(src)) {
          addNode(src);
          addNode(dst);
          const ia = ENTITIES[src].id, ib = ENTITIES[dst].id;
          if (!edges.some((e) => e.from === ia && e.to === ib) && !edges.some((e) => e.from === ib && e.to === ia)) {
            edges.push({ from: ia, to: ib, relationship_type: rel, confidence: conf });
          }
          next.add(dst);
        }
      }
    }
    frontier = next;
  }

  if (Object.values(nodes).some((n) => CLUSTER.member_ids.includes(n.id))) {
    nodes[CLUSTER.id] = { id: CLUSTER.id, value: CLUSTER.value, type: "cluster", risk_label: "Critical", risk_score: null };
    for (const n of Object.values(nodes)) {
      if (CLUSTER.member_ids.includes(n.id)) edges.push({ from: CLUSTER.id, to: n.id, relationship_type: "cluster_member", confidence: 0.8 });
    }
  }

  return { root: v, nodes: Object.values(nodes), edges };
}

export function mockStats(): Stats {
  return { total_scans: 1284, total_reports: 213, verified_scams: 96, pending_reports: 41, false_positives_corrected: 12, scam_clusters: 7, memory_events: 3120 };
}

// Returned when the backend is unreachable (or mock-only): everything offline,
// so the System Status page renders red for the live services.
export function mockStatus(): SystemStatus {
  return {
    api: { ok: false, version: "—", env: "demo" },
    database: { connected: false },
    cognee: { enabled: false, mode: "offline", dataset: "—", base_url: null, reachable: false },
    admin_auth_ready: false,
  };
}

export function mockRecentScans(): RecentScan[] {
  const base: [string, EntityType, number, RiskLabel, number][] = [
    [DOMAIN, "domain", 8, "Critical", 6],
    [WALLET, "wallet", 12, "Critical", 22],
    [HANDLE, "handle", 26, "High Risk", 51],
    [DOMAIN2, "domain", 52, "Suspicious", 140],
    ["vitalik.eth", "handle", 92, "Low Risk", 190],
  ];
  return base.map(([v, t, s, l, m]) => ({ input_value: v, input_type: t, risk_score: s, risk_label: l, timestamp: nowIso(m) }));
}

export function mockReports(): Report[] {
  const rows: [string, string, EntityType, string, string, Report["status"], number, number][] = [
    ["rpt_1", DOMAIN, "domain", "Fake Airdrop", "Site asked me to approve tokens then drained my wallet.", "pending", 0.8, 30],
    ["rpt_2", HANDLE, "handle", "Impersonation", "DM'd me pretending to be Uniswap support.", "pending", 0.7, 120],
    ["rpt_3", WALLET, "wallet", "Wallet Drainer", "Received my funds after the airdrop scam.", "verified", 0.9, 600],
    ["rpt_4", DOMAIN2, "domain", "Phishing", "Looks like a MetaMask phishing clone.", "pending", 0.6, 900],
    ["rpt_5", "0xabc0000000000000000000000000000000000001", "wallet", "Other", "Might be a scam but I'm not sure, could be my mistake.", "false_positive", 0.3, 2400],
  ];
  return rows.map(([id, ev, et, st, desc, status, conf, m]) => ({ id, entity_value: ev, entity_type: et, scam_type: st, description: desc, status, confidence: conf, created_at: nowIso(m) }));
}

export function mockEntity(value: string): EntityDetail {
  const v = value.trim();
  const e = ENTITIES[v];
  if (!e) {
    return { id: sid("ent", v), type: detectType(v), value: v, risk_label: "Unknown", risk_score: null, confidence: null, status: "unknown", first_seen: null, chain: null, reports: [], relationships: [], memory_events: [], scans: [] };
  }
  return {
    id: e.id, type: e.type, value: e.value, risk_label: e.risk_label, risk_score: e.risk_score,
    confidence: e.confidence, status: e.status, first_seen: e.first_seen, chain: e.chain,
    reports: mockReports().filter((r) => r.entity_value === v),
    relationships: relatedFor(v),
    memory_events: mockLifecycle(sid("scan", v), e.value, true).events,
    scans: mockRecentScans().filter((s) => s.input_value === v),
  };
}

export function mockReportAck(payload: ReportPayload) {
  return { report_id: sid("rpt", JSON.stringify(payload) + Date.now()), status: "pending" as const, message: "Report saved as an unverified claim and remembered by Cognee.", entity_value: payload.value };
}

export function mockImproveAck() {
  return {
    status: "ok",
    summary: "Improve run linked 2 reports to the Fake Uniswap Airdrop cluster and merged 1 duplicate handle.",
    events: [
      { event_type: "improve" as const, summary: "Merged duplicate handle @uniswap_support", reason: "High text + relationship similarity." },
      { event_type: "improve" as const, summary: "Linked report rpt_1 to cluster_1", reason: "Shared drainer wallet and domain pattern." },
    ],
  };
}

export function mockForgetAck(reason = "false_positive") {
  return {
    status: "ok",
    summary: `Forget/correction recorded (${reason}). Future risk scores will reflect this change.`,
    events: [{ event_type: "forget" as const, summary: "Downgraded claim and applied -50 correction", reason }],
  };
}
