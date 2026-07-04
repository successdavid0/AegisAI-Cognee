// Risk + node visual language (Frontend Spec §7). Display only.
import type { EntityType, RiskLabel } from "./types";

export const RISK: Record<
  RiskLabel,
  { color: string; glow: string; text: string; bg: string; ring: string }
> = {
  Critical: {
    color: "#ff4d5e",
    glow: "rgba(255,77,94,0.45)",
    text: "text-[#ff8a95]",
    bg: "bg-[#ff4d5e]/12",
    ring: "ring-[#ff4d5e]/40",
  },
  "High Risk": {
    color: "#ff8a34",
    glow: "rgba(255,138,52,0.4)",
    text: "text-[#ffb27a]",
    bg: "bg-[#ff8a34]/12",
    ring: "ring-[#ff8a34]/40",
  },
  Suspicious: {
    color: "#ffc53d",
    glow: "rgba(255,197,61,0.35)",
    text: "text-[#ffd97a]",
    bg: "bg-[#ffc53d]/12",
    ring: "ring-[#ffc53d]/40",
  },
  "Low Risk": {
    color: "#2ee6a6",
    glow: "rgba(46,230,166,0.35)",
    text: "text-[#7ff0cb]",
    bg: "bg-[#2ee6a6]/12",
    ring: "ring-[#2ee6a6]/40",
  },
  Unknown: {
    color: "#8a8a99",
    glow: "rgba(138,138,153,0.25)",
    text: "text-[#b4b4c0]",
    bg: "bg-[#8a8a99]/12",
    ring: "ring-[#8a8a99]/40",
  },
};

// Safety-score bands (higher = safer), mirroring backend label_from_score.
export function labelForScore(score: number): RiskLabel {
  if (score >= 70) return "Low Risk";
  if (score >= 40) return "Suspicious";
  if (score >= 20) return "High Risk";
  return "Critical";
}

export function riskColor(label: RiskLabel | undefined): string {
  return RISK[label ?? "Unknown"]?.color ?? RISK.Unknown.color;
}

export const NODE_META: Record<
  EntityType,
  { icon: string; label: string; color: string }
> = {
  wallet: { icon: "🪙", label: "Wallet", color: "#5b8def" },
  domain: { icon: "🌐", label: "Domain", color: "#9b7bff" },
  url: { icon: "🔗", label: "URL", color: "#b57bff" },
  contract: { icon: "📜", label: "Contract", color: "#ec6dfb" },
  handle: { icon: "👤", label: "Social handle", color: "#22d3ee" },
  message: { icon: "💬", label: "Message", color: "#94a3b8" },
  tx: { icon: "🧾", label: "Transaction", color: "#94a3b8" },
  cluster: { icon: "🕸️", label: "Scam cluster", color: "#ff4d5e" },
  source: { icon: "🔵", label: "Source", color: "#3b82f6" },
  unknown: { icon: "•", label: "Unknown", color: "#8a8a99" },
};

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  wallet: "Wallet Address",
  domain: "Domain",
  url: "URL",
  contract: "Smart Contract",
  handle: "Social Handle",
  message: "Scam Message",
  tx: "Transaction Hash",
  cluster: "Scam Cluster",
  source: "Source",
  unknown: "Unknown",
};

export const SCAM_TYPES = [
  "Phishing",
  "Fake Airdrop",
  "Rug Pull",
  "Impersonation",
  "Wallet Drainer",
  "Fake Support",
  "Investment Scam",
  "Other",
];
