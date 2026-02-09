/**
 * Graph Toolbar Component
 * 
 * Floating toolbar with graph controls:
 * - Fit view
 * - Reset view
 * - Toggle timeline
 * - Toggle minimap
 * - Settings
 * - Export/Import
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize,
  RotateCcw,
  Clock,
  Map,
  Settings,
  Download,
  Upload,
  Trash2,
  MoreHorizontal,
  X,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Globe,
  Zap
} from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { cn } from '@/lib/utils';

interface GraphToolbarProps {
  onFitView: () => void;
  onResetView: () => void;
  onToggleTimeline: () => void;
  onToggleMinimap: () => void;
  onTogglePhysics?: () => void;
  showTimeline: boolean;
  showMinimap: boolean;
  usePhysics?: boolean;
}

export function GraphToolbar({
  onFitView,
  onResetView,
  onToggleTimeline,
  onToggleMinimap,
  onTogglePhysics,
  showTimeline,
  showMinimap,
  usePhysics = true
}: GraphToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Store settings
  const dimClosedNodes = useGraphStore(state => state.dimClosedNodes);
  const showThumbnails = useGraphStore(state => state.showThumbnails);
  const showFavicons = useGraphStore(state => state.showFavicons);
  const clusterByDomain = useGraphStore(state => state.clusterByDomain);

  const setDimClosedNodes = useGraphStore(state => state.setDimClosedNodes);
  const setShowThumbnails = useGraphStore(state => state.setShowThumbnails);
  const setShowFavicons = useGraphStore(state => state.setShowFavicons);
  const setClusterByDomain = useGraphStore(state => state.setClusterByDomain);

  // Actions
  const exportSession = useGraphStore(state => state.exportSession);
  const clearAllData = useGraphStore(state => state.clearAllData);

  const handleExport = () => {
    exportSession();
    setShowMenu(false);
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      await clearAllData();
    }
    setShowMenu(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Main Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-2 flex items-center gap-1 shadow-xl"
      >
        <ToolbarButton
          onClick={onFitView}
          icon={<Maximize className="w-4 h-4" />}
          label="Fit View"
        />

        <ToolbarButton
          onClick={onResetView}
          icon={<RotateCcw className="w-4 h-4" />}
          label="Reset"
        />

        <div className="w-px h-6 bg-slate-700 mx-1" />

        <ToolbarButton
          onClick={onToggleTimeline}
          icon={<Clock className="w-4 h-4" />}
          label="Timeline"
          active={showTimeline}
        />

        <ToolbarButton
          onClick={onToggleMinimap}
          icon={<Map className="w-4 h-4" />}
          label="Minimap"
          active={showMinimap}
        />

        {onTogglePhysics && (
          <ToolbarButton
            onClick={onTogglePhysics}
            icon={<Zap className="w-4 h-4" />}
            label="Physics"
            active={usePhysics}
          />
        )}

        <div className="w-px h-6 bg-slate-700 mx-1" />

        <ToolbarButton
          onClick={() => setShowSettings(!showSettings)}
          icon={<Settings className="w-4 h-4" />}
          label="Settings"
          active={showSettings}
        />

        <ToolbarButton
          onClick={() => setShowMenu(!showMenu)}
          icon={<MoreHorizontal className="w-4 h-4" />}
          label="More"
          active={showMenu}
        />
      </motion.div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl p-4 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-200">View Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <ToggleOption
                label="Dim Closed Tabs"
                checked={dimClosedNodes}
                onChange={setDimClosedNodes}
                icon={dimClosedNodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              />

              <ToggleOption
                label="Show Thumbnails"
                checked={showThumbnails}
                onChange={setShowThumbnails}
                icon={<ImageIcon className="w-4 h-4" />}
              />

              <ToggleOption
                label="Show Favicons"
                checked={showFavicons}
                onChange={setShowFavicons}
                icon={<Globe className="w-4 h-4" />}
              />

              <ToggleOption
                label="Cluster by Domain"
                checked={clusterByDomain}
                onChange={setClusterByDomain}
                icon={<Map className="w-4 h-4" />}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* More Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl p-2 shadow-xl"
          >
            <MenuItem
              onClick={handleExport}
              icon={<Download className="w-4 h-4" />}
              label="Export Session"
            />

            <MenuItem
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const text = await file.text();
                    try {
                      const data = JSON.parse(text);
                      const importSession = useGraphStore.getState().importSession;
                      await importSession(data);
                    } catch (err) {
                      alert('Invalid import file');
                    }
                  }
                };
                input.click();
                setShowMenu(false);
              }}
              icon={<Upload className="w-4 h-4" />}
              label="Import Session"
            />

            <div className="h-px bg-slate-700 my-1" />

            <MenuItem
              onClick={handleClear}
              icon={<Trash2 className="w-4 h-4 text-red-400" />}
              label="Clear All Data"
              danger
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Toolbar Button Component
interface ToolbarButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function ToolbarButton({ onClick, icon, label, active }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all",
        "hover:bg-slate-700 text-slate-400 hover:text-slate-200",
        active && "bg-cyan-500/20 text-cyan-400"
      )}
      title={label}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

// Toggle Option Component
interface ToggleOptionProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: React.ReactNode;
}

function ToggleOption({ label, checked, onChange, icon }: ToggleOptionProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-300">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "w-10 h-5 rounded-full transition-colors relative",
          checked ? "bg-cyan-500" : "bg-slate-600"
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

// Menu Item Component
interface MenuItemProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}

function MenuItem({ onClick, icon, label, danger }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
        danger
          ? "hover:bg-red-500/20 text-slate-300 hover:text-red-400"
          : "hover:bg-slate-700 text-slate-300"
      )}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}
