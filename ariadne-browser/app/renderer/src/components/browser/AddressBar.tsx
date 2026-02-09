/**
 * AddressBar Component
 * 
 * URL input and navigation controls for the active browser tab.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    RotateCw,
    Shield,
    Search,
    X,
    Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { TabInfo } from '@/types';

interface AddressBarProps {
    activeTab: TabInfo | null;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
    isLoading?: boolean;
}

export function AddressBar({
    activeTab,
    onNavigate,
    onBack,
    onForward,
    onReload,
    canGoBack,
    canGoForward,
    isLoading = false
}: AddressBarProps) {
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync input with active tab URL
    useEffect(() => {
        if (activeTab && !isFocused) {
            setInputValue(activeTab.url);
        }
    }, [activeTab?.url, isFocused]);

    // Handle URL submission
    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();

        let url = inputValue.trim();
        if (!url) return;

        // Auto-add https:// if no protocol
        if (!/^https?:\/\//i.test(url)) {
            // Check if it looks like a domain
            if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(url)) {
                url = `https://${url}`;
            } else {
                // Treat as search query
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
        }

        onNavigate(url);
        inputRef.current?.blur();
    }, [inputValue, onNavigate]);

    // Extract display URL (show domain prominently)
    const getDisplayUrl = () => {
        if (!activeTab?.url) return '';
        try {
            const urlObj = new URL(activeTab.url);
            return urlObj.hostname + urlObj.pathname + urlObj.search;
        } catch {
            return activeTab.url;
        }
    };

    // Check if HTTPS
    const isSecure = activeTab?.url?.startsWith('https://');

    return (
        <div className="h-10 flex items-center gap-2 px-3 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800">
            {/* Navigation Controls */}
            <div className="flex items-center gap-1">
                <button
                    onClick={onBack}
                    disabled={!canGoBack}
                    className={cn(
                        "p-1.5 rounded-md transition-colors",
                        canGoBack
                            ? "hover:bg-slate-700 text-slate-300 hover:text-white"
                            : "text-slate-600 cursor-not-allowed"
                    )}
                    title="Go back"
                >
                    <ArrowLeft size={16} />
                </button>

                <button
                    onClick={onForward}
                    disabled={!canGoForward}
                    className={cn(
                        "p-1.5 rounded-md transition-colors",
                        canGoForward
                            ? "hover:bg-slate-700 text-slate-300 hover:text-white"
                            : "text-slate-600 cursor-not-allowed"
                    )}
                    title="Go forward"
                >
                    <ArrowRight size={16} />
                </button>

                <button
                    onClick={onReload}
                    disabled={!activeTab}
                    className={cn(
                        "p-1.5 rounded-md transition-colors",
                        activeTab
                            ? "hover:bg-slate-700 text-slate-300 hover:text-white"
                            : "text-slate-600 cursor-not-allowed"
                    )}
                    title="Reload"
                >
                    <RotateCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Address Input */}
            <form onSubmit={handleSubmit} className="flex-1 relative">
                <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
                    "bg-slate-800 border",
                    isFocused
                        ? "border-cyan-500/50 ring-2 ring-cyan-500/20"
                        : "border-slate-700 hover:border-slate-600"
                )}>
                    {/* Security Icon */}
                    <AnimatePresence mode="wait">
                        {activeTab && !isFocused && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                            >
                                {isSecure ? (
                                    <Shield size={14} className="text-emerald-400" />
                                ) : (
                                    <Shield size={14} className="text-slate-500" />
                                )}
                            </motion.div>
                        )}
                        {(!activeTab || isFocused) && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                            >
                                <Search size={14} className="text-slate-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* URL Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={isFocused ? inputValue : getDisplayUrl()}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={() => {
                            setIsFocused(true);
                            setInputValue(activeTab?.url || '');
                            // Select all on focus
                            setTimeout(() => inputRef.current?.select(), 0);
                        }}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Search or enter URL..."
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
                    />

                    {/* Clear Button (when focused and has content) */}
                    <AnimatePresence>
                        {isFocused && inputValue && (
                            <motion.button
                                type="button"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => {
                                    setInputValue('');
                                    inputRef.current?.focus();
                                }}
                                className="p-0.5 hover:bg-slate-600 rounded transition-colors"
                            >
                                <X size={12} className="text-slate-400" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                    {/* Bookmark Button */}
                    <button
                        type="button"
                        onClick={() => setIsBookmarked(!isBookmarked)}
                        className={cn(
                            "p-1 rounded-full transition-colors mr-1",
                            "hover:bg-slate-700",
                            isBookmarked ? "text-yellow-400" : "text-slate-400 hover:text-slate-200"
                        )}
                        title={isBookmarked ? "Edit Bookmark" : "Bookmark this tab"}
                    >
                        <Star size={14} fill={isBookmarked ? "currentColor" : "none"} />
                    </button>
                </div>
            </form>

            {/* Tab Favicon & Title */}
            <AnimatePresence>
                {activeTab && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-2 max-w-48 overflow-hidden"
                    >
                        {activeTab.favicon && (
                            <img
                                src={activeTab.favicon}
                                alt=""
                                className="w-4 h-4 rounded"
                                onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                        )}
                        <span className="text-xs text-slate-400 truncate">
                            {activeTab.title || 'Loading...'}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
