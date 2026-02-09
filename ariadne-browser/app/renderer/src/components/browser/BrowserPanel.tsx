/**
 * BrowserPanel Component
 * 
 * Combines AddressBar and BrowserViewport into a complete browser experience.
 * This panel can be toggled alongside the graph view.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Layers, PanelRightClose } from 'lucide-react';
import { AddressBar } from './AddressBar';
import { BrowserViewport } from './BrowserViewport';
import { useTabManager } from '@/hooks/useTabManager';
import { useTabNodeSync } from '@/hooks/useTabNodeSync';
import { cn } from '@/lib/utils';

interface BrowserPanelProps {
    isOpen: boolean;
}

export function BrowserPanel({ isOpen }: BrowserPanelProps) {
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

    // Track navigation capabilities - for now always enabled
    // In a real implementation, we'd query webContents.canGoBack/Forward
    const canGoBack = true;
    const canGoForward = true;

    // Handle navigation - creates tab with node if none exists
    const handleNavigate = async (url: string) => {
        if (activeTab) {
            await navigate(url);
        } else {
            // Create tab with associated graph node
            await createTabWithNode(url);
        }
    };

    // Handle new tab creation with node
    const handleCreateTab = async (url: string) => {
        await createTabWithNode(url);
    };

    // Handle tab close with node update
    const handleCloseTab = async (tabId: string) => {
        await closeTabAndNode(tabId);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: '50%', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="h-full flex flex-col bg-slate-900 border-l border-slate-800 overflow-hidden"
                >
                    {/* Tab Bar */}
                    <div className="h-9 flex items-center gap-1 px-2 bg-slate-900 border-b border-slate-800 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => switchTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs max-w-[160px] truncate transition-colors",
                                    tab.isActive
                                        ? "bg-slate-700 text-white"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                )}
                            >
                                {tab.favicon && (
                                    <img
                                        src={tab.favicon}
                                        alt=""
                                        className="w-3.5 h-3.5 rounded"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                )}
                                <span className="truncate">{tab.title || 'New Tab'}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCloseTab(tab.id);
                                    }}
                                    className="ml-auto p-0.5 hover:bg-slate-600 rounded opacity-50 hover:opacity-100"
                                >
                                    ×
                                </button>
                            </button>
                        ))}

                        {/* New Tab Button */}
                        <button
                            onClick={() => handleCreateTab('https://www.google.com')}
                            className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-md transition-colors"
                            title="New Tab"
                        >
                            +
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

/**
 * Toggle button for browser panel
 */
export function BrowserPanelToggle({
    isOpen,
    onToggle
}: {
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className={cn(
                "fixed bottom-4 right-4 z-40 p-3 rounded-full shadow-lg transition-all",
                "bg-gradient-to-br from-cyan-500 to-purple-600 text-white",
                "hover:shadow-xl hover:scale-105"
            )}
            title={isOpen ? "Close Browser" : "Open Browser"}
        >
            {isOpen ? (
                <PanelRightClose size={20} />
            ) : (
                <Layers size={20} />
            )}
        </button>
    );
}
