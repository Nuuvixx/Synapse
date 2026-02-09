/**
 * BrowserViewport Component
 * 
 * Visual placeholder/container for the native WebContentsView.
 * The actual WebContentsView is rendered by Electron's main process
 * and overlays this area. This component provides:
 * - Empty state when no tab is active
 * - Loading indicator
 * - Coordinates for proper view positioning
 */

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Plus } from 'lucide-react';
import type { TabInfo } from '@/types';

interface BrowserViewportProps {
    activeTab: TabInfo | null;
    onCreateTab: (url: string) => void;
    isLoading?: boolean;
}

export function BrowserViewport({
    activeTab,
    onCreateTab,
    isLoading = false
}: BrowserViewportProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [bounds, setBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });

    // Track container bounds for native view positioning
    useEffect(() => {
        const updateBounds = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setBounds({
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                });
            }
        };

        updateBounds();
        window.addEventListener('resize', updateBounds);

        // Also update on any layout change
        const observer = new ResizeObserver(updateBounds);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateBounds);
            observer.disconnect();
        };
    }, []);

    // Quick links for empty state
    const quickLinks = [
        { name: 'Google', url: 'https://www.google.com', icon: '🔍' },
        { name: 'GitHub', url: 'https://github.com', icon: '🐙' },
        { name: 'YouTube', url: 'https://www.youtube.com', icon: '📺' },
        { name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: '💡' },
        { name: 'Reddit', url: 'https://www.reddit.com', icon: '🗣️' },
        { name: 'Twitter', url: 'https://twitter.com', icon: '🐦' },
    ];

    return (
        <div
            ref={containerRef}
            className="flex-1 relative bg-slate-950 overflow-hidden"
            data-viewport-bounds={JSON.stringify(bounds)}
        >
            {/* Empty State - shown when no tab is active */}
            <AnimatePresence>
                {!activeTab && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 flex flex-col items-center justify-center"
                    >
                        {/* Logo */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="mb-8"
                        >
                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                                <Globe size={48} className="text-white" />
                            </div>
                        </motion.div>

                        {/* Title */}
                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-2xl font-bold text-slate-200 mb-2"
                        >
                            Welcome to Ariadne
                        </motion.h1>
                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-slate-500 mb-8"
                        >
                            Navigate the web in spatial context
                        </motion.p>

                        {/* Quick Links */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="grid grid-cols-3 gap-3 max-w-md"
                        >
                            {quickLinks.map((link) => (
                                <button
                                    key={link.name}
                                    onClick={() => onCreateTab(link.url)}
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/50 hover:bg-slate-800 transition-all group"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">
                                        {link.icon}
                                    </span>
                                    <span className="text-sm text-slate-400 group-hover:text-slate-200">
                                        {link.name}
                                    </span>
                                </button>
                            ))}
                        </motion.div>

                        {/* New Tab Button */}
                        <motion.button
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            onClick={() => onCreateTab('https://www.google.com')}
                            className="mt-8 flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-medium transition-colors"
                        >
                            <Plus size={18} />
                            New Tab
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading Overlay */}
            <AnimatePresence>
                {isLoading && activeTab && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-10"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-slate-400">Loading...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Active Tab Indicator (when WebContentsView is mounted) */}
            {activeTab && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-slate-700 text-sm">
                        WebContentsView active: {activeTab.title || activeTab.url}
                    </p>
                </div>
            )}
        </div>
    );
}
