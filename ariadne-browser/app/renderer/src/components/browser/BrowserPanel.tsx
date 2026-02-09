/**
 * BrowserPanel Component
 * 
 * Combines AddressBar and BrowserViewport into a complete browser experience.
 * Features Chrome-like rounded tabs for a modern feel.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, X, Plus } from 'lucide-react';
import { AddressBar } from './AddressBar';
import { BrowserViewport } from './BrowserViewport';
import { useTabManager } from '@/hooks/useTabManager';
import { useTabNodeSync } from '@/hooks/useTabNodeSync';
import { cn } from '@/lib/utils';

interface BrowserPanelProps {
    isOpen: boolean;
    fullscreen?: boolean;
    onToggleGraph?: () => void;
    showGraph?: boolean;
}

export function BrowserPanel({
    isOpen,
    fullscreen = false,
    onToggleGraph,
    showGraph = false
}: BrowserPanelProps) {
    const {
        tabs,
        activeTab,
        isLoading,
        switchTab,
        navigate,
        goBack,
        goForward,
        reload
    } = useTabManager();

    // Use tab-node sync for creating tabs with graph nodes
    const { createTabWithNode, closeTabAndNode } = useTabNodeSync();

    // Navigation capabilities
    const canGoBack = true;
    const canGoForward = true;

    // Handle navigation
    const handleNavigate = async (url: string) => {
        if (activeTab) {
            await navigate(url);
        } else {
            await createTabWithNode(url);
        }
    };

    // Handle new tab creation
    const handleCreateTab = async (url: string) => {
        await createTabWithNode(url);
    };

    // Handle tab close
    const handleCloseTab = async (tabId: string) => {
        await closeTabAndNode(tabId);
    };

    const panelWidth = fullscreen ? '100%' : '50%';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: panelWidth, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={cn(
                        "h-full flex flex-col bg-slate-900 overflow-hidden",
                        !fullscreen && "border-l border-slate-800"
                    )}
                >
                    {/* Tab Bar - Chrome-like styling */}
                    <div className="h-10 flex items-center gap-1 px-2 bg-slate-850 border-b border-slate-800">
                        {/* Graph View Toggle Button */}
                        {onToggleGraph && (
                            <button
                                onClick={onToggleGraph}
                                className={cn(
                                    "p-2 mr-1 rounded-lg transition-all duration-200",
                                    "hover:bg-slate-700/70",
                                    showGraph
                                        ? "text-emerald-400 bg-emerald-500/10"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                                title={showGraph ? "Hide Graph View (Alt+V)" : "Show Graph View (Alt+V)"}
                            >
                                <LayoutGrid size={18} />
                            </button>
                        )}

                        {/* Tab List - Chrome-like rounded tabs */}
                        <div className="flex items-end gap-0.5 flex-1 overflow-x-auto min-h-[36px]">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => switchTab(tab.id)}
                                    className={cn(
                                        "group flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] transition-all duration-200",
                                        "rounded-t-lg", // Chrome-like rounded top corners
                                        tab.isActive
                                            ? "bg-slate-800 text-white border-t border-l border-r border-slate-700"
                                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                                    )}
                                >
                                    {/* Favicon */}
                                    {tab.favicon ? (
                                        <img
                                            src={tab.favicon}
                                            alt=""
                                            className="w-4 h-4 rounded flex-shrink-0"
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                    ) : (
                                        <div className="w-4 h-4 rounded bg-slate-600 flex-shrink-0" />
                                    )}

                                    {/* Title */}
                                    <span className="text-xs truncate flex-1 text-left">
                                        {tab.title || 'New Tab'}
                                    </span>

                                    {/* Close Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCloseTab(tab.id);
                                        }}
                                        className={cn(
                                            "p-0.5 rounded-full transition-all duration-200",
                                            "opacity-0 group-hover:opacity-100",
                                            "hover:bg-slate-600"
                                        )}
                                    >
                                        <X size={14} />
                                    </button>
                                </button>
                            ))}
                        </div>

                        {/* New Tab Button - Circular with hover effect */}
                        <button
                            onClick={() => handleCreateTab('https://www.google.com')}
                            className={cn(
                                "p-2 rounded-full transition-all duration-200",
                                "text-slate-400 hover:text-slate-200",
                                "hover:bg-slate-700/70",
                                "border border-transparent hover:border-slate-600",
                                "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                            )}
                            title="New Tab"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    {/* Address Bar */}
                    <AddressBar
                        activeTab={activeTab}
                        onNavigate={handleNavigate}
                        onBack={goBack}
                        onForward={goForward}
                        onReload={reload}
                        canGoBack={canGoBack}
                        canGoForward={canGoForward}
                        isLoading={isLoading}
                    />

                    {/* Browser Viewport */}
                    <BrowserViewport
                        activeTab={activeTab}
                        onCreateTab={handleCreateTab}
                        isLoading={isLoading}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
