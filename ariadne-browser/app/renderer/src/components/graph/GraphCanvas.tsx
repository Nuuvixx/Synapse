/**
 * Graph Canvas Component — Stitch & Glass Design
 * 
 * Main React Flow canvas with deep space background,
 * glowing edges, and refined node interactions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Panel,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
  addEdge,
  MarkerType,
  ReactFlow,
  type XYPosition
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useGraphStore } from '@/store/graphStore';
import { NodeCard } from './NodeCard';
import { GraphToolbar } from './GraphToolbar';
import { TimelineSlider } from './TimelineSlider';
import { NodeDetailPanel } from './NodeDetailPanel';
import { useForceSimulation, type SimNode } from '@/hooks/useForceSimulation';
import type { GraphNode } from '@/types';
import CustomEdge from './CustomEdge';

const edgeTypes = {
  default: CustomEdge,
};

// Custom node types
const nodeTypes: NodeTypes = {
  pageNode: ({ data, selected }) => {
    const selectNode = useGraphStore(state => state.selectNode);
    const focusNode = useGraphStore(state => state.focusNode);
    const reopenNode = useGraphStore(state => state.reopenNode);

    const nodeData = data as unknown as GraphNode;

    const handleClick = () => {
      selectNode(nodeData.id);
    };

    const handleDoubleClick = async () => {
      if (nodeData.status === 'closed') {
        reopenNode(nodeData.id);
      } else {
        focusNode(nodeData.id);
        // Switch to associated browser tab if available
        if (window.api?.tab) {
          const { getTabNodeAssociations } = await import('@/hooks/useTabNodeSync');
          const associations = getTabNodeAssociations();
          for (const [tabId, nodeId] of associations.entries()) {
            if (nodeId === nodeData.id) {
              await window.api.tab.switchTab(tabId);
              break;
            }
          }
        }
      }
    };

    return (
      <NodeCard
        node={nodeData}
        selected={selected || false}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />
    );
  }
};


// Convert graph data to React Flow format
const convertToFlowNodes = (
  nodes: GraphNode[],
  simulatedPositions?: Map<string, { x: number; y: number }>
): Node[] => {
  return nodes.map((node, index) => {
    const simPos = simulatedPositions?.get(node.id);
    const position = simPos || node.position || {
      x: (index % 5) * 250 + 200,
      y: Math.floor(index / 5) * 200 + 100
    };

    return {
      id: node.id,
      type: 'pageNode',
      position,
      data: node as unknown as Record<string, unknown>,
      draggable: true,
      selectable: true,
      connectable: false
    };
  });
};

const convertToFlowEdges = (edges: { id: string; source: string; target: string }[]): Edge[] => {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'default',
    animated: false, // Animation is handled by CustomEdge now
    style: {
      stroke: 'url(#edge-gradient)', // We'll define this SVG gradient in the component
      strokeWidth: 2,
      opacity: 0.8,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: 'var(--sg-purple)'
    }
  }));
};

export function GraphCanvas() {
  const { fitView, setViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [usePhysics, setUsePhysics] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });

  // Store state
  const storeNodes = useGraphStore(state => state.nodes);
  const storeEdges = useGraphStore(state => state.edges);
  const selectedNodeIds = useGraphStore(state => state.selectedNodeIds);
  const selectNode = useGraphStore(state => state.selectNode);
  const updateNodePosition = useGraphStore(state => state.updateNodePosition);
  const loadGraphData = useGraphStore(state => state.loadGraphData);

  // Refs
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartTimeRef = useRef<number>(0);
  const simulatedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Track canvas size
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        setCanvasSize({
          width: canvasRef.current.clientWidth || 1200,
          height: canvasRef.current.clientHeight || 800
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Force simulation hook
  const handleSimulationTick = useCallback((simNodes: SimNode[]) => {
    const newPositions = new Map<string, { x: number; y: number }>();
    simNodes.forEach(node => {
      newPositions.set(node.id, { x: node.x, y: node.y });
    });
    simulatedPositionsRef.current = newPositions;

    setNodes(currentNodes =>
      currentNodes.map(node => {
        const newPos = newPositions.get(node.id);
        if (newPos && !node.dragging) {
          return { ...node, position: newPos };
        }
        return node;
      })
    );
  }, [setNodes]);

  const {
    updateSimulation,
    onDragStart: simDragStart,
    onDrag: simDrag,
    onDragEnd: simDragEnd,
    stop: stopSimulation,
    restart: restartSimulation
  } = useForceSimulation({
    width: canvasSize.width,
    height: canvasSize.height,
    linkDistance: 250,
    chargeStrength: -400,
    collisionRadius: 100,
    alphaDecay: 0.02,
    velocityDecay: 0.6,
    onTick: usePhysics ? handleSimulationTick : undefined
  });

  // Load initial data
  useEffect(() => {
    if (!hasInitialized) {
      loadGraphData().then(() => setHasInitialized(true));
      const handleMessage = (message: { action: string }) => {
        if (message.action === 'graphUpdated') loadGraphData();
      };
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => { chrome.runtime.onMessage.removeListener(handleMessage); };
      }
    }
    return undefined;
  }, [hasInitialized, loadGraphData]);

  // Update simulation
  useEffect(() => {
    if (usePhysics && storeNodes.length > 0) {
      updateSimulation(storeNodes, storeEdges);
    } else {
      setNodes(convertToFlowNodes(storeNodes));
      setEdges(convertToFlowEdges(storeEdges));
    }
  }, [storeNodes, storeEdges, usePhysics, updateSimulation, setNodes, setEdges]);

  // Update edges
  useEffect(() => {
    setEdges(convertToFlowEdges(storeEdges));
  }, [storeEdges, setEdges]);

  // Initial fit view
  useEffect(() => {
    if (hasInitialized && nodes.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.3, duration: 500 }), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasInitialized, nodes.length, fitView]);

  // Handle updates
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    changes.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = setTimeout(() => {
          updateNodePosition(change.id, change.position as XYPosition);
        }, 500);
      }
    });
  }, [onNodesChange, updateNodePosition]);

  const handleDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    dragStartTimeRef.current = Date.now();
    if (usePhysics) simDragStart(node.id);
  }, [usePhysics, simDragStart]);

  const handleDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    if (usePhysics) simDrag(node.id, node.position.x, node.position.y);
  }, [usePhysics, simDrag]);

  const handleDragEnd = useCallback((_event: React.MouseEvent, node: Node) => {
    const dragDuration = Date.now() - dragStartTimeRef.current;
    if (usePhysics) simDragEnd(node.id, dragDuration > 300);
    updateNodePosition(node.id, node.position);
  }, [usePhysics, simDragEnd, updateNodePosition]);

  const handleSelectionChange = useCallback((params: { nodes: Node[] }) => {
    if (params.nodes.length === 1) selectNode(params.nodes[0].id);
    else if (params.nodes.length === 0) selectNode(null);
  }, [selectNode]);

  const handleConnect = useCallback((connection: Connection) => {
    setEdges((eds: Edge[]) => addEdge({
      ...connection,
      type: 'default',
      animated: true,
      style: { stroke: 'var(--sg-cyan)', strokeWidth: 2, opacity: 0.6 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--sg-cyan)' }
    }, eds));
  }, [setEdges]);

  const handleTogglePhysics = useCallback(() => {
    if (usePhysics) stopSimulation();
    else restartSimulation(0.5);
    setUsePhysics(!usePhysics);
  }, [usePhysics, stopSimulation, restartSimulation]);

  const selectedNode = selectedNodeIds.length === 1
    ? storeNodes.find(n => n.id === selectedNodeIds[0])
    : null;

  const isLoading = !hasInitialized && storeNodes.length === 0;

  return (
    <div ref={canvasRef} className="w-full h-full relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at bottom, #0F172A 0%, #020617 100%)' }}>
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center flex-col gap-4"
            style={{ background: 'var(--sg-bg-deep)', backdropFilter: 'blur(4px)' }}
          >
            <div className="w-12 h-12 border-4 rounded-full animate-spin"
              style={{ borderColor: 'var(--sg-cyan)', borderTopColor: 'transparent' }} />
            <p style={{ color: 'var(--sg-cyan)' }}>Loading your browsing graph...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onConnect={handleConnect}
        onNodeDragStart={handleDragStart}
        onNodeDrag={handleDrag}
        onNodeDragStop={handleDragEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        {/* ─── Shared Atmosphere (CSS Starfield) ─── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="stars-small" />
          <div className="stars-medium" />
          <div className="stars-large" />
        </div>

        {/* Define Gradient for Edges */}
        <svg style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>

        <Controls
          style={{
            background: 'var(--sg-surface-2)',
            border: '1px solid var(--sg-glass-border)',
            color: 'var(--sg-text-primary)',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}
        />

        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            style={{
              background: 'var(--sg-surface-2)',
              border: '1px solid var(--sg-glass-border)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}
            maskColor="rgba(2, 6, 23, 0.8)"
            nodeColor={(node) => {
              const n = node.data as unknown as GraphNode;
              return n?.status === 'closed' ? 'var(--sg-text-tertiary)' : 'var(--sg-cyan)';
            }}
          />
        )}

        <Panel position="top-left" className="m-4 mt-8">
          <GraphToolbar
            onFitView={() => fitView({ padding: 0.3, duration: 300 })}
            onResetView={() => setViewport({ x: 0, y: 0, zoom: 1 })}
            onToggleTimeline={() => setShowTimeline(!showTimeline)}
            onToggleMinimap={() => setShowMinimap(!showMinimap)}
            onTogglePhysics={handleTogglePhysics}
            showTimeline={showTimeline}
            showMinimap={showMinimap}
            usePhysics={usePhysics}
          />
        </Panel>

        <Panel position="top-right" className="m-4 mt-8">
          <div className="sg-glass rounded-xl p-4 sg-glow-purple">
            <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--sg-text-ghost)' }}>Session Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--sg-cyan)' }}>{storeNodes.length}</p>
                <p className="text-xs" style={{ color: 'var(--sg-text-secondary)' }}>Pages</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--sg-purple)' }}>{storeEdges.length}</p>
                <p className="text-xs" style={{ color: 'var(--sg-text-secondary)' }}>Links</p>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      <AnimatePresence>
        {showTimeline && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 z-10"
          >
            <TimelineSlider onClose={() => setShowTimeline(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute top-20 right-4 z-10"
          >
            <NodeDetailPanel node={selectedNode} onClose={() => selectNode(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
