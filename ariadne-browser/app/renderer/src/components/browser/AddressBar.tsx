/**
 * AddressBar Component
 * 
 * Stitch & Glass design - sleek glassmorphism URL bar
 * with neon glow focus state, golden bookmark star, and refined controls.
 */

import { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    RotateCw,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Star,
    Bookmark,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabInfo {
    id: string;
    url: string;
    title: string;
    favicon?: string;
    isActive: boolean;
    isLoading: boolean;
}

interface AddressBarProps {
    activeTab: TabInfo | null;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
    isLoading: boolean;
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
    isLoading,
    isBookmarked = false,
    onToggleBookmark,
    onToggleBookmarksBar,
    showBookmarksBar = false
}: AddressBarProps) {
    const [inputValue, setInputValue] = useState(activeTab?.url || '');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isFocused && activeTab?.url) {
            setInputValue(activeTab.url);
        }
    }, [activeTab?.url, isFocused]);

    const getSecurityInfo = (url: string) => {
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol === 'https:') {
                return { icon: ShieldCheck, color: 'var(--sg-emerald)', label: 'Secure' };
            }
            if (urlObj.protocol === 'http:') {
                return { icon: ShieldAlert, color: 'var(--sg-rose)', label: 'Not Secure' };
            }
            return { icon: Shield, color: 'var(--sg-text-ghost)', label: 'Internal' };
        } catch {
            return { icon: Shield, color: 'var(--sg-text-ghost)', label: 'Internal' };
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let url = inputValue.trim();
        if (!url) return;

        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
        }

        onNavigate(url);
        inputRef.current?.blur();
    };

    const handleFocus = () => {
        setIsFocused(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (activeTab?.url) {
            setInputValue(activeTab.url);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            inputRef.current?.blur();
        }
    };

    const security = activeTab ? getSecurityInfo(activeTab.url) : null;
    const SecurityIcon = security?.icon || Shield;

    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5 no-drag-region"
            style={{
                background: 'var(--sg-surface-1)',
                borderBottom: '1px solid var(--sg-border-subtle)',
            }}
        >
            {/* Navigation Buttons */}
            <div className="flex items-center gap-0.5">
                <NavButton onClick={onBack} disabled={!canGoBack} title="Back">
                    <ArrowLeft size={16} />
                </NavButton>
                <NavButton onClick={onForward} disabled={!canGoForward} title="Forward">
                    <ArrowRight size={16} />
                </NavButton>
                <NavButton onClick={onReload} title="Reload">
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--sg-cyan)' }} />
                    ) : (
                        <RotateCw size={16} />
                    )}
                </NavButton>
            </div>

            {/* URL Input */}
            <form onSubmit={handleSubmit} className="flex-1">
                <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200"
                    style={{
                        background: isFocused ? 'var(--sg-surface-3)' : 'var(--sg-surface-2)',
                        border: `1px solid ${isFocused ? 'var(--sg-border-glow-cyan)' : 'var(--sg-border-subtle)'}`,
                        boxShadow: isFocused ? 'var(--sg-glow-cyan)' : 'none',
                    }}
                >
                    {/* Security Icon */}
                    {security && (
                        <SecurityIcon
                            size={14}
                            style={{ color: security.color, flexShrink: 0 }}
                            title={security.label}
                        />
                    )}

                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="Search or enter URL"
                        spellCheck={false}
                        className="flex-1 bg-transparent outline-none text-[13px] font-medium"
                        style={{
                            color: isFocused ? 'var(--sg-text-primary)' : 'var(--sg-text-secondary)',
                        }}
                    />

                    {/* Bookmark Star */}
                    {activeTab && onToggleBookmark && (
                        <button
                            type="button"
                            onClick={onToggleBookmark}
                            className="p-0.5 rounded-full transition-all"
                            style={{
                                color: isBookmarked ? 'var(--sg-amber)' : 'var(--sg-text-ghost)',
                            }}
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
                    className="p-1.5 rounded-lg transition-all"
                    style={{
                        color: showBookmarksBar ? 'var(--sg-cyan)' : 'var(--sg-text-ghost)',
                        background: showBookmarksBar ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                    }}
                    title={showBookmarksBar ? "Hide bookmarks bar" : "Show bookmarks bar"}
                >
                    <Bookmark size={16} />
                </button>
            )}
        </div>
    );
}

/* ── Reusable Nav Button ── */
function NavButton({
    onClick,
    disabled,
    title,
    children
}: {
    onClick: () => void;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="p-1.5 rounded-lg transition-all"
            style={{
                color: disabled ? 'var(--sg-text-ghost)' : 'var(--sg-text-tertiary)',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.4 : 1,
            }}
            title={title}
            onMouseEnter={e => {
                if (!disabled) {
                    e.currentTarget.style.background = 'var(--sg-surface-3)';
                    e.currentTarget.style.color = 'var(--sg-text-primary)';
                }
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = disabled ? 'var(--sg-text-ghost)' : 'var(--sg-text-tertiary)';
            }}
        >
            {children}
        </button>
    );
}
