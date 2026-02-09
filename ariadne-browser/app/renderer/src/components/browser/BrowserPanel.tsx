/**
 * BrowserPanel Component
 * 
 * Combines AddressBar and BrowserViewport into a complete browser experience.
 * Features Chrome-like rounded tabs for a modern feel.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, X, Plus, Book } from 'lucide-react';
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
                        <div className="flex items-end flex-1 overflow-x-auto min-h-[40px] px-1 no-scrollbar">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => switchTab(tab.id)}
                                    className={cn(
                                        "group relative flex items-center gap-2 px-3 py-2.5 transition-all duration-200",
                                        "rounded-t-xl mx-0.5", // More rounded top corners
                                        "flex-1 min-w-[30px] max-w-[240px]", // Better sizing behavior
                                        tab.isActive
                                            ? "bg-slate-900 text-white shadow-sm z-10" // Active: matches address bar, z-index up
                                            : "bg-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                                    )}
                                    title={tab.title}
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
                                    <span className={cn(
                                        "text-xs truncate text-left transition-opacity",
                                        // Hide title if tab gets too small, unless hovered
                                        "flex-1"
                                    )}>
                                        {tab.title || 'New Tab'}
                                    </span>

                                    {/* Close Button */}
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCloseTab(tab.id);
                                        }}
                                        className={cn(
                                            "p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer",
                                            "hover:bg-slate-700 hover:text-white text-slate-400",
                                            // Always show close button on active tab if space permits
                                            tab.isActive && "opacity-100"
                                        )}
                                    >
                                        <X size={14} />
                                    </span>

                                    {/* Separator for inactive tabs (visual polish) */}
                                    {!tab.isActive && (
                                        <div className="absolute right-0 top-2 bottom-2 w-[1px] bg-slate-700/50 group-hover:hidden" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Controls Group */}
                        <div className="flex items-center gap-1 px-2">
                            {/* Bookmarks Button */}
                            <button
                                className={cn(
                                    "p-2 rounded-lg transition-all duration-200",
                                    "text-slate-400 hover:text-slate-200 hover:bg-slate-700/70"
                                )}
                                title="Bookmarks"
                            >
                                <Book size={18} />
                            </button>

                            {/* New Tab Button */}
                            <button
                                onClick={() => handleCreateTab('https://www.google.com')}
                                className={cn(
                                    "p-2 rounded-full transition-all duration-200",
                                    "text-slate-400 hover:text-slate-200 hover:bg-slate-700/70"
                                )}
                                title="New Tab"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
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
