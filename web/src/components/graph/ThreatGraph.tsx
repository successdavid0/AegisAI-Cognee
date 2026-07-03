"use client";
import { useMemo, useCallback } from "react";
import {
  ReactFlow, Background, BackgroundVariant, Controls, Handle, Position,
  type Node, type Edge, MarkerType,
} from "@xyflow/react";
import { NODE_META, riskColor } from "@/lib/risk";
import { truncateMiddle } from "@/lib/utils";
import type { GraphData, GraphNode } from "@/lib/types";

/* ---- Custom node ---- */
type EntityNodeData = { node: GraphNode; isRoot: boolean };

function EntityNode({ data }: { data: EntityNodeData }) {
  const { node, isRoot } = data;
  const meta = NODE_META[node.type];
  const color =
    node.risk_label && node.risk_label !== "Unknown"
      ? riskColor(node.risk_label)
      : meta.color;
  const cluster = node.type === "cluster";

  return (
    <div
      className="group relative flex items-center gap-2 rounded-xl border bg-surface/95 px-3 py-2 backdrop-blur transition-transform hover:scale-[1.03]"
      style={{
        borderColor: `${color}55`,
        boxShadow: isRoot
          ? `0 0 0 2px ${color}66, 0 0 26px -4px ${color}`
          : `0 0 18px -8px ${color}`,
        minWidth: cluster ? 190 : 150,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm"
        style={{ background: `${color}1f`, border: `1px solid ${color}44` }}
      >
        {meta.icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted">
          {meta.label}
        </div>
        <div className="mono truncate text-xs text-ink" style={{ maxWidth: 150 }}>
          {truncateMiddle(node.value, 12, 6)}
        </div>
      </div>
      {typeof node.risk_score === "number" && (
        <span
          className="ml-auto text-xs font-bold"
          style={{ color }}
        >
          {node.risk_score}
        </span>
      )}
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

/* ---- Radial layout ---- */
function layout(graph: GraphData): Node<EntityNodeData>[] {
  const rootId =
    graph.nodes.find((n) => n.value === graph.root)?.id ?? graph.nodes[0]?.id;
  const cluster = graph.nodes.find((n) => n.type === "cluster");
  const spokes = graph.nodes.filter((n) => n.id !== rootId && n.id !== cluster?.id);

  const nodes: Node<EntityNodeData>[] = [];
  const cx = 380;
  const cy = 250;

  graph.nodes.forEach((n) => {
    let x = cx, y = cy;
    if (n.id === rootId) {
      x = cx; y = cy;
    } else if (cluster && n.id === cluster.id) {
      x = cx; y = cy - 200;
    } else {
      const idx = spokes.findIndex((s) => s.id === n.id);
      const angle = (Math.PI * 2 * idx) / Math.max(1, spokes.length) + Math.PI / 6;
      const radius = 230;
      x = cx + radius * Math.cos(angle);
      y = cy + radius * Math.sin(angle) * 0.62 + 40;
    }
    nodes.push({
      id: n.id,
      type: "entity",
      position: { x, y },
      data: { node: n, isRoot: n.id === rootId },
    });
  });
  return nodes;
}

export function ThreatGraph({
  graph, onSelect, height = 520,
}: {
  graph: GraphData;
  onSelect?: (node: GraphNode | null) => void;
  height?: number;
}) {
  const nodes = useMemo(() => layout(graph), [graph]);
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e, i) => ({
        id: `e${i}`,
        source: e.from,
        target: e.to,
        label: e.relationship_type.replace(/_/g, " "),
        animated: e.relationship_type === "drains_to",
        style: { stroke: "rgba(255,255,255,0.16)", strokeWidth: 1.4 },
        labelStyle: { fill: "#7b7c8c", fontSize: 10 },
        labelBgStyle: { fill: "#0d0d13", fillOpacity: 0.85 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.3)" },
      })),
    [graph],
  );

  const byId = useMemo(
    () => Object.fromEntries(graph.nodes.map((n) => [n.id, n])),
    [graph],
  );

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => onSelect?.(byId[node.id] ?? null),
    [byId, onSelect],
  );

  return (
    <div
      className="panel overflow-hidden"
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onSelect?.(null)}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.6}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(255,255,255,0.06)" />
        <Controls
          showInteractive={false}
          className="!border-line !bg-surface-2 [&>button]:!border-line [&>button]:!bg-surface-2 [&>button]:!fill-ink-soft [&>button:hover]:!bg-elevated"
        />
      </ReactFlow>
    </div>
  );
}
