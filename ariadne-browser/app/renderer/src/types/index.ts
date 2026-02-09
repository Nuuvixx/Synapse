/**
 * Ariadne Type Definitions
 */

// Graph Node representing a web page/tab
export interface GraphNode {
  [key: string]: unknown;
  id: string;
  tabId: number | null;
  url: string;
  title: string;
  favicon: string | null;
  screenshot: string | null;
  windowId: number | null;
  sessionId: string;
  parentId: string | null;
  timestamp: number;
  status: 'active' | 'closed' | 'imported';
  position?: { x: number; y: number };
  userPositioned?: boolean;
  metadata?: {
    index: number;
    pinned: boolean;
    incognito: boolean;
  };
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
  reopenedAt?: number;
  lastActive?: number;
}

// Graph Edge representing navigation relationship
export interface GraphEdge {
  [key: string]: unknown;
  id: string;
  source: string;
  target: string;
  type: 'navigation' | 'reference' | 'manual';
  timestamp: number;
  sessionId: string;
  createdAt: number;
}

// Browsing Session
export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  edgeCount: number;
  isActive: boolean;
  isImported?: boolean;
}

// Saved Tree (collection of related nodes)
export interface SavedTree {
  id: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: number;
  nodeCount: number;
}

// Timeline Event for replay
export interface TimelineEvent {
  type: 'node_created' | 'node_closed' | 'edge_created';
  timestamp: number;
  data: GraphNode | GraphEdge;
}

// Timeline Data
export interface TimelineData {
  sessionId: string;
  events: TimelineEvent[];
  startTime: number;
  endTime: number;
}

// Graph Data Response
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  sessionId: string;
}

// Node View State
export interface NodeViewState {
  zoom: number;
  showThumbnails: boolean;
  showLabels: boolean;
  dimClosed: boolean;
}

// Cluster Data for semantic grouping
export interface Cluster {
  id: string;
  label: string;
  nodeIds: string[];
  center: { x: number; y: number };
  color: string;
}

// Viewport State
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// Graph Statistics
export interface GraphStats {
  totalNodes: number;
  activeNodes: number;
  closedNodes: number;
  totalEdges: number;
  totalSessions: number;
  savedTrees: number;
}
