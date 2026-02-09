/**
 * useTabNodeSync Hook
 * 
 * Synchronizes browser tabs with graph nodes.
 * - Creates nodes when tabs are created
 * - Updates nodes when tab info changes (title, favicon, URL)
 * - Switches to tab when node is double-clicked
 * - Marks nodes as closed when tabs are closed
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGraphStore } from '@/store/graphStore';
import type { TabInfo, GraphNode } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface UseTabNodeSyncOptions {
    /** Enable automatic node creation for tabs */
    autoCreateNodes?: boolean;
    /** Session ID for new nodes */
    sessionId?: string;
}

interface TabNodeSyncReturn {
    /** Create a tab and corresponding node */
    createTabWithNode: (url: string, parentNodeId?: string | null) => Promise<TabInfo | null>;
    /** Switch to tab associated with a node */
    switchToNodeTab: (nodeId: string) => Promise<boolean>;
    /** Get node ID for a tab */
    getNodeForTab: (tabId: string) => GraphNode | null;
    /** Get tab ID for a node */
    getTabForNode: (nodeId: string) => string | null;
    /** Close tab and update node */
    closeTabAndNode: (tabId: string) => Promise<boolean>;
}

// Map to track tab-node associations
const tabNodeMap = new Map<string, string>(); // tabId -> nodeId
const nodeTabMap = new Map<string, string>(); // nodeId -> tabId

export function useTabNodeSync(options: UseTabNodeSyncOptions = {}): TabNodeSyncReturn {
    const {
        autoCreateNodes = true,
        sessionId = 'browser-session'
    } = options;

    const { nodes } = useGraphStore();
    const nodesRef = useRef(nodes);

    // Keep nodes ref updated
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // Listen for tab updates from main process
    useEffect(() => {
        if (typeof window === 'undefined' || !window.api?.tab) {
            return;
        }

        const unsubscribe = window.api.tab.onTabUpdated((tabInfo: TabInfo) => {
            const nodeId = tabNodeMap.get(tabInfo.id);

            if (nodeId) {
                // Update existing node
                const { nodes } = useGraphStore.getState();
                const existingNode = nodes.find(n => n.id === nodeId);

                if (existingNode) {
                    // Update node with new tab info
                    useGraphStore.setState({
                        nodes: nodes.map(n =>
                            n.id === nodeId
                                ? {
                                    ...n,
                                    url: tabInfo.url,
                                    title: tabInfo.title,
                                    favicon: tabInfo.favicon,
                                    status: tabInfo.isActive ? 'active' as const : n.status,
                                    updatedAt: Date.now(),
                                    lastActive: tabInfo.isActive ? Date.now() : n.lastActive
                                }
                                : n
                        )
                    });
                }
            } else if (autoCreateNodes && tabInfo.nodeId) {
                // Tab was created with a nodeId but we don't have the mapping
                tabNodeMap.set(tabInfo.id, tabInfo.nodeId);
                nodeTabMap.set(tabInfo.nodeId, tabInfo.id);
            }
        });

        return () => {
            unsubscribe?.();
        };
    }, [autoCreateNodes]);

    /**
     * Create a new tab and corresponding graph node
     */
    const createTabWithNode = useCallback(async (
        url: string,
        parentNodeId?: string | null
    ): Promise<TabInfo | null> => {
        if (!window.api?.tab) return null;

        try {
            // Generate node ID first
            const nodeId = uuidv4();

            // Create tab with node association
            const tabInfo = await window.api.tab.createTab(url, nodeId);

            // Create graph node
            const now = Date.now();
            const parentNode = parentNodeId
                ? nodesRef.current.find(n => n.id === parentNodeId)
                : null;

            const newNode: GraphNode = {
                id: nodeId,
                tabId: null, // Will use string tabId via map
                url: tabInfo.url,
                title: tabInfo.title || 'New Tab',
                favicon: tabInfo.favicon,
                screenshot: null,
                windowId: null,
                sessionId,
                parentId: parentNodeId || null,
                timestamp: now,
                status: 'active',
                position: parentNode ? {
                    x: parentNode.position?.x ?? 0 + 200,
                    y: parentNode.position?.y ?? 0 + 50
                } : undefined,
                userPositioned: false,
                metadata: {
                    index: 0,
                    pinned: false,
                    incognito: false
                },
                createdAt: now,
                updatedAt: now,
                lastActive: now
            };

            // Add node to store
            const { nodes, edges } = useGraphStore.getState();
            useGraphStore.setState({
                nodes: [...nodes, newNode],
                // Add edge if there's a parent
                edges: parentNodeId ? [
                    ...edges,
                    {
                        id: `edge-${parentNodeId}-${nodeId}`,
                        source: parentNodeId,
                        target: nodeId,
                        type: 'navigation' as const,
                        timestamp: now,
                        sessionId,
                        createdAt: now
                    }
                ] : edges
            });

            // Track association
            tabNodeMap.set(tabInfo.id, nodeId);
            nodeTabMap.set(nodeId, tabInfo.id);

            return tabInfo;
        } catch (err) {
            console.error('Failed to create tab with node:', err);
            return null;
        }
    }, [sessionId]);

    /**
     * Switch to the tab associated with a node
     */
    const switchToNodeTab = useCallback(async (nodeId: string): Promise<boolean> => {
        if (!window.api?.tab) return false;

        const tabId = nodeTabMap.get(nodeId);
        if (!tabId) {
            console.warn('No tab associated with node:', nodeId);
            return false;
        }

        try {
            const result = await window.api.tab.switchTab(tabId);
            return result !== null;
        } catch (err) {
            console.error('Failed to switch to node tab:', err);
            return false;
        }
    }, []);

    /**
     * Get the graph node for a tab ID
     */
    const getNodeForTab = useCallback((tabId: string): GraphNode | null => {
        const nodeId = tabNodeMap.get(tabId);
        if (!nodeId) return null;
        return nodesRef.current.find(n => n.id === nodeId) || null;
    }, []);

    /**
     * Get the tab ID for a node
     */
    const getTabForNode = useCallback((nodeId: string): string | null => {
        return nodeTabMap.get(nodeId) || null;
    }, []);

    /**
     * Close a tab and mark its node as closed
     */
    const closeTabAndNode = useCallback(async (tabId: string): Promise<boolean> => {
        if (!window.api?.tab) return false;

        try {
            const success = await window.api.tab.closeTab(tabId);

            if (success) {
                const nodeId = tabNodeMap.get(tabId);

                if (nodeId) {
                    const { nodes } = useGraphStore.getState();
                    const now = Date.now();

                    // Mark node as closed
                    useGraphStore.setState({
                        nodes: nodes.map(n =>
                            n.id === nodeId
                                ? { ...n, status: 'closed' as const, closedAt: now, updatedAt: now }
                                : n
                        )
                    });

                    // Clean up mappings
                    tabNodeMap.delete(tabId);
                    nodeTabMap.delete(nodeId);
                }
            }

            return success;
        } catch (err) {
            console.error('Failed to close tab:', err);
            return false;
        }
    }, []);

    return {
        createTabWithNode,
        switchToNodeTab,
        getNodeForTab,
        getTabForNode,
        closeTabAndNode
    };
}

/**
 * Utility to check if a node has an associated tab
 */
export function hasAssociatedTab(nodeId: string): boolean {
    return nodeTabMap.has(nodeId);
}

/**
 * Get all current tab-node associations
 */
export function getTabNodeAssociations(): Map<string, string> {
    return new Map(tabNodeMap);
}
