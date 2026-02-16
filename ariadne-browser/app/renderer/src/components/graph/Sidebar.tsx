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
import { cn } from '@/lib/utils';
import { useSynapseClient } from '@/services/SynapseClient';
import { useGraphStore } from '@/store/graphStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'sessions' | 'trees' | 'settings';

import { v4 as uuidv4 } from 'uuid';

export function Sidebar({ isOpen, onClose: _onClose }: SidebarProps) {
  const sidebarOpen = useGraphStore(state => state.sidebarOpen);
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Synapse Client
  const { isConnected, connect, capturePage } = useSynapseClient();

  // Auto-connect on mount
  useState(() => {
    connect();
  });

  const toggleSession = async () => {
    if (activeSessionId) {
      // Stop Session
      await window.api.tab.setSession(null);
      setActiveSessionId(null);
    } else {
      // Start Session
      const newId = uuidv4();
      await window.api.tab.setSession(newId);
      setActiveSessionId(newId);

      // Initial capture to create the note
      if (isConnected) {
        capturePage({
          title: `Research Session: ${new Date().toLocaleString()}`,
          url: window.location.href,
          content: `### Session Started\nTopic: General Research`,
          favicon: ''
        });
      }
    }
  };

  const handleCapture = () => {
    if (isConnected) {
      capturePage({
        title: document.title || 'Unknown Page',
        url: window.location.href, // This might be the app URL, not the browser view URL. We need the active tab info.
        content: 'Snapshot taken from Ariadne', // Placeholder
        favicon: ''
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => useGraphStore.getState().setSidebarOpen(false)}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(2, 6, 23, 0.6)', backdropFilter: 'blur(4px)' }}
          />

          {/* Sidebar - Floating Command Module */}
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{
              x: sidebarOpen ? 0 : -320,
              opacity: sidebarOpen ? 1 : 0
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-2 top-10 bottom-2 w-80 z-40 flex flex-col rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl"
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05)'
            }}
          >
            {/* Header & Branding */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-50" />

              <div className="flex items-center gap-3 relative z-10">
                <div
                  className="w-2 h-2 rounded-full animate-pulse transition-colors duration-500"
                  style={{
                    background: isConnected ? 'var(--sg-success)' : 'var(--sg-error)',
                    boxShadow: isConnected ? '0 0 10px var(--sg-success)' : 'none'
                  }}
                  title={isConnected ? "Synapse Linked" : "Neural Link Severed"}
                />
                <h1 className="font-mono text-xs font-bold tracking-[0.2em] text-cyan-100/80">
                  ARIADNE <span className="text-cyan-400">//</span> SPATIAL
                </h1>
              </div>

              <div className="flex items-center gap-2 relative z-10">
                {/* Session Toggle */}
                <button
                  onClick={toggleSession}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                    activeSessionId ? "bg-red-500/20 text-red-400 border border-red-500/50" : "hover:bg-white/10 text-slate-400"
                  )}
                  title={activeSessionId ? "Stop Recording Session" : "Start Research Session"}
                >
                  {activeSessionId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                  )}
                  {activeSessionId ? "REC" : "REC"}
                </button>

                {/* Capture Button */}
                <button
                  onClick={handleCapture}
                  disabled={!isConnected}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors disabled:opacity-30"
                  title="Capture Verification"
                >
                  <div className="w-3 h-3 border border-current rounded-sm" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 pb-2">
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

            {/* Segmented Control Tabs */}
            <div className="px-4 pb-0">
              <div className="flex p-1 rounded-xl" style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <SidebarTab active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} icon={<History className="w-3.5 h-3.5" />} label="Sessions" />
                <SidebarTab active={activeTab === 'trees'} onClick={() => setActiveTab('trees')} icon={<Bookmark className="w-3.5 h-3.5" />} label="Trees" />
                <SidebarTab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings className="w-3.5 h-3.5" />} label="Config" />
              </div>
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
      className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition-all relative"
      style={{
        color: active ? 'var(--sg-text-primary)' : 'var(--sg-text-tertiary)',
      }}
    >
      {active && (
        <motion.div
          layoutId="sidebarTabBg"
          className="absolute inset-0 rounded-lg shadow-sm"
          style={{ background: 'var(--sg-surface-3)' }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {label}
      </span>
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
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const filteredSessions = sessions.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateSession = async () => {
    if (newSessionName.trim()) {
      await createSession(newSessionName);
      setNewSessionName('');
      setIsCreating(false);
    }
  };

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-3">
      {!isCreating ? (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all group"
          style={{
            background: 'rgba(34, 211, 238, 0.1)',
            border: '1px solid rgba(34, 211, 238, 0.2)',
            color: 'var(--sg-cyan)',
          }}
        >
          <span className="p-1 rounded-md bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors">
            <Plus className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">New Session</span>
        </button>
      ) : (
        <div className="p-3 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2"
          style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--sg-cyan)' }}>
          <input
            autoFocus
            type="text"
            placeholder="Session Name..."
            value={newSessionName}
            onChange={e => setNewSessionName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateSession();
              if (e.key === 'Escape') setIsCreating(false);
            }}
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-600"
            style={{ color: 'var(--sg-text-primary)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateSession}
              disabled={!newSessionName.trim()}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredSessions.map(session => (
          <div
            key={session.id}
            className="rounded-xl overflow-hidden transition-all duration-300 group"
            style={{
              border: session.id === currentSessionId
                ? '1px solid var(--sg-cyan)'
                : '1px solid rgba(255, 255, 255, 0.05)',
              background: session.id === currentSessionId
                ? 'rgba(34, 211, 238, 0.05)'
                : 'rgba(15, 23, 42, 0.4)',
              boxShadow: session.id === currentSessionId
                ? '0 0 15px rgba(34, 211, 238, 0.15)'
                : 'none',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  {session.id === currentSessionId && (
                    <motion.div
                      layoutId="activeSessionDot"
                      className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-cyan-500 shadow-[0_0_10px_var(--sg-cyan)]"
                    />
                  )}
                  {expandedSession === session.id ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium leading-none" style={{ color: 'var(--sg-text-primary)' }}>{session.name}</h4>
                  <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--sg-text-tertiary)' }}>
                    {formatTime(session.updatedAt)}
                  </p>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {expandedSession === session.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 pb-3"
                >
                  <div className="grid grid-cols-2 gap-2 mb-3 p-2 rounded-lg bg-black/20">
                    <div className="text-center">
                      <span className="block text-xs font-bold text-slate-300">{session.nodeCount}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500">Pages</span>
                    </div>
                    <div className="text-center border-l border-white/5">
                      <span className="block text-xs font-bold text-purple-400">{session.edgeCount}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500">Links</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => switchSession(session.id)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
                      style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--sg-text-secondary)' }}
                    >
                      Load Matrix
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this session?')) deleteSession(session.id); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-rose-500/20 hover:text-rose-300"
                      style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--sg-text-tertiary)' }}
                    >
                      Purge
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
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
        <div className="text-center py-12 rounded-xl border border-dashed border-slate-700/50">
          <FolderTree className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">No saved forests</p>
          <p className="text-[10px] text-slate-600 mt-1">Select nodes → Save Tree</p>
        </div>
      ) : (
        filteredTrees.map(tree => (
          <div
            key={tree.id}
            className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-white/5 group"
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <div>
              <p className="text-sm font-medium text-slate-200 group-hover:text-purple-300 transition-colors">{tree.name}</p>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                {tree.nodeCount} LOCI • {formatTime(tree.createdAt)}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => loadTree(tree.id)} className="p-1.5 rounded-lg hover:bg-purple-500/20 hover:text-purple-300 text-slate-500 transition-colors" title="Load tree">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => { if (confirm('Delete?')) deleteTree(tree.id); }} className="p-1.5 rounded-lg hover:bg-rose-500/20 hover:text-rose-300 text-slate-500 transition-colors" title="Delete">
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
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pl-1">Visual Matrix</h3>
        <div className="space-y-1">
          <ToggleSetting label="Dim inactive nodes" checked={dimClosedNodes} onChange={setDimClosedNodes} />
          <ToggleSetting label="Holographic thumbnails" checked={showThumbnails} onChange={setShowThumbnails} />
          <ToggleSetting label="Source favicons" checked={showFavicons} onChange={setShowFavicons} />
          <ToggleSetting label="Cluster by origin" checked={clusterByDomain} onChange={setClusterByDomain} />
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pl-1">Neural Links</h3>
        <div className="space-y-2">
          <ShortcutRow label="Quick Access" keys={['Alt', 'G']} />
          <ShortcutRow label="Fit Universe" keys={['F']} />
          <ShortcutRow label="Reset Viewport" keys={['R']} />
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ label, keys }: { label: string, keys: string[] }) {
  return (
    <div className="flex justify-between items-center px-1">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex gap-1">
        {keys.map(k => (
          <kbd key={k} className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 shadow-sm">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function ToggleSetting({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors group">
      <span className="text-sm font-medium text-slate-300 group-hover:text-slate-200">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className="w-9 h-5 rounded-full transition-all relative"
        style={{
          background: checked ? 'var(--sg-cyan)' : 'rgba(255, 255, 255, 0.1)',
          boxShadow: checked ? '0 0 10px rgba(34, 211, 238, 0.4)' : 'none',
        }}
      >
        <span className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-transform", checked ? "left-5" : "left-1")} />
      </button>
    </label>
  );
}
