/**
 * Graph Store
 * 
 * Zustand store for managing graph state in the React Flow canvas.
 * Handles communication with the extension background script.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  GraphNode,
  GraphEdge,
  Session,
  SavedTree,
  TimelineData,
  GraphStats,
  ViewportState
} from '@/types';
import {
  demoNodes,
  demoEdges,
  demoSessions,
  demoTimeline,
  demoSavedTrees,
  isExtensionMode
} from './demoData';

interface GraphState {
  // Data
  nodes: GraphNode[];
  edges: GraphEdge[];
  sessions: Session[];
  savedTrees: SavedTree[];
  currentSessionId: string | null;

  // UI State
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  viewport: ViewportState;
  isLoading: boolean;
  error: string | null;

  // View Settings
  dimClosedNodes: boolean;
  showThumbnails: boolean;
  showFavicons: boolean;
  clusterByDomain: boolean;

  // Timeline
  timeline: TimelineData | null;
  timelineProgress: number;
  isPlayingTimeline: boolean;

  // Actions
  loadGraphData: () => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSavedTrees: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createSession: (name: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  // Node Actions
  selectNode: (nodeId: string | null) => void;
  selectMultipleNodes: (nodeIds: string[]) => void;
  hoverNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string) => Promise<void>;
  reopenNode: (nodeId: string) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => Promise<void>;

  // Tree Actions
  saveTree: (name: string, nodeIds: string[]) => Promise<void>;
  loadTree: (treeId: string) => Promise<void>;
  deleteTree: (treeId: string) => Promise<void>;

  // Timeline Actions
  loadTimeline: () => Promise<void>;
  setTimelineProgress: (progress: number) => void;
  playTimeline: () => void;
  pauseTimeline: () => void;

  // View Actions
  setViewport: (viewport: ViewportState) => void;
  fitView: () => void;
  resetView: () => void;

  // Settings
  setDimClosedNodes: (value: boolean) => void;
  setShowThumbnails: (value: boolean) => void;
  setShowFavicons: (value: boolean) => void;
  setClusterByDomain: (value: boolean) => void;

  // Export/Import
  exportSession: () => Promise<void>;
  importSession: (data: unknown) => Promise<void>;
  clearAllData: () => Promise<void>;

  // Stats
  getStats: () => GraphStats;
}

// Send message to extension background script
const sendMessage = async (message: unknown): Promise<any> => {
  if (!isExtensionMode()) {
    console.warn('[GraphStore] Chrome extension API not available');
    return null;
  }

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('[GraphStore] Message failed:', error);
    throw error;
  }
};

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      // Initial State - load demo data if not in extension mode
      nodes: isExtensionMode() ? [] : demoNodes,
      edges: isExtensionMode() ? [] : demoEdges,
      sessions: isExtensionMode() ? [] : demoSessions,
      savedTrees: [],
      currentSessionId: isExtensionMode() ? null : 'demo-session',

      selectedNodeIds: [],
      hoveredNodeId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      isLoading: false,
      error: null,

      dimClosedNodes: true,
      showThumbnails: true,
      showFavicons: true,
      clusterByDomain: false,

      timeline: isExtensionMode() ? null : demoTimeline,
      timelineProgress: 0,
      isPlayingTimeline: false,

      // Load graph data from background
      loadGraphData: async () => {
        // If not in extension mode, use demo data
        if (!isExtensionMode()) {
          set({
            nodes: demoNodes,
            edges: demoEdges,
            currentSessionId: 'demo-session',
            isLoading: false
          });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const data = await sendMessage({ action: 'getGraphData' });
          if (data) {
            set({
              nodes: data.nodes || [],
              edges: data.edges || [],
              currentSessionId: data.sessionId || null,
              isLoading: false
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          set({ error: 'Failed to load graph data', isLoading: false });
        }
      },

      // Load all sessions
      loadSessions: async () => {
        if (!isExtensionMode()) {
          set({ sessions: demoSessions });
          return;
        }

        try {
          const sessions = await sendMessage({ action: 'getSessions' });
          if (sessions) {
            set({ sessions });
          }
        } catch (error) {
          console.error('Failed to load sessions:', error);
        }
      },

      // Load saved trees
      loadSavedTrees: async () => {
        if (!isExtensionMode()) {
          set({ savedTrees: demoSavedTrees });
          return;
        }

        try {
          const trees = await sendMessage({ action: 'getSavedTrees' });
          if (trees) {
            set({ savedTrees: trees });
          }
        } catch (error) {
          console.error('Failed to load saved trees:', error);
        }
      },

      // Switch to a different session
      switchSession: async (sessionId: string) => {
        if (!isExtensionMode()) {
          // In demo mode, just switch the current session ID
          set({ currentSessionId: sessionId });
          return;
        }

        set({ isLoading: true });
        try {
          await sendMessage({ action: 'switchSession', sessionId });
          await get().loadGraphData();
          await get().loadSessions();
        } catch (error) {
          set({ error: 'Failed to switch session', isLoading: false });
        }
      },

      // Create new session
      createSession: async (name: string) => {
        if (!isExtensionMode()) {
          const newSession: Session = {
            id: `session-${Date.now()}`,
            name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            nodeCount: 0,
            edgeCount: 0,
            isActive: true,
          };
          set(state => ({
            sessions: [...state.sessions, newSession],
            currentSessionId: newSession.id,
            nodes: [],
            edges: []
          }));
          return;
        }

        try {
          await sendMessage({ action: 'createSession', name });
          await get().loadSessions();
          await get().loadGraphData();
        } catch (error) {
          console.error('Failed to create session:', error);
        }
      },

      // Delete session
      deleteSession: async (sessionId: string) => {
        if (!isExtensionMode()) {
          set(state => ({
            sessions: state.sessions.filter(s => s.id !== sessionId),
            currentSessionId: state.currentSessionId === sessionId
              ? (state.sessions.find(s => s.id !== sessionId)?.id || null)
              : state.currentSessionId
          }));
          return;
        }

        try {
          await sendMessage({ action: 'deleteSession', sessionId });
          await get().loadSessions();
          await get().loadGraphData();
        } catch (error) {
          console.error('Failed to delete session:', error);
        }
      },

      // Select a single node
      selectNode: (nodeId: string | null) => {
        set({ selectedNodeIds: nodeId ? [nodeId] : [] });
      },

      // Select multiple nodes
      selectMultipleNodes: (nodeIds: string[]) => {
        set({ selectedNodeIds: nodeIds });
      },

      // Hover node
      hoverNode: (nodeId: string | null) => {
        set({ hoveredNodeId: nodeId });
      },

      // Focus an existing tab
      focusNode: async (nodeId: string) => {
        if (!isExtensionMode()) {
          const node = get().nodes.find(n => n.id === nodeId);
          if (node) {
            window.open(node.url, '_blank');
          }
          return;
        }

        try {
          await sendMessage({ action: 'focusNode', nodeId });
        } catch (error) {
          console.error('Failed to focus node:', error);
        }
      },

      // Reopen a closed node
      reopenNode: async (nodeId: string) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (!node) return;

        if (!isExtensionMode()) {
          window.open(node.url, '_blank');
          // Update status locally
          set(state => ({
            nodes: state.nodes.map(n =>
              n.id === nodeId ? { ...n, status: 'active' as const } : n
            )
          }));
          return;
        }

        try {
          await sendMessage({ action: 'reopenNode', nodeId });
          await get().loadGraphData();
        } catch (error) {
          console.error('Failed to reopen node:', error);
        }
      },

      // Delete a node
      deleteNode: async (nodeId: string) => {
        if (!isExtensionMode()) {
          set(state => ({
            nodes: state.nodes.filter(n => n.id !== nodeId),
            edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
          }));
          return;
        }

        try {
          await sendMessage({ action: 'deleteNode', nodeId });
          await get().loadGraphData();
        } catch (error) {
          console.error('Failed to delete node:', error);
        }
      },

      // Update node position
      updateNodePosition: async (nodeId: string, position: { x: number; y: number }) => {
        // Always update locally
        set(state => ({
          nodes: state.nodes.map(n =>
            n.id === nodeId ? { ...n, position, userPositioned: true } : n
          )
        }));

        if (!isExtensionMode()) return;

        try {
          await sendMessage({ action: 'updateNodePosition', nodeId, position });
        } catch (error) {
          console.error('Failed to update node position:', error);
        }
      },

      // Save a tree
      saveTree: async (name: string, nodeIds: string[]) => {
        if (!isExtensionMode()) {
          const newTree: SavedTree = {
            id: `tree-${Date.now()}`,
            name,
            nodes: get().nodes.filter(n => nodeIds.includes(n.id)),
            edges: get().edges.filter(e =>
              nodeIds.includes(e.source) && nodeIds.includes(e.target)
            ),
            createdAt: Date.now(),
            nodeCount: nodeIds.length
          };
          set(state => ({
            savedTrees: [...state.savedTrees, newTree]
          }));
          return;
        }

        try {
          await sendMessage({ action: 'saveTree', name, nodeIds });
          await get().loadSavedTrees();
        } catch (error) {
          console.error('Failed to save tree:', error);
        }
      },

      // Load a saved tree
      loadTree: async (treeId: string) => {
        if (!isExtensionMode()) {
          const tree = get().savedTrees.find(t => t.id === treeId);
          if (tree) {
            set({
              nodes: tree.nodes,
              edges: tree.edges
            });
          }
          return;
        }

        try {
          const tree = await sendMessage({ action: 'loadTree', treeId });
          if (tree) {
            set({
              nodes: tree.nodes,
              edges: tree.edges
            });
          }
        } catch (error) {
          console.error('Failed to load tree:', error);
        }
      },

      // Delete a saved tree
      deleteTree: async (treeId: string) => {
        if (!isExtensionMode()) {
          set(state => ({
            savedTrees: state.savedTrees.filter(t => t.id !== treeId)
          }));
          return;
        }

        try {
          await sendMessage({ action: 'deleteTree', treeId });
          await get().loadSavedTrees();
        } catch (error) {
          console.error('Failed to delete tree:', error);
        }
      },

      // Load timeline data
      loadTimeline: async () => {
        if (!isExtensionMode()) {
          set({ timeline: demoTimeline });
          return;
        }

        try {
          const timeline = await sendMessage({ action: 'getTimeline' });
          if (timeline) {
            set({ timeline });
          }
        } catch (error) {
          console.error('Failed to load timeline:', error);
        }
      },

      // Set timeline progress
      setTimelineProgress: (progress: number) => {
        set({ timelineProgress: progress });
      },

      // Play timeline
      playTimeline: () => {
        set({ isPlayingTimeline: true });
      },

      // Pause timeline
      pauseTimeline: () => {
        set({ isPlayingTimeline: false });
      },

      // Set viewport
      setViewport: (viewport: ViewportState) => {
        set({ viewport });
      },

      // Fit view to content
      fitView: () => {
        set(state => ({ viewport: { ...state.viewport } }));
      },

      // Reset view
      resetView: () => {
        set({ viewport: { x: 0, y: 0, zoom: 1 } });
      },

      // Settings
      setDimClosedNodes: (value: boolean) => set({ dimClosedNodes: value }),
      setShowThumbnails: (value: boolean) => set({ showThumbnails: value }),
      setShowFavicons: (value: boolean) => set({ showFavicons: value }),
      setClusterByDomain: (value: boolean) => set({ clusterByDomain: value }),

      // Export session
      exportSession: async () => {
        const data = {
          version: '1.0.0',
          exportDate: Date.now(),
          session: get().sessions.find(s => s.id === get().currentSessionId),
          graph: {
            nodes: get().nodes,
            edges: get().edges
          }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ariadne-session-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },

      // Import session
      importSession: async (data: unknown) => {
        try {
          const imported = data as { graph?: { nodes: GraphNode[]; edges: GraphEdge[] } };
          if (imported?.graph) {
            set({
              nodes: imported.graph.nodes,
              edges: imported.graph.edges
            });
          }
        } catch (error) {
          console.error('Failed to import session:', error);
        }
      },

      // Clear all data
      clearAllData: async () => {
        set({
          nodes: [],
          edges: [],
          sessions: [],
          savedTrees: [],
          currentSessionId: null
        });
      },

      // Get statistics
      getStats: () => {
        const state = get();
        const activeNodes = state.nodes.filter(n => n.status === 'active').length;
        const closedNodes = state.nodes.filter(n => n.status === 'closed').length;

        return {
          totalNodes: state.nodes.length,
          activeNodes,
          closedNodes,
          totalEdges: state.edges.length,
          totalSessions: state.sessions.length,
          savedTrees: state.savedTrees.length
        };
      }
    }),
    {
      name: 'ariadne-graph-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        dimClosedNodes: state.dimClosedNodes,
        showThumbnails: state.showThumbnails,
        showFavicons: state.showFavicons,
        clusterByDomain: state.clusterByDomain,
        viewport: state.viewport
      })
    }
  )
);
