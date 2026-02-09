/**
 * useTabManager Hook
 * 
 * React hook for interacting with the TabManager in the main process.
 * Provides state management and methods for tab operations.
 */

import { useState, useEffect, useCallback } from 'react';
import type { TabInfo } from '@/types';

interface TabManagerState {
    tabs: TabInfo[];
    activeTab: TabInfo | null;
    isLoading: boolean;
    error: string | null;
}

export function useTabManager() {
    const [state, setState] = useState<TabManagerState>({
        tabs: [],
        activeTab: null,
        isLoading: false,
        error: null
    });

    // Initialize and set up listeners
    useEffect(() => {
        // Only run in Electron environment
        if (typeof window === 'undefined' || !window.api?.tab) {
            console.warn('Tab API not available - running outside Electron?');
            return;
        }

        // Load initial tabs
        const loadTabs = async () => {
            try {
                const [tabs, activeTab] = await Promise.all([
                    window.api.tab.getAllTabs(),
                    window.api.tab.getActiveTab()
                ]);
                setState(prev => ({
                    ...prev,
                    tabs,
                    activeTab
                }));
            } catch (err) {
                console.error('Failed to load tabs:', err);
            }
        };

        loadTabs();

        // Listen for tab updates
        const unsubUpdate = window.api.tab.onTabUpdated((updatedTab) => {
            setState(prev => {
                // Update in tabs array
                const tabs = prev.tabs.map(t =>
                    t.id === updatedTab.id ? updatedTab : t
                );

                // If not in array, add it (fallback)
                if (!tabs.find(t => t.id === updatedTab.id)) {
                    tabs.push(updatedTab);
                }

                // Handle active tab state
                let activeTab = prev.activeTab;

                // If this tab became active, set it as active
                if (updatedTab.isActive) {
                    activeTab = updatedTab;
                }
                // If this tab became inactive and was the active one, check if we need to clear it
                // (though usually another tab will become active immediately)
                else if (prev.activeTab?.id === updatedTab.id && !updatedTab.isActive) {
                    // Don't clear immediately, wait for new active tab
                }
                // If just an update to the active tab (title/url)
                else if (prev.activeTab?.id === updatedTab.id) {
                    activeTab = updatedTab;
                }

                return { ...prev, tabs, activeTab };
            });
        });

        // Listen for tab creation
        const unsubCreate = window.api.tab.onTabCreated((newTab) => {
            setState(prev => ({
                ...prev,
                tabs: [...prev.tabs, newTab],
                // If new tab is active (default), set it
                activeTab: newTab.isActive ? newTab : prev.activeTab
            }));
        });

        // Listen for tab removal
        const unsubRemove = window.api.tab.onTabRemoved((tabId) => {
            setState(prev => {
                const tabs = prev.tabs.filter(t => t.id !== tabId);
                // If active tab was removed, clear it (a switch event should follow if another tab exists)
                const activeTab = prev.activeTab?.id === tabId ? null : prev.activeTab;
                return { ...prev, tabs, activeTab };
            });
        });

        return () => {
            unsubUpdate?.();
            unsubCreate?.();
            unsubRemove?.();
        };
    }, []);

    // Create a new tab
    const createTab = useCallback(async (url: string, nodeId?: string): Promise<TabInfo | null> => {
        if (!window.api?.tab) return null;

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const newTab = await window.api.tab.createTab(url, nodeId);
            // State update will happen via onTabCreated event
            setState(prev => ({ ...prev, isLoading: false }));
            return newTab;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create tab';
            setState(prev => ({ ...prev, isLoading: false, error: message }));
            return null;
        }
    }, []);

    // Switch to a tab
    const switchTab = useCallback(async (tabId: string): Promise<boolean> => {
        if (!window.api?.tab) return false;

        try {
            const tab = await window.api.tab.switchTab(tabId);
            // State update via onTabUpdated event
            return !!tab;
        } catch (err) {
            console.error('Failed to switch tab:', err);
            return false;
        }
    }, []);

    // Close a tab
    const closeTab = useCallback(async (tabId: string): Promise<boolean> => {
        if (!window.api?.tab) return false;

        try {
            const success = await window.api.tab.closeTab(tabId);
            // State update via onTabRemoved event
            return success;
        } catch (err) {
            console.error('Failed to close tab:', err);
            return false;
        }
    }, []);

    // Navigate the active tab
    const navigate = useCallback(async (url: string): Promise<boolean> => {
        if (!window.api?.tab || !state.activeTab) return false;

        try {
            return await window.api.tab.navigateTab(state.activeTab.id, url);
        } catch (err) {
            console.error('Failed to navigate:', err);
            return false;
        }
    }, [state.activeTab]);

    // Navigation controls
    const goBack = useCallback(async (): Promise<boolean> => {
        if (!window.api?.tab || !state.activeTab) return false;
        return window.api.tab.goBack(state.activeTab.id);
    }, [state.activeTab]);

    const goForward = useCallback(async (): Promise<boolean> => {
        if (!window.api?.tab || !state.activeTab) return false;
        return window.api.tab.goForward(state.activeTab.id);
    }, [state.activeTab]);

    const reload = useCallback(async (): Promise<boolean> => {
        if (!window.api?.tab || !state.activeTab) return false;
        return window.api.tab.reload(state.activeTab.id);
    }, [state.activeTab]);

    return {
        // State
        tabs: state.tabs,
        activeTab: state.activeTab,
        isLoading: state.isLoading,
        error: state.error,

        // Actions
        createTab,
        switchTab,
        closeTab,
        navigate,
        goBack,
        goForward,
        reload
    };
}
