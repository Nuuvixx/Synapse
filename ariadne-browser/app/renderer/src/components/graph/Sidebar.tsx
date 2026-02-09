/**
 * Sidebar Component
 * 
 * Shows sessions, saved trees, and navigation.
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
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            className="fixed left-0 top-8 bottom-0 w-80 bg-slate-900 border-r border-slate-800 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                  <span className="text-xl">🧭</span>
                </div>
                <div>
                  <h1 className="font-bold text-slate-100">Ariadne</h1>
                  <p className="text-xs text-slate-500">Spatial Web Browser</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800">
              <TabButton
                active={activeTab === 'sessions'}
                onClick={() => setActiveTab('sessions')}
                icon={<History className="w-4 h-4" />}
                label="Sessions"
              />
              <TabButton
                active={activeTab === 'trees'}
                onClick={() => setActiveTab('trees')}
                icon={<Bookmark className="w-4 h-4" />}
                label="Trees"
              />
              <TabButton
                active={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
                icon={<Settings className="w-4 h-4" />}
                label="Settings"
              />
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

// Tab Button Component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors",
        active
          ? "text-cyan-400 border-b-2 border-cyan-400"
          : "text-slate-400 hover:text-slate-200"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// Sessions Tab
function SessionsTab({ searchQuery }: { searchQuery: string }) {
  const sessions = useGraphStore(state => state.sessions);
  const currentSessionId = useGraphStore(state => state.currentSessionId);
  const switchSession = useGraphStore(state => state.switchSession);
  const createSession = useGraphStore(state => state.createSession);
  const deleteSession = useGraphStore(state => state.deleteSession);

  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const filteredSessions = sessions.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateSession = () => {
    const name = prompt('Enter session name:');
    if (name) {
      createSession(name);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleCreateSession}
        className="w-full flex items-center gap-2 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors text-sm"
      >
        <Plus className="w-4 h-4" />
        New Session
      </button>

      {filteredSessions.map(session => (
        <div
          key={session.id}
          className={cn(
            "rounded-lg border transition-all overflow-hidden",
            session.id === currentSessionId
              ? "border-cyan-500/50 bg-cyan-500/10"
              : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
          )}
        >
          <div
            className="flex items-center justify-between p-3 cursor-pointer"
            onClick={() => setExpandedSession(
              expandedSession === session.id ? null : session.id
            )}
          >
            <div className="flex items-center gap-2">
              {expandedSession === session.id ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
              <span className="text-sm text-slate-200">{session.name}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{formatTime(session.updatedAt)}</span>
              {session.id === currentSessionId && (
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
              )}
            </div>
          </div>

          {expandedSession === session.id && (
            <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-3">
                <div>
                  <span className="text-slate-400">{session.nodeCount}</span> pages
                </div>
                <div>
                  <span className="text-slate-400">{session.edgeCount}</span> links
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => switchSession(session.id)}
                  className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition-colors"
                >
                  Switch
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this session?')) {
                      deleteSession(session.id);
                    }
                  }}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Trees Tab
function TreesTab({ searchQuery }: { searchQuery: string }) {
  const savedTrees = useGraphStore(state => state.savedTrees);
  const loadTree = useGraphStore(state => state.loadTree);
  const deleteTree = useGraphStore(state => state.deleteTree);

  const filteredTrees = savedTrees.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-2">
      {filteredTrees.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No saved trees yet</p>
          <p className="text-xs mt-1">Select nodes and save them as a tree</p>
        </div>
      ) : (
        filteredTrees.map(tree => (
          <div
            key={tree.id}
            className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
          >
            <div>
              <p className="text-sm text-slate-200">{tree.name}</p>
              <p className="text-xs text-slate-500">
                {tree.nodeCount} pages • {formatTime(tree.createdAt)}
              </p>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => loadTree(tree.id)}
                className="p-2 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-lg transition-colors"
                title="Load tree"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this saved tree?')) {
                    deleteTree(tree.id);
                  }
                }}
                className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                title="Delete tree"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Settings Tab
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
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          View Options
        </h3>

        <ToggleSetting
          label="Dim closed tabs"
          checked={dimClosedNodes}
          onChange={setDimClosedNodes}
        />

        <ToggleSetting
          label="Show thumbnails"
          checked={showThumbnails}
          onChange={setShowThumbnails}
        />

        <ToggleSetting
          label="Show favicons"
          checked={showFavicons}
          onChange={setShowFavicons}
        />

        <ToggleSetting
          label="Cluster by domain"
          checked={clusterByDomain}
          onChange={setClusterByDomain}
        />
      </div>

      <div className="h-px bg-slate-800" />

      <div className="space-y-3">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Keyboard Shortcuts
        </h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Open graph</span>
            <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-500">Alt+G</kbd>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Fit view</span>
            <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-500">F</kbd>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Reset view</span>
            <kbd className="px-2 py-0.5 bg-slate-800 rounded text-slate-500">R</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toggle Setting Component
interface ToggleSettingProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSetting({ label, checked, onChange }: ToggleSettingProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "w-10 h-5 rounded-full transition-colors relative",
          checked ? "bg-cyan-500" : "bg-slate-700"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform",
            checked ? "left-5" : "left-0.5"
          )}
        />
      </button>
    </label>
  );
}
