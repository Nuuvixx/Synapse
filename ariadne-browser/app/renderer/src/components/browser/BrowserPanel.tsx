/**
 * BrowserPanel Component
 * 
 * Combines AddressBar and BrowserViewport into a complete browser experience.
 * Brave-inspired tab styling with inline + button and bookmarks bar.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, X, Plus, ExternalLink } from 'lucide-react';
import { AddressBar } from './AddressBar';
import { BrowserViewport } from './BrowserViewport';
import { useTabManager } from '@/hooks/useTabManager';
import { useTabNodeSync } from '@/hooks/useTabNodeSync';
import { useBookmarks } from '@/hooks/useBookmarks';
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

    const { createTabWithNode, closeTabAndNode } = useTabNodeSync();
    const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();
    const [showBookmarksBar, setShowBookmarksBar] = useState(true);

    const canGoBack = true;
    const canGoForward = true;

    const handleNavigate = async (url: string) => {
        if (activeTab) {
            await navigate(url);
        } else {
            await createTabWithNode(url);
        }
    };

    const handleCreateTab = async (url: string) => {
        await createTabWithNode(url);
    };

    const handleCloseTab = async (tabId: string) => {
        await closeTabAndNode(tabId);
    };

    const handleToggleBookmark = () => {
        if (activeTab) {
            toggleBookmark(activeTab.url, activeTab.title, activeTab.favicon);
        }
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
                        "h-full flex flex-col overflow-hidden",
                        !fullscreen && "border-l border-[#3b3d44]"
                    )}
                    style={{ background: '#202124' }}
                >
                    {/* ─── Tab Strip ─── */}
                    <div
                        className="flex items-end px-1 pt-1 no-drag-region"
                        style={{
                            background: '#202124',
                            minHeight: '40px'
                        }}
                    >
                        {/* Graph Toggle */}
                        {onToggleGraph && (
                            <button
                                onClick={onToggleGraph}
                                className={cn(
                                    "p-1.5 mb-1 mr-1 rounded-md transition-colors flex-shrink-0",
                                    showGraph
                                        ? "text-emerald-400 bg-emerald-500/10"
                                        : "text-[#9aa0a6] hover:text-white hover:bg-[#35363a]"
                                )}
                                title={showGraph ? "Hide Graph (Alt+V)" : "Show Graph (Alt+V)"}
                            >
                                <LayoutGrid size={16} />
                            </button>
                        )}

                        {/* Tabs + New Tab Button (inline, like Brave) */}
                        <div className="flex items-end flex-1 overflow-x-auto no-scrollbar">
                            {tabs.map(tab => (
                                <div
                                    key={tab.id}
                                    onClick={() => switchTab(tab.id)}
                                    className={cn(
                                        "group relative flex items-center gap-2 px-3 h-[34px] cursor-pointer transition-colors duration-150",
                                        "rounded-t-lg flex-shrink-0",
                                        tab.isActive
                                            ? "bg-[#292b2f] text-[#e8eaed]"
                                            : "text-[#9aa0a6] hover:bg-[#292b2f]/50 hover:text-[#c4c7cc]"
                                    )}
                                    style={{
                                        maxWidth: '240px',
                                        minWidth: tabs.length > 8 ? '40px' : '120px',
                                        width: `${Math.min(240, Math.max(120, (window.innerWidth - 200) / Math.max(tabs.length, 1)))}px`
                                    }}
                                    title={tab.title}
                                >
                                    {/* Favicon */}
                                    {tab.favicon ? (
                                        <img
                                            src={tab.favicon}
                                            alt=""
                                            className="w-4 h-4 rounded-sm flex-shrink-0"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: '#5f6368' }} />
                                    )}

                                    {/* Title */}
                                    <span className="text-[12px] truncate flex-1 text-left leading-none">
                                        {tab.title || 'New Tab'}
                                    </span>

                                    {/* Close */}
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCloseTab(tab.id);
                                        }}
                                        className={cn(
                                            "p-0.5 rounded-full transition-all cursor-pointer flex-shrink-0",
                                            "hover:bg-[#5f6368] text-[#9aa0a6] hover:text-white",
                                            tab.isActive
                                                ? "opacity-100"
                                                : "opacity-0 group-hover:opacity-100"
                                        )}
                                    >
                                        <X size={14} />
                                    </span>

                                    {/* Right separator for inactive tabs */}
                                    {!tab.isActive && (
                                        <div className="absolute right-0 top-[6px] bottom-[6px] w-[1px] bg-[#3b3d44] group-hover:opacity-0 transition-opacity" />
                                    )}
                                </div>
                            ))}

                            {/* ── + New Tab (inline, right after last tab) ── */}
                            <button
                                onClick={() => handleCreateTab('https://www.google.com')}
                                className={cn(
                                    "p-1.5 mb-0.5 ml-1 rounded-full transition-colors flex-shrink-0",
                                    "text-[#9aa0a6] hover:text-white hover:bg-[#35363a]"
                                )}
                                title="New Tab (Ctrl+T)"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ─── Address Bar ─── */}
                    <AddressBar
                        activeTab={activeTab}
                        onNavigate={handleNavigate}
                        onBack={goBack}
                        onForward={goForward}
                        onReload={reload}
                        canGoBack={canGoBack}
                        canGoForward={canGoForward}
                        isLoading={isLoading}
                        isBookmarked={activeTab ? isBookmarked(activeTab.url) : false}
                        onToggleBookmark={handleToggleBookmark}
                        onToggleBookmarksBar={() => setShowBookmarksBar(!showBookmarksBar)}
                        showBookmarksBar={showBookmarksBar}
                    />

                    {/* ─── Bookmarks Bar ─── */}
                    <AnimatePresence>
                        {showBookmarksBar && bookmarks.length > 0 && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden border-b border-[#3b3d44]"
                                style={{ background: '#292b2f' }}
                            >
                                <div className="flex items-center gap-1 px-3 py-1 overflow-x-auto no-scrollbar">
                                    {bookmarks.map(bm => (
                                        <button
                                            key={bm.url}
                                            onClick={() => handleNavigate(bm.url)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors",
                                                "text-[#c4c7cc] hover:bg-[#35363a] hover:text-white",
                                                "text-[12px] whitespace-nowrap flex-shrink-0"
                                            )}
                                            title={bm.url}
                                        >
                                            {bm.favicon ? (
                                                <img src={bm.favicon} alt="" className="w-3.5 h-3.5 rounded-sm"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <ExternalLink size={12} className="text-[#9aa0a6] flex-shrink-0" />
                                            )}
                                            <span className="max-w-[120px] truncate">
                                                {bm.title || new URL(bm.url).hostname}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ─── Browser Viewport ─── */}
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
