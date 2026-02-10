/**
 * AddressBar Component
 * 
 * URL input and navigation controls for the active browser tab.
 * Brave-inspired design with bookmark star and clean layout.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    RotateCw,
    Lock,
    Search,
    X,
    Star,
    Bookmark
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
    isBookmarked?: boolean;
    onToggleBookmark?: () => void;
    onToggleBookmarksBar?: () => void;
    showBookmarksBar?: boolean;
}

export function AddressBar({
    activeTab,
    onNavigate,
    onBack,
    onForward,
    onReload,
    canGoBack,
    canGoForward,
    isLoading = false,
    isBookmarked = false,
    onToggleBookmark,
    onToggleBookmarksBar,
    showBookmarksBar = true
}: AddressBarProps) {
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
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

    const isSecure = activeTab?.url?.startsWith('https://');

    return (
        <div
            className="flex items-center gap-2 px-2 no-drag-region"
            style={{
                background: '#292b2f',
                height: '42px',
                borderBottom: '1px solid #3b3d44'
            }}
        >
            {/* Navigation Controls */}
            <div className="flex items-center gap-0.5">
                <button
                    onClick={onBack}
                    disabled={!canGoBack}
                    className={cn(
                        "p-1.5 rounded-full transition-colors",
                        canGoBack
                            ? "hover:bg-[#35363a] text-[#9aa0a6] hover:text-white"
                            : "text-[#5f6368] cursor-not-allowed"
                    )}
                    title="Go back (Alt+←)"
                >
                    <ArrowLeft size={18} />
                </button>

                <button
                    onClick={onForward}
                    disabled={!canGoForward}
                    className={cn(
                        "p-1.5 rounded-full transition-colors",
                        canGoForward
                            ? "hover:bg-[#35363a] text-[#9aa0a6] hover:text-white"
                            : "text-[#5f6368] cursor-not-allowed"
                    )}
                    title="Go forward (Alt+→)"
                >
                    <ArrowRight size={18} />
                </button>

                <button
                    onClick={onReload}
                    disabled={!activeTab}
                    className={cn(
                        "p-1.5 rounded-full transition-colors",
                        activeTab
                            ? "hover:bg-[#35363a] text-[#9aa0a6] hover:text-white"
                            : "text-[#5f6368] cursor-not-allowed"
                    )}
                    title="Reload (Ctrl+R)"
                >
                    <RotateCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Address Input */}
            <form onSubmit={handleSubmit} className="flex-1 relative">
                <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
                    "border",
                    isFocused
                        ? "bg-[#202124] border-[#8ab4f8] ring-1 ring-[#8ab4f8]/30"
                        : "bg-[#35363a] border-transparent hover:bg-[#3c3d41]"
                )}>
                    {/* Security / Search Icon */}
                    {activeTab && !isFocused ? (
                        isSecure ? (
                            <Lock size={14} className="text-[#9aa0a6] flex-shrink-0" />
                        ) : (
                            <Search size={14} className="text-[#9aa0a6] flex-shrink-0" />
                        )
                    ) : (
                        <Search size={14} className="text-[#9aa0a6] flex-shrink-0" />
                    )}

                    {/* URL Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={isFocused ? inputValue : getDisplayUrl()}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={() => {
                            setIsFocused(true);
                            setInputValue(activeTab?.url || '');
                            setTimeout(() => inputRef.current?.select(), 0);
                        }}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Search or enter URL..."
                        className="flex-1 bg-transparent text-sm text-[#e8eaed] placeholder-[#9aa0a6] focus:outline-none"
                    />

                    {/* Clear Button */}
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
                                className="p-0.5 hover:bg-[#5f6368] rounded-full transition-colors"
                            >
                                <X size={14} className="text-[#9aa0a6]" />
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* Bookmark Star */}
                    {activeTab && onToggleBookmark && (
                        <button
                            type="button"
                            onClick={onToggleBookmark}
                            className={cn(
                                "p-0.5 rounded-full transition-colors",
                                "hover:bg-[#35363a]",
                                isBookmarked ? "text-[#fbbc04]" : "text-[#9aa0a6] hover:text-white"
                            )}
                            title={isBookmarked ? "Remove bookmark" : "Bookmark this tab"}
                        >
                            <Star size={16} fill={isBookmarked ? "currentColor" : "none"} />
                        </button>
                    )}
                </div>
            </form>

            {/* Bookmarks Bar Toggle */}
            {onToggleBookmarksBar && (
                <button
                    onClick={onToggleBookmarksBar}
                    className={cn(
                        "p-1.5 rounded-full transition-colors",
                        showBookmarksBar
                            ? "text-[#8ab4f8] bg-[#8ab4f8]/10"
                            : "text-[#9aa0a6] hover:text-white hover:bg-[#35363a]"
                    )}
                    title={showBookmarksBar ? "Hide bookmarks bar" : "Show bookmarks bar"}
                >
                    <Bookmark size={16} />
                </button>
            )}
        </div>
    );
}
