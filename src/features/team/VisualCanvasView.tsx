import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, Edit3, LayoutGrid, Maximize2, Minimize2, Network, Plus, Trash2 } from 'lucide-react';
import {
  Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, addEdge,
  useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTeamStore } from './team-store';
import type { DiagramNode, VisualDiagram } from './team-types';
import { confirmDialog } from '../../components/ui/native-dialog';

interface VisualCanvasViewProps { missionId: string; }
type FlowData = { label: string; sublabel?: string; type: string };
type NodeDraft = { label: string; sublabel: string; type: string };
/** Every node tone resolves to a theme token, so diagrams follow the palette. */
const NODE_TONE: Record<string, string> = {
  actor: 'var(--accent)',
  process: 'var(--border-strong)',
  system: 'var(--success)',
  database: 'var(--warning)',
  action: 'var(--accent-soft)',
};

const handleStyle = {
  width: 8,
  height: 8,
  background: 'rgb(var(--surface-1))',
  border: '2px solid rgb(var(--border-strong))',
};

function SynCatchNode({ data, selected }: NodeProps) {
  const { label, sublabel, type } = data as unknown as FlowData;
  const tone = NODE_TONE[type] ?? NODE_TONE.process;

  return (
    <div
      className="w-[210px] overflow-hidden rounded-xl border bg-panel shadow-[0_10px_24px_rgb(var(--shadow-color)/0.2)] transition-shadow"
      style={{
        borderColor: selected ? `rgb(${tone})` : `rgb(${tone} / 0.5)`,
        boxShadow: selected ? `0 0 0 2px rgb(${tone} / 0.35)` : undefined,
      }}
    >
      {/* Tone rail — reads the node's kind at a glance without a legend. */}
      <div className="h-1 w-full" style={{ background: `rgb(${tone})` }} />
      <div className="px-3 py-2.5">
        <p
          className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em]"
          style={{ color: `rgb(${tone})` }}
        >
          {type}
        </p>
        <p className="text-[13px] font-semibold leading-snug text-text-primary">{label}</p>
        {sublabel ? (
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-text-secondary">{sublabel}</p>
        ) : null}
      </div>

      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}

// Must stay referentially stable or ReactFlow re-registers on every render.
const nodeTypes = { syncatch: SynCatchNode };

const toFlowNodes = (nodes: DiagramNode[]): Node<FlowData>[] => nodes.map((node) => ({ id: node.id, type: 'syncatch', position: { x: node.x, y: node.y }, data: { label: node.label, sublabel: node.sublabel, type: node.type } }));
const toDiagramNodes = (nodes: Node<FlowData>[]): DiagramNode[] => nodes.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y, label: node.data.label, sublabel: node.data.sublabel, type: (node.data.type as DiagramNode['type']) || 'process', color: 'blue' }));


/** Node card width is fixed (see SynCatchNode), so spacing can be exact. */
const NODE_WIDTH = 210;
const COLUMN_STEP = NODE_WIDTH + 110;
const ROW_STEP = 170;

/** Rough rendered card height; only used to decide whether cards collide. */
const NODE_HEIGHT = 110;

/**
 * True when any two cards sit close enough to touch. Diagrams saved with
 * hand-picked coordinates (or seeded ones) routinely pack cards tighter than
 * their own width, which leaves edges and their labels no room and makes the
 * whole thing unreadable.
 */
function hasCollisions(nodes: Node<FlowData>[]): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const dx = Math.abs(nodes[i].position.x - nodes[j].position.x);
      const dy = Math.abs(nodes[i].position.y - nodes[j].position.y);
      if (dx < NODE_WIDTH + 40 && dy < NODE_HEIGHT + 30) return true;
    }
  }
  return false;
}

/**
 * Re-lays a diagram left-to-right in dependency order.
 *
 * Saved coordinates can put cards on top of each other — a diagram authored at
 * one size, or seeded with tight spacing, ends up unreadable and zooming does
 * not help. Column comes from the longest path to a node, so an arrow always
 * points rightward; within a column the existing vertical order is kept, so
 * whatever the author intended top-to-bottom survives the tidy.
 */
