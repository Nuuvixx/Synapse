/**
 * Graph Canvas Component
 * 
 * Main React Flow canvas for rendering the browsing graph.
 * Uses D3-force simulation for organic node positioning.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Background,
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
          // Get tab associations and switch if tab exists for this node
          const { getTabNodeAssociations } = await import('@/hooks/useTabNodeSync');
          const associations = getTabNodeAssociations();
          // Find tabId for this nodeId
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


// Convert graph data to React Flow format with optional position override
const convertToFlowNodes = (
  nodes: GraphNode[],
  simulatedPositions?: Map<string, { x: number; y: number }>
): Node[] => {
  return nodes.map((node, index) => {
    // Priority: simulated position > stored position > calculated fallback
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
    type: 'smoothstep',
    animated: true,
    style: {
      stroke: '#22d3ee',
      strokeWidth: 2,
      opacity: 0.6
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#22d3ee'
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

    // Update React Flow nodes with new positions
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
    linkDistance: 180,
    chargeStrength: -500,
    collisionRadius: 1.3,
    alphaDecay: 0.03,
    velocityDecay: 0.5,
    onTick: usePhysics ? handleSimulationTick : undefined
  });

  // Load initial data once on mount
  useEffect(() => {
    if (!hasInitialized) {
      loadGraphData().then(() => {
        setHasInitialized(true);
      });

      // Listen for graph updates from background (only in extension mode)
      const handleMessage = (message: { action: string }) => {
        if (message.action === 'graphUpdated') {
          loadGraphData();
        }
      };

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => {
          chrome.runtime.onMessage.removeListener(handleMessage);
        };
      }
    }
  }, [hasInitialized, loadGraphData]);

  // Update simulation when store data changes
  useEffect(() => {
    if (usePhysics && storeNodes.length > 0) {
      updateSimulation(storeNodes, storeEdges);
    } else {
      // No physics - directly convert nodes
      setNodes(convertToFlowNodes(storeNodes));
      setEdges(convertToFlowEdges(storeEdges));
    }
  }, [storeNodes, storeEdges, usePhysics, updateSimulation, setNodes, setEdges]);

  // Update edges (always needed)
  useEffect(() => {
    setEdges(convertToFlowEdges(storeEdges));
  }, [storeEdges, setEdges]);

  // Fit view when nodes are first loaded
  useEffect(() => {
    if (hasInitialized && nodes.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.3, duration: 500 }), 500);
      return () => clearTimeout(timer);
    }
  }, [hasInitialized, nodes.length, fitView]);

  // Handle node position changes from React Flow
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);

    // Debounce position updates to background (for persisting user-dragged positions)
    changes.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
          updateNodePosition(change.id, change.position as XYPosition);
        }, 500);
      }
    });
  }, [onNodesChange, updateNodePosition]);

  // Handle drag start
  const handleDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    dragStartTimeRef.current = Date.now();
    if (usePhysics) {
      simDragStart(node.id);
    }
  }, [usePhysics, simDragStart]);

  // Handle drag
  const handleDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    if (usePhysics) {
      simDrag(node.id, node.position.x, node.position.y);
    }
  }, [usePhysics, simDrag]);

  // Handle drag end
  const handleDragEnd = useCallback((_event: React.MouseEvent, node: Node) => {
    const dragDuration = Date.now() - dragStartTimeRef.current;
    const wasLongDrag = dragDuration > 300; // 300ms threshold

    if (usePhysics) {
      simDragEnd(node.id, wasLongDrag);
    }

    // Always update position in store for persistence
    updateNodePosition(node.id, node.position);
  }, [usePhysics, simDragEnd, updateNodePosition]);

  // Handle selection
  const handleSelectionChange = useCallback((params: { nodes: Node[] }) => {
    if (params.nodes.length === 1) {
      selectNode(params.nodes[0].id);
    } else if (params.nodes.length === 0) {
      selectNode(null);
    }
  }, [selectNode]);

  // Handle connect (manual edge creation)
  const handleConnect = useCallback((connection: Connection) => {
    setEdges((eds: Edge[]) => addEdge({
      ...connection,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' }
    }, eds));
  }, [setEdges]);

  // Toggle physics
  const handleTogglePhysics = useCallback(() => {
    if (usePhysics) {
      stopSimulation();
    } else {
      restartSimulation(0.5);
    }
    setUsePhysics(!usePhysics);
  }, [usePhysics, stopSimulation, restartSimulation]);

  // Selected node data
  const selectedNode = selectedNodeIds.length === 1
    ? storeNodes.find(n => n.id === selectedNodeIds[0])
    : null;

  // Check if we're still loading (no nodes yet and hasn't initialized)
  const isLoading = !hasInitialized && storeNodes.length === 0;

  return (
    <div ref={canvasRef} className="w-full h-full bg-slate-950 relative overflow-hidden">
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-cyan-400 text-sm">Loading your browsing graph...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* React Flow Canvas */}
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
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-950"
      >
        {/* Background */}
        <Background
          color="#334155"
          gap={20}
          size={1}
          className="bg-slate-950"
        />

        {/* Controls */}
        <Controls className="bg-slate-800 border-slate-700 text-slate-200" />

        {/* MiniMap */}
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-slate-800 border border-slate-700 rounded-lg"
            maskColor="rgba(15, 23, 42, 0.8)"
            nodeColor={(node) => {
              const n = node.data as unknown as GraphNode;
              return n?.status === 'closed' ? '#64748b' : '#22d3ee';
            }}
          />
        )}

        {/* Toolbar Panel */}
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

        {/* Stats Panel */}
        <Panel position="top-right" className="m-4 mt-8">
          <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-3">Session Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-cyan-400">{storeNodes.length}</p>
                <p className="text-xs text-slate-500">Pages</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{storeEdges.length}</p>
                <p className="text-xs text-slate-500">Links</p>
              </div>
            </div>
            {usePhysics && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Physics Active
                </p>
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>

      {/* Timeline Slider */}
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

      {/* Node Detail Panel */}
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
