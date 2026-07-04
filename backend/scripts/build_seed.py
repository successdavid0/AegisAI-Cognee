"""Generate the AEGIS demo seed dataset (5 scam campaigns).

Deterministic: run any time to (re)write backend/data/*.json. Produces a
coherent world that exceeds the MVP minimum dataset:
  >=30 wallets, >=15 domains/URLs, >=10 messages, >=8 handles, >=8 contracts,
  5 scam clusters, >=60 relationships, >=20 reports, 5 false-positive corrections.

Wallet/contract addresses are deterministic 40-hex derived from a label, so IDs
and relationships stay stable across regenerations.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


def addr(label: str) -> str:
    return "0x" + hashlib.sha1(label.encode()).hexdigest()[:40]


entities: list[dict] = []
relationships: list[dict] = []
reports: list[dict] = []
messages: list[dict] = []
corrections: list[dict] = []
_seen_values: set[str] = set()


def add_entity(value, etype, cluster=None, chain=None, status="flagged",
               risk_label="critical", confidence=0.85, source="demo_seed", desc=""):
    if value in _seen_values:
        return value
    _seen_values.add(value)
    entities.append({
        "entity_type": etype, "value": value, "chain": chain, "status": status,
        "risk_label": risk_label, "confidence": confidence, "source": source,
        "cluster": cluster, "description": desc,
    })
    return value


def rel(a, at, r, b, bt, conf, ev):
    relationships.append({
        "from_value": a, "from_type": at, "relationship_type": r,
        "to_value": b, "to_type": bt, "confidence": conf, "evidence": ev,
    })


def report(value, etype, scam_type, desc, source, conf, status):
    reports.append({
        "entity_value": value, "entity_type": etype, "scam_type": scam_type,
        "description": desc, "evidence": desc, "source": source,
        "confidence": conf, "status": status,
    })


# ---------------------------------------------------------------------------
# Campaign builder: wires the standard scam topology for one campaign.
# ---------------------------------------------------------------------------
def build_campaign(cluster, chain, domains, handles, wallets, contracts, msgs,
                   scam_type, public_source):
    """wallets[0]=drainer/receiver, contracts each deployed by a wallet."""
    for d in domains:
        add_entity(d, "domain", cluster, desc=f"{scam_type} domain in {cluster}.")
    for h in handles:
        add_entity(h, "handle", cluster, desc=f"Impersonating handle promoting {cluster}.")
    wvals = []
    for i, w in enumerate(wallets):
        role = "drainer" if i == 0 else "launderer"
        v = add_entity(addr(f"{cluster}-wallet-{w}"), "wallet", cluster, chain=chain,
                       desc=f"{role.title()} wallet in {cluster}.")
        wvals.append(v)
    cvals = []
    for c in contracts:
        v = add_entity(addr(f"{cluster}-contract-{c}"), "contract", cluster, chain=chain,
                       risk_label="high", confidence=0.78,
                       desc=f"Malicious contract in {cluster}.")
        cvals.append(v)

    # Relationships (the topology that makes the graph "cook").
    for h in handles:
        rel(h, "handle", "promotes", domains[0], "domain", 0.85,
            "Fake support handle shares the campaign link.")
    for d in domains:
        rel(d, "domain", "mentions_wallet", wvals[0], "wallet", 0.95,
            "Phishing page directs victims to connect/send funds.")
        if cvals:
            rel(d, "domain", "deploys", cvals[0], "contract", 0.8, "Domain drops the drainer contract.")
    for i in range(len(wvals) - 1):
        rel(wvals[i], "wallet", "sends_funds_to", wvals[i + 1], "wallet", 0.9,
            "On-chain laundering hop.")
    for c in cvals:
        rel(c, "contract", "deployed_by", wvals[-1], "wallet", 0.75, "Deployer wallet.")

    # Messages
    for j, text in enumerate(msgs):
        mid = f"msg_{cluster.split()[1].lower()}_{j+1}"
        messages.append({
            "message_id": mid, "text": text, "scam_type": scam_type,
            "linked_domain": domains[0], "confidence": 0.9,
        })
        add_entity(mid, "message", cluster, status="flagged", risk_label="high",
                   confidence=0.85, desc=text[:80])
        rel(mid, "message", "references", domains[0], "domain", 0.9, "Message links the phishing domain.")

    # Reports (mix of verified + pending; drainer gets a public-source report)
    report(domains[0], "domain", scam_type,
           f"Reported phishing page for {cluster}.", public_source, 0.9, "verified")
    report(wvals[0], "wallet", scam_type,
           "Wallet received victim funds from this campaign.", "internal", 0.88, "verified")
    report(wvals[0], "wallet", scam_type,
           "Second independent report of the same drainer wallet.", "community", 0.8, "pending")
    report(handles[0], "handle", "impersonation",
           "Fake support handle DMing victims.", "community", 0.72, "pending")
    return wvals, cvals


# ---------------------------------------------------------------------------
# The five campaigns.
# ---------------------------------------------------------------------------
build_campaign(
    "Fake OKX Airdrop", "ethereum",
    domains=["claim-okx-reward-demo.com", "okx-airdrop-claim.io", "okx-claim-portal.net"],
    handles=["@okx_support_bonus", "@okx_rewards_bot"],
    wallets=["a", "b", "c", "d", "e", "f"],
    contracts=["drainer", "approval"],
    msgs=[
        "Congratulations, your wallet was selected for the OKX reward airdrop. Connect your wallet and claim within 24 hours.",
        "OKX security alert: verify your wallet now at claim-okx-reward-demo.com or lose access.",
    ],
    scam_type="fake_airdrop", public_source="chainabuse",
)

build_campaign(
    "Fake Binance Support", "ethereum",
    domains=["binance-wallet-verify-demo.com", "binance-helpdesk.support", "binance-account-check.io"],
    handles=["@binance_helpdesk_airdrop", "@support_desk_eth"],
    wallets=["a", "b", "c", "d", "e"],
    contracts=["verify", "sweep"],
    msgs=[
        "Binance Support: suspicious login detected. Re-validate your wallet immediately to avoid suspension.",
        "Your Binance account is limited. Confirm ownership at binance-wallet-verify-demo.com.",
    ],
    scam_type="phishing", public_source="cryptoscamdb",
)

build_campaign(
    "WhatsApp Investment Scam", None,
    domains=["wa-invest-demo.com", "wa.me/demo-investment-group"],
    handles=["@wa_invest_admin", "@crypto_giveaway_now"],
    wallets=["a", "b", "c", "d"],
    contracts=["pool"],
    msgs=[
        "Invest $100 and receive $500 in 24 hours. Guaranteed by our licensed traders. Join now.",
        "Our VIP signal group turned $500 into $6,000 this week. Send USDT to join.",
    ],
    scam_type="investment_scam", public_source="community",
)

build_campaign(
    "Rug Pull Token", "ethereum",
    domains=["rugpull-demo-token.com", "moonsafe-presale.io", "moonsafe-airdrop.net"],
    handles=["@moonsafe_official"],
    wallets=["a", "b", "c", "d", "e"],
    contracts=["token", "presale", "lp"],
    msgs=[
        "MoonSafe presale is live! 100x guaranteed. Liquidity locked forever. Buy before it sells out.",
        "Last chance: MoonSafe presale ends tonight. Send ETH to the contract to secure your allocation.",
    ],
    scam_type="rug_pull", public_source="chainabuse",
)

build_campaign(
    "Fake MetaMask Verification", "ethereum",
    domains=["metamask-wallet-verify.com", "metamask-secure-login.app", "metamask-support-desk.com"],
    handles=["@metamask_supporthelp"],
    wallets=["a", "b", "c", "d", "e", "f"],
    contracts=["drainer"],
    msgs=[
        "Your MetaMask needs re-validation. Confirm your secret phrase at metamask-wallet-verify.com to avoid suspension.",
        "MetaMask security team: unusual activity detected. Sync your wallet now to prevent a permanent lock.",
    ],
    scam_type="phishing", public_source="phishtank",
)

# ---------------------------------------------------------------------------
# Whitelisted (legitimate) entities — to demonstrate the -30 whitelist signal.
# ---------------------------------------------------------------------------
add_entity(addr("binance-hot-wallet-1"), "wallet", None, chain="ethereum",
           status="whitelisted", risk_label="low", confidence=0.9, source="whitelist",
           desc="Known Binance exchange hot wallet (legitimate).")
add_entity("uniswap.org", "domain", None, status="whitelisted", risk_label="low",
           confidence=0.95, source="whitelist", desc="Official Uniswap domain (legitimate).")

# ---------------------------------------------------------------------------
# False-positive corrections (5) — the "forget" story.
# ---------------------------------------------------------------------------
fp_wallets = [
    ("okx-fp", "Community mistakenly flagged; verified as a victim wallet, not a scammer."),
    ("binance-fp", "Flagged in error; confirmed to be an exchange deposit address."),
    ("wa-fp", "Duplicate of an already-cleared report; not a scam wallet."),
    ("rug-fp", "Reported by mistake; address belongs to an audited project treasury."),
    ("mm-fp", "False positive: this is a legitimate user's wallet, cleared on review."),
]
for label, reason in fp_wallets:
    v = addr(f"false-positive-{label}")
    add_entity(v, "wallet", None, chain="ethereum", status="flagged",
               risk_label="high", confidence=0.6, source="community",
               desc="Initially reported, later cleared as a false positive.")
    report(v, "wallet", "other", "Initially reported as a scam wallet.", "community", 0.55, "pending")
    corrections.append({
        "entity_value": v, "entity_type": "wallet", "old_status": "flagged",
        "new_status": "cleared", "reason": reason, "action": "forget_scam_claim",
    })

# ---------------------------------------------------------------------------
# Write files + summary
# ---------------------------------------------------------------------------
DATA.mkdir(exist_ok=True)
files = {
    "seed_entities.json": entities,
    "seed_relationships.json": relationships,
    "seed_reports.json": reports,
    "seed_messages.json": messages,
    "seed_corrections.json": corrections,
}
for name, payload in files.items():
    (DATA / name).write_text(json.dumps(payload, indent=2))

counts = {
    "wallets": sum(1 for e in entities if e["entity_type"] == "wallet"),
    "domains/urls": sum(1 for e in entities if e["entity_type"] in ("domain", "url")),
    "handles": sum(1 for e in entities if e["entity_type"] == "handle"),
    "contracts": sum(1 for e in entities if e["entity_type"] == "contract"),
    "messages": len(messages),
    "entities_total": len(entities),
    "relationships": len(relationships),
    "reports": len(reports),
    "corrections": len(corrections),
}
print("Seed written to", DATA)
for k, v in counts.items():
    print(f"  {k}: {v}")