function autoLayout(nodes: Node<FlowData>[], edges: Edge[]): Node<FlowData>[] {
  if (nodes.length === 0) return nodes;

  const known = new Set(nodes.map((node) => node.id));
  const children = new Map<string, string[]>();
  const indegree = new Map<string, number>(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    if (!known.has(edge.source) || !known.has(edge.target)) continue;
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  // Breadth-first levels rather than longest-path: these diagrams contain real
  // cycles (app -> service -> realtime -> app), and longest-path relaxation
  // inflates depth on every trip round a loop. Visiting each node once keeps
  // the column count bounded and the shape readable.
  const depth = new Map<string, number>();
  const roots = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const fallback = [...nodes]
    .sort((a, b) => (indegree.get(a.id) ?? 0) - (indegree.get(b.id) ?? 0) || a.position.y - b.position.y)[0].id;

  const walk = (start: string) => {
    if (depth.has(start)) return;
    depth.set(start, 0);
    let frontier = [start];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const child of children.get(id) ?? []) {
          if (depth.has(child)) continue;
          depth.set(child, (depth.get(id) ?? 0) + 1);
          next.push(child);
        }
      }
      frontier = next;
    }
  };

  // A fully cyclic diagram has no root, so seed from the least-depended-on node.
  (roots.length > 0 ? roots : [fallback]).forEach(walk);
  // Anything in a disconnected component still needs a column.
  nodes.forEach((node) => walk(node.id));


  const columns = new Map<number, Node<FlowData>[]>();
  for (const node of [...nodes].sort((a, b) => a.position.y - b.position.y)) {
    const column = depth.get(node.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), node]);
  }

  const tallest = Math.max(...[...columns.values()].map((column) => column.length));

  return nodes.map((node) => {
    const column = depth.get(node.id) ?? 0;
    const siblings = columns.get(column) ?? [];
    const row = siblings.findIndex((sibling) => sibling.id === node.id);
    // Centre short columns against the tallest one so the shape reads evenly.
    const offset = ((tallest - siblings.length) * ROW_STEP) / 2;
    return { ...node, position: { x: column * COLUMN_STEP, y: offset + row * ROW_STEP } };
  });
}

