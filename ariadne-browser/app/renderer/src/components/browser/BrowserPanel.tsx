/**
 * BrowserPanel Component
 * 
 * Stitch & Glass design - premium glassmorphism browser chrome
 * with neon accent tabs, glowing bookmarks bar, and refined controls.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, X, Plus, ExternalLink } from 'lucide-react';
import { AddressBar } from './AddressBar';
import { BrowserViewport } from './BrowserViewport';
import { WelcomePage } from './WelcomePage';
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
                        "h-full flex flex-col overflow-hidden"
                    )}
                    style={{ background: 'var(--sg-chrome)' }}
                >
                    {/* ─── Tab Strip ─── */}
                    <div
                        className="flex items-end px-1 pt-1 no-drag-region"
                        style={{
                            background: 'var(--sg-chrome)',
                            minHeight: '42px',
                            borderBottom: '1px solid var(--sg-border-subtle)',
                        }}
                    >
                        {/* Graph Toggle */}
                        {onToggleGraph && (
                            <button
                                onClick={onToggleGraph}
                                className="p-1.5 mb-1 mr-1 rounded-lg transition-all flex-shrink-0"
                                style={{
                                    color: showGraph ? 'var(--sg-cyan)' : 'var(--sg-text-tertiary)',
                                    background: showGraph ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                                    boxShadow: showGraph ? '0 0 12px rgba(34, 211, 238, 0.15)' : 'none',
                                }}
                                title={showGraph ? "Hide Graph (Alt+V)" : "Show Graph (Alt+V)"}
                            >
                                <LayoutGrid size={16} />
                            </button>
                        )}

                        {/* Tabs + New Tab Button */}
                        <div className="flex items-end flex-1 overflow-x-auto no-scrollbar">
                            {tabs.map(tab => (
                                <div
                                    key={tab.id}
                                    onClick={() => switchTab(tab.id)}
                                    className={cn(
                                        "group relative flex items-center gap-2 px-6 h-[34px] cursor-pointer transition-all duration-200",
                                        "tab-shape flex-shrink-0 -ml-3 hover:z-20",
                                        tab.isActive ? "z-30" : "z-10"
                                    )}
                                    style={{
                                        maxWidth: '240px',
                                        minWidth: '140px',
                                        width: `${Math.min(240, Math.max(140, (window.innerWidth - 300) / Math.max(tabs.length, 1)))}px`,
                                        background: tab.isActive ? 'var(--sg-surface-1)' : 'rgba(15, 23, 42, 0.4)',
                                        color: tab.isActive ? 'var(--sg-text-primary)' : 'var(--sg-text-secondary)',
                                        borderTop: tab.isActive ? '2px solid var(--sg-cyan)' : 'none',
                                        boxShadow: tab.isActive ? '0 -4px 20px rgba(34, 211, 238, 0.15)' : 'none',
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
                                        <div
                                            className="w-4 h-4 rounded-sm flex-shrink-0"
                                            style={{ background: 'var(--sg-surface-3)' }}
                                        />
                                    )}

                                    {/* Title */}
                                    <span className="text-[12px] truncate flex-1 text-left leading-none font-medium">
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
                                            tab.isActive
                                                ? "opacity-100"
                                                : "opacity-0 group-hover:opacity-100"
                                        )}
                                        style={{ color: 'var(--sg-text-tertiary)' }}
                                    >
                                        <X size={14} />
                                    </span>

                                    {/* Right separator for inactive tabs */}
                                    {!tab.isActive && (
                                        <div
                                            className="absolute right-0 top-[8px] bottom-[8px] w-[1px] group-hover:opacity-0 transition-opacity"
                                            style={{ background: 'var(--sg-border)' }}
                                        />
                                    )}
                                </div>
                            ))}

                            {/* ── + New Tab (inline) ── */}
                            <button
                                onClick={() => handleCreateTab('https://www.google.com')}
                                className="p-1.5 mb-0.5 ml-1 rounded-lg transition-all flex-shrink-0"
                                style={{ color: 'var(--sg-text-tertiary)' }}
                                title="New Tab (Ctrl+T)"
                                onMouseEnter={e => {
                                    e.currentTarget.style.color = 'var(--sg-cyan)';
                                    e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.color = 'var(--sg-text-tertiary)';
                                    e.currentTarget.style.background = 'transparent';
                                }}
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
                                className="overflow-hidden"
                                style={{
                                    background: 'var(--sg-surface-1)',
                                    borderBottom: '1px solid var(--sg-border-subtle)',
                                }}
                            >
                                <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto no-scrollbar">
                                    {bookmarks.map(bm => (
                                        <button
                                            key={bm.url}
                                            onClick={() => handleNavigate(bm.url)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-[12px] whitespace-nowrap flex-shrink-0 font-medium"
                                            style={{
                                                color: 'var(--sg-text-secondary)',
                                                background: 'transparent',
                                            }}
                                            title={bm.url}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'var(--sg-surface-3)';
                                                e.currentTarget.style.color = 'var(--sg-text-primary)';
                                                e.currentTarget.style.boxShadow = '0 0 8px rgba(34, 211, 238, 0.08)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = 'var(--sg-text-secondary)';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        >
                                            {bm.favicon ? (
                                                <img src={bm.favicon} alt="" className="w-3.5 h-3.5 rounded-sm"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <ExternalLink size={12} style={{ color: 'var(--sg-text-ghost)' }} className="flex-shrink-0" />
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

                    {/* ─── Browser Content ─── */}
                    {tabs.length === 0 ? (
                        <WelcomePage onNavigate={handleCreateTab} />
                    ) : (
                        <BrowserViewport
                            activeTab={activeTab}
                            onCreateTab={handleCreateTab}
                            isLoading={isLoading}
                        />
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
