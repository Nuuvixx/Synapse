/**
 * useForceSimulation Hook
 * 
 * Custom React hook for D3-force physics simulation.
 * Provides organic, force-directed node positioning that settles over time.
 */

import { useRef, useCallback, useEffect } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum
} from 'd3-force';
import type { GraphNode, GraphEdge } from '@/types';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  userPositioned?: boolean;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  source: string | SimNode;
  target: string | SimNode;
}

interface UseForceSimulationOptions {
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Strength of link force (0-1) */
  linkStrength?: number;
  /** Distance between linked nodes */
  linkDistance?: number;
  /** Strength of repulsion between nodes (negative values) */
  chargeStrength?: number;
  /** Collision radius multiplier */
  collisionRadius?: number;
  /** Alpha decay rate (higher = faster settling) */
  alphaDecay?: number;
  /** Velocity decay rate (higher = more friction) */
  velocityDecay?: number;
  /** Callback when positions update */
  onTick?: (nodes: SimNode[]) => void;
}

const DEFAULT_OPTIONS: Required<Omit<UseForceSimulationOptions, 'onTick' | 'width' | 'height'>> = {
  linkStrength: 0.3,
  linkDistance: 150,
  chargeStrength: -400,
  collisionRadius: 1.5,
  alphaDecay: 0.02,
  velocityDecay: 0.4
};

export function useForceSimulation(options: UseForceSimulationOptions) {
  const {
    width,
    height,
    linkStrength = DEFAULT_OPTIONS.linkStrength,
    linkDistance = DEFAULT_OPTIONS.linkDistance,
    chargeStrength = DEFAULT_OPTIONS.chargeStrength,
    collisionRadius = DEFAULT_OPTIONS.collisionRadius,
    alphaDecay = DEFAULT_OPTIONS.alphaDecay,
    velocityDecay = DEFAULT_OPTIONS.velocityDecay,
    onTick
  } = options;

  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  // Initialize simulation
  const initSimulation = useCallback(() => {
    // Node collision radius (half of typical node width)
    const nodeRadius = 100;

    simulationRef.current = forceSimulation<SimNode, SimLink>()
      .force('link', forceLink<SimNode, SimLink>()
        .id(d => d.id)
        .distance(linkDistance)
        .strength(linkStrength)
      )
      .force('charge', forceManyBody<SimNode>()
        .strength(chargeStrength)
        .distanceMax(500)
      )
      .force('center', forceCenter(width / 2, height / 2).strength(0.05))
      .force('collision', forceCollide<SimNode>()
        .radius(nodeRadius * collisionRadius)
        .strength(0.8)
      )
      // Gentle forces to keep nodes from flying off
      .force('x', forceX<SimNode>(width / 2).strength(0.02))
      .force('y', forceY<SimNode>(height / 2).strength(0.02))
      .alphaDecay(alphaDecay)
      .velocityDecay(velocityDecay)
      .on('tick', () => {
        if (onTick && nodesRef.current.length > 0) {
          onTick([...nodesRef.current]);
        }
      });

    return simulationRef.current;
  }, [width, height, linkStrength, linkDistance, chargeStrength, collisionRadius, alphaDecay, velocityDecay, onTick]);

  // Update simulation with new nodes and edges
  const updateSimulation = useCallback((
    graphNodes: GraphNode[],
    graphEdges: GraphEdge[]
  ) => {
    if (!simulationRef.current) {
      initSimulation();
    }

    const simulation = simulationRef.current!;

    // Convert GraphNodes to SimNodes, preserving existing positions
    const existingNodeMap = new Map(nodesRef.current.map(n => [n.id, n]));

    const newNodes: SimNode[] = graphNodes.map((node) => {
      const existing = existingNodeMap.get(node.id);

      if (existing) {
        // Preserve existing position (simulation will maintain it)
        return {
          ...existing,
          userPositioned: node.userPositioned
        };
      }

      // New node - use position if provided, or calculate initial position
      const initialX = node.position?.x ?? (width / 2 + (Math.random() - 0.5) * 200);
      const initialY = node.position?.y ?? (height / 2 + (Math.random() - 0.5) * 200);

      const simNode: SimNode = {
        id: node.id,
        x: initialX,
        y: initialY,
        userPositioned: node.userPositioned
      };

      // If user positioned, fix the node in place
      if (node.userPositioned) {
        simNode.fx = initialX;
        simNode.fy = initialY;
      }

      return simNode;
    });

    // Convert edges to links
    const nodeIdSet = new Set(graphNodes.map(n => n.id));
    const newLinks: SimLink[] = graphEdges
      .filter(edge => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))
      .map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target
      }));

    nodesRef.current = newNodes;
    linksRef.current = newLinks;

    // Update simulation
    simulation.nodes(newNodes);

    const linkForce = simulation.force<ReturnType<typeof forceLink<SimNode, SimLink>>>('link');
    if (linkForce) {
      linkForce.links(newLinks);
    }

    // Reheat simulation for new nodes
    simulation.alpha(0.3).restart();
  }, [width, height, initSimulation]);

  // Fix a node in place (user dragged it)
  const fixNode = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
      node.x = x;
      node.y = y;
      node.userPositioned = true;

      // Small reheat to let other nodes adjust
      simulationRef.current?.alpha(0.1).restart();
    }
  }, []);

  // Release a node (allow simulation to move it)
  const releaseNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node && !node.userPositioned) {
      node.fx = null;
      node.fy = null;
      simulationRef.current?.alpha(0.1).restart();
    }
  }, []);

  // Drag start - fix node at current position
  const onDragStart = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
      simulationRef.current?.alphaTarget(0.1).restart();
    }
  }, []);

  // Drag move - update fixed position
  const onDrag = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }, []);

  // Drag end - decide whether to keep fixed or release
  const onDragEnd = useCallback((nodeId: string, wasLongDrag: boolean) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      if (wasLongDrag) {
        // User intentionally placed the node - keep it fixed
        node.userPositioned = true;
      } else {
        // Quick drag - release the node
        node.fx = null;
        node.fy = null;
      }
      simulationRef.current?.alphaTarget(0).restart();
    }
  }, []);

  // Stop simulation
  const stop = useCallback(() => {
    simulationRef.current?.stop();
  }, []);

  // Restart simulation
  const restart = useCallback((alpha = 0.3) => {
    simulationRef.current?.alpha(alpha).restart();
  }, []);

  // Get current node positions
  const getPositions = useCallback((): Map<string, { x: number; y: number }> => {
    const positions = new Map<string, { x: number; y: number }>();
    nodesRef.current.forEach(node => {
      positions.set(node.id, { x: node.x, y: node.y });
    });
    return positions;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
    };
  }, []);

  return {
    updateSimulation,
    fixNode,
    releaseNode,
    onDragStart,
    onDrag,
    onDragEnd,
    stop,
    restart,
    getPositions,
    simulation: simulationRef.current
  };
}