function FlowEditor({ diagram, onChange }: { diagram: VisualDiagram; onChange: (nodes: Node<FlowData>[], edges: Edge[]) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(diagram.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(diagram.edges.map((edge) => ({ id: edge.id, source: edge.from, target: edge.to, label: edge.label, animated: edge.dashed })));
  const [nodeDraft, setNodeDraft] = useState<NodeDraft>({ label: '', sublabel: '', type: 'process' });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeEditorOpen, setNodeEditorOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const { fitView } = useReactFlow();
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // Escape leaves fullscreen; without it the only way out is the toggle.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);
  useEffect(() => {
    const loadedNodes = toFlowNodes(diagram.nodes);
    const loadedEdges = diagram.edges.map((edge) => ({ id: edge.id, source: edge.from, target: edge.to, label: edge.label, animated: edge.dashed }));
    setEdges(loadedEdges);

    // Open readable by default. Only rearrange when the saved coordinates
    // actually collide, so a layout somebody arranged by hand is left alone.
    // Persisting the result means this self-heals once rather than on every load.
    if (hasCollisions(loadedNodes)) {
      const arranged = autoLayout(loadedNodes, loadedEdges);
      setNodes(arranged);
      onChangeRef.current(arranged, loadedEdges);
      window.setTimeout(() => fitView({ padding: 0.15, duration: 0 }), 0);
      return;
    }

    setNodes(loadedNodes);
  }, [diagram.id, fitView, setEdges, setNodes]);
  const persistNodes = useCallback((next: Node<FlowData>[]) => { setNodes(next); onChange(next, edges); }, [edges, onChange, setNodes]);
  const tidyLayout = useCallback(() => {
    const arranged = autoLayout(nodes, edges);
    setNodes(arranged);
    onChange(arranged, edges);
    // Fit after the new positions have been committed, not against the old ones.
    window.setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 0);
  }, [edges, fitView, nodes, onChange, setNodes]);
  const handleNodesChange = useCallback(async (changes: Parameters<typeof onNodesChange>[0]) => {
    const removed = changes.some((change) => change.type === 'remove');
    if (removed && !await confirmDialog('Connected lines may also be removed.', { title: 'Delete diagram node?', confirmLabel: 'Delete', danger: true })) return;
    onNodesChange(changes);
    const moved = changes.some((change) => change.type === 'position' && change.dragging === false);
    if (!moved && !removed) return;
    // Read after the state update lands so removals are reflected.
    window.setTimeout(() => setNodes((current) => { onChange(current, edges); return current; }), 0);
  }, [edges, onChange, onNodesChange, setNodes]);

  const handleEdgesChange = useCallback(async (changes: Parameters<typeof onEdgesChange>[0]) => {
    if (changes.some((change) => change.type === 'remove') && !await confirmDialog('Delete the selected connection?', { title: 'Delete connection', confirmLabel: 'Delete', danger: true })) return;
    onEdgesChange(changes);
    if (!changes.some((change) => change.type === 'remove')) return;
    window.setTimeout(() => setEdges((current) => { onChange(nodes, current); return current; }), 0);
  }, [nodes, onChange, onEdgesChange, setEdges]);
  const connect = useCallback((connection: Connection) => { const next = addEdge({ ...connection, animated: false, style: { stroke: 'rgb(var(--accent))' } }, edges); setEdges(next); onChange(nodes, next); }, [edges, nodes, onChange, setEdges]);
  const openNodeEditor = (node?: Node<FlowData>) => { setEditingNodeId(node?.id ?? null); setNodeDraft(node ? { label: node.data.label, sublabel: node.data.sublabel ?? '', type: node.data.type } : { label: '', sublabel: '', type: 'process' }); setNodeEditorOpen(true); };
  const saveNode = (event: React.FormEvent) => {
    event.preventDefault();
    const label = nodeDraft.label.trim();
    if (!label) return;

    const next: Node<FlowData>[] = editingNodeId
      ? nodes.map((node) =>
          node.id === editingNodeId ? { ...node, data: { ...node.data, ...nodeDraft, label } } : node,
        )
      : [
          ...nodes,
          {
            id: `${diagram.id}-node-${Date.now().toString(36)}`,
            // Must match the registered node type, or ReactFlow silently falls
            // back to its default white box and drops the sublabel.
            type: 'syncatch',
            position: { x: 80 + (nodes.length % 3) * 260, y: 70 + Math.floor(nodes.length / 3) * 160 },
            data: { ...nodeDraft, label },
          },
        ];

    persistNodes(next);
    setEditingNodeId(null);
    setNodeDraft({ label: '', sublabel: '', type: 'process' });
    setNodeEditorOpen(false);
  };
  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-[95] overflow-hidden border-0 bg-panel2'
          : 'relative h-[clamp(420px,calc(100vh-19rem),720px)] overflow-hidden rounded-2xl border border-borderSoft/40 bg-panel2/55'
      }
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={connect}
        onNodeDoubleClick={(_, node) => openNodeEditor(node as Node<FlowData>)}
        fitView
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgb(var(--border-subtle))" gap={22} />
        <Controls className="!bottom-4 !left-4 overflow-hidden !rounded-xl !border !border-borderSoft/40 !bg-panel !text-text-primary !shadow-lg [&>button]:!border-borderSoft/30 [&>button]:!bg-panel [&>button]:!text-text-primary [&>button:hover]:!bg-panel2 [&_svg]:!fill-current" />
        <MiniMap
          className="!bottom-4 !right-4 !h-20 !w-28 overflow-hidden !rounded-xl !border !border-borderSoft/40 !shadow-lg md:!h-28 md:!w-40"
          bgColor="rgb(var(--surface-1))"
          nodeColor="rgb(var(--accent))"
          maskColor="rgb(var(--bg-base) / .75)"
        />
      </ReactFlow>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={tidyLayout}
          title="Tidy layout — arrange left to right and fit to view"
          aria-label="Tidy layout"
          className="flex h-9 items-center gap-1.5 rounded-xl border border-borderSoft/40 bg-panel px-3 text-text-secondary shadow-lg transition-colors hover:text-text-primary"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="text-[12px] font-semibold">Tidy</span>
        </button>
        <button
          type="button"
          onClick={() => setFullscreen((current) => !current)}
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-borderSoft/40 bg-panel text-text-secondary shadow-lg transition-colors hover:text-text-primary"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Says what the canvas can do — otherwise every gesture is a guess. */}
      <p className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-borderSoft/50 bg-panel/90 px-3 py-1 text-[11px] text-text-secondary shadow-sm md:block">
        Drag to move · pull a dot to connect · double-click to edit · Delete to remove
      </p>

      <button
        type="button"
        onClick={() => openNodeEditor()}
        className="absolute bottom-28 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent px-3 py-2 text-xs font-bold text-[rgb(var(--accent-contrast))] shadow-lg md:bottom-5"
      >
        <Plus className="h-4 w-4" />Add node
      </button>

      {nodeEditorOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={() => setNodeEditorOpen(false)}>
          <form onSubmit={saveNode} onMouseDown={(event) => event.stopPropagation()} className="w-[min(92%,380px)] rounded-2xl border border-borderSoft/50 bg-panel p-5 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-base font-bold text-text-primary">{editingNodeId ? 'Edit node' : 'Add node'}</h3>
              <p className="mt-1 text-xs text-text-secondary">The kind sets the node's colour on the canvas.</p>
            </div>

            <label className="mb-1.5 block text-xs font-semibold text-text-secondary">Label</label>
            <input
              autoFocus
              required
              value={nodeDraft.label}
              onChange={(e) => setNodeDraft({ ...nodeDraft, label: e.target.value })}
              placeholder="e.g. Player books a slot"
              className="w-full rounded-xl border border-borderSoft/50 bg-panel2 px-3.5 py-2.5 text-sm text-text-primary outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
            />

            <label className="mb-1.5 mt-3 block text-xs font-semibold text-text-secondary">Details <span className="font-normal text-text-muted">(optional)</span></label>
            <textarea
              value={nodeDraft.sublabel}
              onChange={(e) => setNodeDraft({ ...nodeDraft, sublabel: e.target.value })}
              placeholder="Shown under the label on the node"
              className="min-h-16 w-full rounded-xl border border-borderSoft/50 bg-panel2 px-3.5 py-2.5 text-sm text-text-primary outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
            />

            <label className="mb-1.5 mt-3 block text-xs font-semibold text-text-secondary">Kind</label>
            <div className="flex flex-wrap gap-1.5">
              {(['actor', 'process', 'system', 'database', 'action'] as const).map((kind) => {
                const isActive = nodeDraft.type === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setNodeDraft({ ...nodeDraft, type: kind })}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      isActive ? 'border-transparent text-text-primary' : 'border-borderSoft text-text-secondary hover:bg-panel2'
                    }`}
                    style={isActive ? { background: `rgb(${NODE_TONE[kind]} / 0.16)`, borderColor: `rgb(${NODE_TONE[kind]})` } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${NODE_TONE[kind]})` }} />
                    {kind}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setNodeEditorOpen(false)} className="rounded-xl border border-borderSoft/40 px-4 py-2.5 text-xs font-bold text-text-secondary hover:bg-panel2">Cancel</button>
              <button type="submit" disabled={!nodeDraft.label.trim()} className="rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-[rgb(var(--accent-contrast))] disabled:cursor-not-allowed disabled:opacity-45">Save node</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function VisualCanvasView({ missionId }: VisualCanvasViewProps) {
  const diagrams = useTeamStore((state) => state.diagrams); const addDiagram = useTeamStore((state) => state.addDiagram); const updateDiagram = useTeamStore((state) => state.updateDiagram); const deleteDiagram = useTeamStore((state) => state.deleteDiagram); const updateDiagramNodes = useTeamStore((state) => state.updateDiagramNodes); const moveDiagram = useTeamStore((state) => state.moveDiagram);
  const missionDiagrams = useMemo(() => diagrams.filter((diagram) => diagram.missionId === missionId), [diagrams, missionId]); const [selectedId, setSelectedId] = useState(''); const active = missionDiagrams.find((diagram) => diagram.id === selectedId) ?? missionDiagrams[0];
  const [nameDialog, setNameDialog] = useState<'create' | 'rename' | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const create = () => { setTitleDraft(''); setNameDialog('create'); };
  const edit = () => { if (!active) return; setTitleDraft(active.title); setNameDialog('rename'); };
  const saveDiagramName = (event: React.FormEvent) => {
    event.preventDefault();
    const title = titleDraft.trim();
    if (!title) return;
    if (nameDialog === 'create') {
      const diagram = addDiagram({ missionId, title, description: '', diagramType: 'custom', nodes: [], edges: [] });
      setSelectedId(diagram.id);
    } else if (nameDialog === 'rename' && active) {
      updateDiagram(active.id, { title });
    }
    setNameDialog(null);
  };
  const remove = () => { if (active) setDeleteDialogOpen(true); };
  const confirmRemove = () => { if (!active) return; deleteDiagram(active.id); setSelectedId(''); setDeleteDialogOpen(false); };
  const exportJson = () => { if (!active) return; const link = document.createElement('a'); link.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(active, null, 2))}`; link.download = `${active.title.toLowerCase().replace(/\s+/g, '-')}.json`; link.click(); };
  const activePosition = active ? missionDiagrams.findIndex((diagram) => diagram.id === active.id) : -1;
  const persistFlow = (nodes: Node<FlowData>[], edges: Edge[]) => { if (!active) return; updateDiagramNodes(active.id, toDiagramNodes(nodes)); updateDiagram(active.id, { edges: edges.map((edge) => ({ id: edge.id, from: edge.source, to: edge.target, label: typeof edge.label === 'string' ? edge.label : undefined, dashed: Boolean(edge.animated) })) }); };
  return (
    <ReactFlowProvider>
      <div className="space-y-2">
        {active ? (
          <>
            <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-borderSoft/35 bg-panel/55 p-2">
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent sm:flex">
                <Network className="h-4 w-4" />
              </span>
              {missionDiagrams.length > 1 ? (
                // A scrolling strip beats a <select>: every diagram is visible
                // and one click away, and the active one is obvious.
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
                  {missionDiagrams.map((diagram) => {
                    const isActive = diagram.id === active.id;
                    return (
                      <button
                        key={diagram.id}
                        type="button"
                        onClick={() => setSelectedId(diagram.id)}
                        aria-current={isActive ? 'true' : undefined}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                          isActive
                            ? 'bg-accent/14 font-semibold text-accent'
                            : 'font-medium text-text-secondary hover:bg-panel2 hover:text-text-primary'
                        }`}
                      >
                        <span className="max-w-[160px] truncate">{diagram.title}</span>
                        <span className={`tabular-nums ${isActive ? 'text-accent/70' : 'text-text-muted'}`}>
                          {diagram.nodes.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="min-w-0 flex-1 px-1">
                  <h3 className="truncate text-sm font-bold text-text-primary">{active.title}</h3>
                  <p className="text-[11px] text-text-muted">{active.nodes.length} nodes · {active.edges.length} connections</p>
                </div>
              )}
              {missionDiagrams.length > 1 && <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-text-muted lg:inline">{active.nodes.length} nodes · {active.edges.length} connections</span>}
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {missionDiagrams.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => moveDiagram(active.id, 'back')}
                      disabled={activePosition === 0}
                      title="Move diagram back"
                      aria-label="Move diagram back"
                      className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-panel2 hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDiagram(active.id, 'forward')}
                      disabled={activePosition === missionDiagrams.length - 1}
                      title="Move diagram forward"
                      aria-label="Move diagram forward"
                      className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-panel2 hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <span className="mx-1 h-5 w-px bg-borderSoft/60" />
                  </>
                )}
                <button type="button" onClick={create} title="New diagram" aria-label="New diagram" className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-2 text-xs font-bold text-[rgb(var(--accent-contrast))]">
                  <Plus className="h-4 w-4" /><span className="hidden md:inline">New</span>
                </button>
                <button type="button" onClick={edit} title="Rename diagram" aria-label="Rename diagram" className="rounded-lg p-2 text-text-secondary hover:bg-panel2"><Edit3 className="h-4 w-4" /></button>
                <button type="button" onClick={exportJson} title="Export diagram" aria-label="Export diagram" className="rounded-lg p-2 text-text-secondary hover:bg-panel2"><Download className="h-4 w-4" /></button>
                <button type="button" onClick={remove} title="Delete diagram" aria-label="Delete diagram" className="rounded-lg p-2 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <FlowEditor diagram={active} onChange={persistFlow} />
          </>
        ) : (
          <div className="flex h-[clamp(420px,calc(100vh-19rem),720px)] flex-col items-center justify-center rounded-2xl border border-dashed border-borderSoft/50 px-6 text-center text-sm text-text-secondary">
            <Network className="mb-3 h-10 w-10 text-text-muted" />
            <p className="font-semibold text-text-primary">No diagram yet</p>
            <p className="mt-1 max-w-xs text-xs">Map a user journey, a system flow, or a payment path so the whole team reads it the same way.</p>
            <button type="button" onClick={create} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-[rgb(var(--accent-contrast))]"><Plus className="h-4 w-4" />Create diagram</button>
          </div>
        )}
      </div>
      {nameDialog && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[3px]" onMouseDown={() => setNameDialog(null)}>
          <form onSubmit={saveDiagramName} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-borderSoft/45 bg-panel p-5 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-base font-bold text-text-primary">{nameDialog === 'create' ? 'Create diagram' : 'Rename diagram'}</h2>
              <p className="mt-1 text-xs text-text-secondary">Choose a clear name so your team can find this flow quickly.</p>
            </div>
            <label htmlFor="diagram-title" className="mb-2 block text-xs font-semibold text-text-secondary">Diagram name</label>
            <input
              id="diagram-title"
              autoFocus
              required
              maxLength={100}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder="e.g. Booking architecture flow"
              className="w-full rounded-xl border border-borderSoft/50 bg-panel2 px-3.5 py-3 text-sm text-text-primary outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setNameDialog(null)} className="rounded-xl border border-borderSoft/40 px-4 py-2.5 text-xs font-bold text-text-secondary hover:bg-panel2">Cancel</button>
              <button type="submit" disabled={!titleDraft.trim()} className="rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-[rgb(var(--accent-contrast))] disabled:cursor-not-allowed disabled:opacity-45">{nameDialog === 'create' ? 'Create diagram' : 'Save name'}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
      {deleteDialogOpen && active && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[3px]" onMouseDown={() => setDeleteDialogOpen(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-diagram-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-borderSoft/45 bg-panel p-5 shadow-2xl">
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger"><Trash2 className="h-5 w-5" /></span>
            <h2 id="delete-diagram-title" className="text-base font-bold text-text-primary">Delete this diagram?</h2>
            <p className="mt-2 text-sm leading-5 text-text-secondary"><span className="font-semibold text-text-primary">“{active.title}”</span> and all of its nodes and connections will be removed.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl border border-borderSoft/40 px-4 py-2.5 text-xs font-bold text-text-secondary hover:bg-panel2">Cancel</button>
              <button type="button" onClick={confirmRemove} className="rounded-xl bg-danger px-4 py-2.5 text-xs font-bold text-white">Delete diagram</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </ReactFlowProvider>
  );
}
