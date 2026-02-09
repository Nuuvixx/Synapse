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
        const unsubscribe = window.api.tab.onTabUpdated((updatedTab) => {
            setState(prev => {
                // Update in tabs array
                const tabs = prev.tabs.map(t =>
                    t.id === updatedTab.id ? updatedTab : t
                );

                // If not in array, add it
                if (!tabs.find(t => t.id === updatedTab.id)) {
                    tabs.push(updatedTab);
                }

                // Update active tab if it's the one that changed
                const activeTab = prev.activeTab?.id === updatedTab.id
                    ? updatedTab
                    : prev.activeTab;

                return { ...prev, tabs, activeTab };
            });
        });

        return () => {
            unsubscribe?.();
        };
    }, []);

    // Create a new tab
    const createTab = useCallback(async (url: string, nodeId?: string): Promise<TabInfo | null> => {
        if (!window.api?.tab) return null;

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const newTab = await window.api.tab.createTab(url, nodeId);
            setState(prev => ({
                ...prev,
                tabs: [...prev.tabs, newTab],
                activeTab: newTab,
                isLoading: false
            }));
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
            if (tab) {
                setState(prev => ({ ...prev, activeTab: tab }));
                return true;
            }
            return false;
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
            if (success) {
                setState(prev => ({
                    ...prev,
                    tabs: prev.tabs.filter(t => t.id !== tabId),
                    activeTab: prev.activeTab?.id === tabId ? null : prev.activeTab
                }));
            }
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
