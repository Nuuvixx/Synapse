/**
 * useBookmarks Hook
 * 
 * Manages browser bookmarks with localStorage persistence.
 */

import { useState, useCallback, useEffect } from 'react';

export interface Bookmark {
    url: string;
    title: string;
    favicon: string | null;
    addedAt: number;
}

const STORAGE_KEY = 'ariadne-bookmarks';

function loadBookmarks(): Bookmark[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveBookmarks(bookmarks: Bookmark[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (err) {
        console.error('Failed to save bookmarks:', err);
    }
}

export function useBookmarks() {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);

    // Persist on change
    useEffect(() => {
        saveBookmarks(bookmarks);
    }, [bookmarks]);

    const addBookmark = useCallback((url: string, title: string, favicon: string | null = null) => {
        setBookmarks(prev => {
            // Don't add duplicates
            if (prev.some(b => b.url === url)) return prev;
            return [...prev, { url, title, favicon, addedAt: Date.now() }];
        });
    }, []);

    const removeBookmark = useCallback((url: string) => {
        setBookmarks(prev => prev.filter(b => b.url !== url));
    }, []);

    const toggleBookmark = useCallback((url: string, title: string, favicon: string | null = null) => {
        setBookmarks(prev => {
            const exists = prev.some(b => b.url === url);
            if (exists) {
                return prev.filter(b => b.url !== url);
            }
            return [...prev, { url, title, favicon, addedAt: Date.now() }];
        });
    }, []);

    const isBookmarked = useCallback((url: string): boolean => {
        return bookmarks.some(b => b.url === url);
    }, [bookmarks]);

    return {
        bookmarks,
        addBookmark,
        removeBookmark,
        toggleBookmark,
        isBookmarked
    };
}
