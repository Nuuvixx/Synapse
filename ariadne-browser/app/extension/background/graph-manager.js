/**
 * Graph Manager
 * 
 * Manages the browsing graph data structure:
 * - Nodes represent web pages (tabs)
 * - Edges represent navigation relationships
 * - Provides CRUD operations for nodes and edges
 * - Handles persistence via chrome.storage
 */

export class GraphManager {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.sessions = new Map();
    this.savedTrees = new Map();
    this.currentSessionId = null;
  }

  // Initialize and load existing data
  async loadSessions() {
    const result = await chrome.storage.local.get([
      'ariadne_nodes',
      'ariadne_edges',
      'ariadne_sessions',
      'ariadne_saved_trees',
      'ariadne_current_session'
    ]);

    this.nodes = new Map(result.ariadne_nodes || []);
    this.edges = new Map(result.ariadne_edges || []);
    this.sessions = new Map(result.ariadne_sessions || []);
    this.savedTrees = new Map(result.ariadne_saved_trees || []);
    this.currentSessionId = result.ariadne_current_session || null;

    console.log('[GraphManager] Loaded', this.nodes.size, 'nodes,', this.edges.size, 'edges');
  }

  // Persist data to storage
  async saveToStorage() {
    await chrome.storage.local.set({
      'ariadne_nodes': Array.from(this.nodes.entries()),
      'ariadne_edges': Array.from(this.edges.entries()),
      'ariadne_sessions': Array.from(this.sessions.entries()),
      'ariadne_saved_trees': Array.from(this.savedTrees.entries()),
      'ariadne_current_session': this.currentSessionId
    });
  }

  // Node operations
  async addNode(nodeData) {
    this.nodes.set(nodeData.id, {
      ...nodeData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    await this.saveToStorage();
    return nodeData;
  }

  async updateNode(nodeId, updates) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      console.warn('[GraphManager] Node not found:', nodeId);
      return null;
    }

    const updatedNode = {
      ...node,
      ...updates,
      updatedAt: Date.now()
    };

    this.nodes.set(nodeId, updatedNode);
    await this.saveToStorage();
    return updatedNode;
  }

  async updateNodePosition(nodeId, position) {
    return this.updateNode(nodeId, { 
      position,
      userPositioned: true 
    });
  }

  async deleteNode(nodeId) {
    // Remove node
    this.nodes.delete(nodeId);
    
    // Remove associated edges
    for (const [edgeId, edge] of this.edges.entries()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        this.edges.delete(edgeId);
      }
    }
    
    await this.saveToStorage();
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  // Edge operations
  async addEdge(edgeData) {
    this.edges.set(edgeData.id, {
      ...edgeData,
      createdAt: Date.now()
    });
    await this.saveToStorage();
    return edgeData;
  }

  async deleteEdge(edgeId) {
    this.edges.delete(edgeId);
    await this.saveToStorage();
  }

  // Get graph data for a session
  async getGraphData(sessionId = null) {
    const targetSessionId = sessionId || this.currentSessionId;
    
    if (!targetSessionId) {
      return { nodes: [], edges: [] };
    }

    const sessionNodes = [];
    const sessionNodeIds = new Set();

    for (const [id, node] of this.nodes.entries()) {
      if (node.sessionId === targetSessionId) {
        sessionNodes.push(node);
        sessionNodeIds.add(id);
      }
    }

    const sessionEdges = [];
    for (const [id, edge] of this.edges.entries()) {
      if (sessionNodeIds.has(edge.source) && sessionNodeIds.has(edge.target)) {
        sessionEdges.push(edge);
      }
    }

    return {
      nodes: sessionNodes,
      edges: sessionEdges,
      sessionId: targetSessionId
    };
  }

  // Get full graph (all sessions)
  async getFullGraph() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      sessions: Array.from(this.sessions.values())
    };
  }

  // Timeline data for replay
  async getTimeline(sessionId = null) {
    const targetSessionId = sessionId || this.currentSessionId;
    const graphData = await this.getGraphData(targetSessionId);
    
    // Sort nodes by creation time
    const sortedNodes = [...graphData.nodes].sort((a, b) => a.timestamp - b.timestamp);
    
    // Create timeline events
    const events = [];
    
    for (const node of sortedNodes) {
      events.push({
        type: 'node_created',
        timestamp: node.timestamp,
        data: node
      });
      
      if (node.closedAt) {
        events.push({
          type: 'node_closed',
          timestamp: node.closedAt,
          data: node
        });
      }
    }
    
    for (const edge of graphData.edges) {
      events.push({
        type: 'edge_created',
        timestamp: edge.timestamp,
        data: edge
      });
    }
    
    // Sort all events by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);
    
    return {
      sessionId: targetSessionId,
      events,
      startTime: events.length > 0 ? events[0].timestamp : Date.now(),
      endTime: events.length > 0 ? events[events.length - 1].timestamp : Date.now()
    };
  }

  // Save a tree (collection of related nodes)
  async saveTree(name, nodeIds) {
    const treeId = `tree-${Date.now()}`;
    const treeNodes = [];
    const treeEdges = [];
    
    for (const nodeId of nodeIds) {
      const node = this.nodes.get(nodeId);
      if (node) {
        treeNodes.push(node);
      }
    }
    
    // Find edges between these nodes
    for (const [edgeId, edge] of this.edges.entries()) {
      if (nodeIds.includes(edge.source) && nodeIds.includes(edge.target)) {
        treeEdges.push(edge);
      }
    }
    
    const tree = {
      id: treeId,
      name,
      nodes: treeNodes,
      edges: treeEdges,
      createdAt: Date.now(),
      nodeCount: treeNodes.length
    };
    
    this.savedTrees.set(treeId, tree);
    await this.saveToStorage();
    
    return tree;
  }

  async loadTree(treeId) {
    return this.savedTrees.get(treeId);
  }

  async getSavedTrees() {
    return Array.from(this.savedTrees.values());
  }

  async deleteTree(treeId) {
    this.savedTrees.delete(treeId);
    await this.saveToStorage();
  }

  // Import graph data
  async importGraph(graphData, newSessionId) {
    const idMapping = new Map();
    
    // Import nodes with new IDs
    for (const node of graphData.nodes) {
      const newId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMapping.set(node.id, newId);
      
      this.nodes.set(newId, {
        ...node,
        id: newId,
        sessionId: newSessionId,
        tabId: null, // Reset tab ID as it's a new session
        status: 'imported',
        importedAt: Date.now()
      });
    }
    
    // Import edges with mapped IDs
    for (const edge of graphData.edges) {
      const newSourceId = idMapping.get(edge.source);
      const newTargetId = idMapping.get(edge.target);
      
      if (newSourceId && newTargetId) {
        const newEdgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.edges.set(newEdgeId, {
          ...edge,
          id: newEdgeId,
          source: newSourceId,
          target: newTargetId,
          sessionId: newSessionId,
          importedAt: Date.now()
        });
      }
    }
    
    await this.saveToStorage();
  }

  // Cleanup old closed nodes
  async cleanupOldNodes(cutoffTime) {
    let removedCount = 0;
    
    for (const [id, node] of this.nodes.entries()) {
      if (node.status === 'closed' && node.closedAt && node.closedAt < cutoffTime) {
        // Remove the node and its edges
        this.nodes.delete(id);
        
        for (const [edgeId, edge] of this.edges.entries()) {
          if (edge.source === id || edge.target === id) {
            this.edges.delete(edgeId);
          }
        }
        
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log('[GraphManager] Cleaned up', removedCount, 'old nodes');
      await this.saveToStorage();
    }
    
    return removedCount;
  }

  // Clear all data
  async clearAll() {
    this.nodes.clear();
    this.edges.clear();
    this.sessions.clear();
    this.savedTrees.clear();
    this.currentSessionId = null;
    await this.saveToStorage();
  }

  // Get statistics
  async getStats() {
    const activeNodes = Array.from(this.nodes.values()).filter(n => n.status === 'active').length;
    const closedNodes = Array.from(this.nodes.values()).filter(n => n.status === 'closed').length;
    
    return {
      totalNodes: this.nodes.size,
      activeNodes,
      closedNodes,
      totalEdges: this.edges.size,
      totalSessions: this.sessions.size,
      savedTrees: this.savedTrees.size
    };
  }
}
