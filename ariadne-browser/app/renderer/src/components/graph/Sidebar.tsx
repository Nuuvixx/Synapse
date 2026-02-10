/**
 * Sidebar Component — Stitch & Glass Design
 * 
 * Glassmorphism sidebar with session management,
 * tree browser, and refined settings panel.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderTree,
  History,
  Bookmark,
  Settings,
  Plus,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Search
} from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'sessions' | 'trees' | 'settings';

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(2, 6, 23, 0.6)', backdropFilter: 'blur(4px)' }}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            className="fixed left-0 top-8 bottom-0 w-80 z-50 flex flex-col"
            style={{
              background: 'var(--sg-surface-1)',
              borderRight: '1px solid var(--sg-border)',
              boxShadow: 'var(--sg-shadow-xl)',
            }}
          >
            {/* Header */}
            <div className="p-4" style={{ borderBottom: '1px solid var(--sg-border-subtle)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--sg-cyan), var(--sg-purple))',
                    boxShadow: '0 0 16px rgba(34, 211, 238, 0.25)',
                  }}
                >
                  <span className="text-xl">🧭</span>
                </div>
                <div>
                  <h1 className="font-bold" style={{ color: 'var(--sg-text-primary)' }}>Ariadne</h1>
                  <p className="text-xs" style={{ color: 'var(--sg-text-ghost)' }}>Spatial Web Browser</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--sg-text-ghost)' }} />
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'var(--sg-surface-2)',
                    border: '1px solid var(--sg-border-subtle)',
                    color: 'var(--sg-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex" style={{ borderBottom: '1px solid var(--sg-border-subtle)' }}>
              <SidebarTab active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} icon={<History className="w-4 h-4" />} label="Sessions" />
              <SidebarTab active={activeTab === 'trees'} onClick={() => setActiveTab('trees')} icon={<Bookmark className="w-4 h-4" />} label="Trees" />
              <SidebarTab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings className="w-4 h-4" />} label="Settings" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'sessions' && <SessionsTab searchQuery={searchQuery} />}
              {activeTab === 'trees' && <TreesTab searchQuery={searchQuery} />}
              {activeTab === 'settings' && <SettingsTab />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Sub-Components ── */

function SidebarTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all"
      style={{
        color: active ? 'var(--sg-cyan)' : 'var(--sg-text-tertiary)',
        borderBottom: active ? '2px solid var(--sg-cyan)' : '2px solid transparent',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function SessionsTab({ searchQuery }: { searchQuery: string }) {
  const sessions = useGraphStore(state => state.sessions);
  const currentSessionId = useGraphStore(state => state.currentSessionId);
  const switchSession = useGraphStore(state => state.switchSession);
  const createSession = useGraphStore(state => state.createSession);
  const deleteSession = useGraphStore(state => state.deleteSession);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const filteredSessions = sessions.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreateSession = () => {
    const name = prompt('Enter session name:');
    if (name) createSession(name);
  };

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-2">
      <button
        onClick={handleCreateSession}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm font-medium"
        style={{
          background: 'rgba(34, 211, 238, 0.1)',
          color: 'var(--sg-cyan)',
          border: '1px solid rgba(34, 211, 238, 0.15)',
        }}
      >
        <Plus className="w-4 h-4" /> New Session
      </button>

      {filteredSessions.map(session => (
        <div
          key={session.id}
          className="rounded-xl overflow-hidden transition-all"
          style={{
            border: session.id === currentSessionId ? '1px solid rgba(34, 211, 238, 0.3)' : '1px solid var(--sg-border-subtle)',
            background: session.id === currentSessionId ? 'rgba(34, 211, 238, 0.05)' : 'var(--sg-surface-2)',
          }}
        >
          <div
            className="flex items-center justify-between p-3 cursor-pointer"
            onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
          >
            <div className="flex items-center gap-2">
              {expandedSession === session.id ? (
                <ChevronDown className="w-4 h-4" style={{ color: 'var(--sg-text-ghost)' }} />
              ) : (
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--sg-text-ghost)' }} />
              )}
              <span className="text-sm font-medium" style={{ color: 'var(--sg-text-primary)' }}>{session.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--sg-text-ghost)' }}>{formatTime(session.updatedAt)}</span>
              {session.id === currentSessionId && (
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--sg-cyan)', boxShadow: '0 0 6px rgba(34, 211, 238, 0.5)' }} />
              )}
            </div>
          </div>

          {expandedSession === session.id && (
            <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--sg-border-subtle)' }}>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3" style={{ color: 'var(--sg-text-ghost)' }}>
                <div><span style={{ color: 'var(--sg-text-secondary)' }}>{session.nodeCount}</span> pages</div>
                <div><span style={{ color: 'var(--sg-text-secondary)' }}>{session.edgeCount}</span> links</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => switchSession(session.id)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: 'var(--sg-surface-3)', color: 'var(--sg-text-primary)' }}
                >Switch</button>
                <button
                  onClick={() => { if (confirm('Delete this session?')) deleteSession(session.id); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: 'rgba(251, 113, 133, 0.1)', color: 'var(--sg-rose)' }}
                >Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TreesTab({ searchQuery }: { searchQuery: string }) {
  const savedTrees = useGraphStore(state => state.savedTrees);
  const loadTree = useGraphStore(state => state.loadTree);
  const deleteTree = useGraphStore(state => state.deleteTree);
  const filteredTrees = savedTrees.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-2">
      {filteredTrees.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--sg-text-ghost)' }}>
          <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No saved trees yet</p>
          <p className="text-xs mt-1">Select nodes and save them as a tree</p>
        </div>
      ) : (
        filteredTrees.map(tree => (
          <div
            key={tree.id}
            className="flex items-center justify-between p-3 rounded-xl transition-all"
            style={{ background: 'var(--sg-surface-2)', border: '1px solid var(--sg-border-subtle)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--sg-text-primary)' }}>{tree.name}</p>
              <p className="text-xs" style={{ color: 'var(--sg-text-ghost)' }}>{tree.nodeCount} pages • {formatTime(tree.createdAt)}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => loadTree(tree.id)} className="p-2 rounded-lg transition-all" style={{ color: 'var(--sg-text-tertiary)' }} title="Load tree">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => { if (confirm('Delete?')) deleteTree(tree.id); }} className="p-2 rounded-lg transition-all" style={{ color: 'var(--sg-text-tertiary)' }} title="Delete">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SettingsTab() {
  const dimClosedNodes = useGraphStore(state => state.dimClosedNodes);
  const showThumbnails = useGraphStore(state => state.showThumbnails);
  const showFavicons = useGraphStore(state => state.showFavicons);
  const clusterByDomain = useGraphStore(state => state.clusterByDomain);
  const setDimClosedNodes = useGraphStore(state => state.setDimClosedNodes);
  const setShowThumbnails = useGraphStore(state => state.setShowThumbnails);
  const setShowFavicons = useGraphStore(state => state.setShowFavicons);
  const setClusterByDomain = useGraphStore(state => state.setClusterByDomain);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sg-text-ghost)' }}>View Options</h3>
        <ToggleSetting label="Dim closed tabs" checked={dimClosedNodes} onChange={setDimClosedNodes} />
        <ToggleSetting label="Show thumbnails" checked={showThumbnails} onChange={setShowThumbnails} />
        <ToggleSetting label="Show favicons" checked={showFavicons} onChange={setShowFavicons} />
        <ToggleSetting label="Cluster by domain" checked={clusterByDomain} onChange={setClusterByDomain} />
      </div>

      <div className="h-px" style={{ background: 'var(--sg-border-subtle)' }} />

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sg-text-ghost)' }}>Keyboard Shortcuts</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between" style={{ color: 'var(--sg-text-tertiary)' }}>
            <span>Open graph</span>
            <kbd className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'var(--sg-surface-3)', color: 'var(--sg-text-ghost)' }}>Alt+G</kbd>
          </div>
          <div className="flex justify-between" style={{ color: 'var(--sg-text-tertiary)' }}>
            <span>Fit view</span>
            <kbd className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'var(--sg-surface-3)', color: 'var(--sg-text-ghost)' }}>F</kbd>
          </div>
          <div className="flex justify-between" style={{ color: 'var(--sg-text-tertiary)' }}>
            <span>Reset view</span>
            <kbd className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'var(--sg-surface-3)', color: 'var(--sg-text-ghost)' }}>R</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSetting({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium" style={{ color: 'var(--sg-text-secondary)' }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full transition-all relative"
        style={{
          background: checked ? 'var(--sg-cyan)' : 'var(--sg-surface-3)',
          boxShadow: checked ? '0 0 10px rgba(34, 211, 238, 0.3)' : 'none',
        }}
      >
        <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform", checked ? "left-5" : "left-0.5")} />
      </button>
    </label>
  );
}
