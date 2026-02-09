/**
 * Node Detail Panel Component
 * 
 * Shows detailed information about a selected node:
 * - Full page info
 * - Screenshot preview
 * - Actions (focus, reopen, delete)
 * - Metadata
 */

import { motion } from 'framer-motion';
import { X, ExternalLink, RotateCcw, Trash2, Clock, Link2, Hash } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import type { GraphNode } from '@/types';
import { cn } from '@/lib/utils';

interface NodeDetailPanelProps {
  node: GraphNode;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const focusNode = useGraphStore(state => state.focusNode);
  const reopenNode = useGraphStore(state => state.reopenNode);
  const deleteNode = useGraphStore(state => state.deleteNode);
  
  const isClosed = node.status === 'closed';
  
  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get domain from URL
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };
  
  // Get URL path
  const getPath = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return '';
    }
  };
  
  const handleFocus = async () => {
    await focusNode(node.id);
  };
  
  const handleReopen = async () => {
    await reopenNode(node.id);
  };
  
  const handleDelete = async () => {
    if (confirm('Are you sure you want to remove this node from the graph?')) {
      await deleteNode(node.id);
      onClose();
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="text-sm font-medium text-slate-200 truncate pr-4">
          Page Details
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Screenshot Preview */}
      {node.screenshot && (
        <div className="relative h-40 bg-slate-900 overflow-hidden">
          <img
            src={node.screenshot}
            alt={node.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800 to-transparent" />
        </div>
      )}
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <h4 className="text-lg font-semibold text-slate-100 leading-tight">
            {node.title}
          </h4>
        </div>
        
        {/* URL */}
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            {node.favicon && (
              <img
                src={node.favicon}
                alt=""
                className="w-4 h-4 mt-0.5 flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs text-cyan-400 truncate">
                {getDomain(node.url)}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {getPath(node.url)}
              </p>
            </div>
          </div>
        </div>
        
        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-4 h-4" />
            <span>Opened: {formatTime(node.timestamp)}</span>
          </div>
          
          {node.closedAt && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <X className="w-4 h-4" />
              <span>Closed: {formatTime(node.closedAt)}</span>
            </div>
          )}
          
          {node.parentId && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link2 className="w-4 h-4" />
              <span>Opened from another tab</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Hash className="w-4 h-4" />
            <span className="font-mono">{node.id}</span>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              isClosed
                ? "bg-slate-700 text-slate-400"
                : "bg-emerald-500/20 text-emerald-400"
            )}
          >
            {isClosed ? 'Closed' : 'Active'}
          </span>
          
          {node.userPositioned && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
              Positioned
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {isClosed ? (
            <button
              onClick={handleReopen}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reopen Tab
            </button>
          ) : (
            <button
              onClick={handleFocus}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Focus Tab
            </button>
          )}
          
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        
        {/* Open in new tab */}
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs text-slate-500 hover:text-cyan-400 transition-colors"
        >
          Open in new tab →
        </a>
      </div>
    </motion.div>
  );
}
