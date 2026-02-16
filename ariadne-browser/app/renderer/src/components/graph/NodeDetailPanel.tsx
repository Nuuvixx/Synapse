/**
 * Node Detail Panel Component — Stitch & Glass Design
 * 
 * Glassmorphism detail panel with glowing accents,
 * refined metadata display, and neon action buttons.
 */

import { motion } from 'framer-motion';
import { X, ExternalLink, RotateCcw, Trash2, Clock, Link2, Hash } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import type { GraphNode } from '@/types';

interface NodeDetailPanelProps {
  node: GraphNode;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const focusNode = useGraphStore(state => state.focusNode);
  const reopenNode = useGraphStore(state => state.reopenNode);
  const deleteNode = useGraphStore(state => state.deleteNode);

  const isClosed = node.status === 'closed';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDomain = (url: string) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  const getPath = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch { return ''; }
  };

  const handleFocus = async () => { await focusNode(node.id); };
  const handleReopen = async () => { await reopenNode(node.id); };
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
      className="w-80 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--sg-glass-border)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 40px rgba(168, 85, 247, 0.1)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--sg-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--sg-text-primary)' }}>
          Page Details
        </h3>
        <button onClick={onClose} className="transition-colors" style={{ color: 'var(--sg-text-tertiary)' }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Screenshot Preview */}
      {node.screenshot && (
        <div className="relative h-40 overflow-hidden" style={{ background: 'var(--sg-bg-deep)' }}>
          <img src={node.screenshot} alt={node.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--sg-surface-1) 0%, transparent 60%)' }} />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <h4 className="text-lg font-bold leading-tight" style={{ color: 'var(--sg-text-primary)' }}>
          {node.title}
        </h4>

        {/* URL */}
        <div className="rounded-xl p-3" style={{ background: 'var(--sg-surface-2)', border: '1px solid var(--sg-border-subtle)' }}>
          <div className="flex items-start gap-2">
            {node.favicon && <img src={node.favicon} alt="" className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-sm" />}
            <div className="min-w-0">
              <p className="text-xs truncate font-medium" style={{ color: 'var(--sg-cyan)' }}>{getDomain(node.url)}</p>
              <p className="text-xs truncate" style={{ color: 'var(--sg-text-ghost)' }}>{getPath(node.url)}</p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--sg-text-tertiary)' }}>
            <Clock className="w-4 h-4" />
            <span>Opened: {formatTime(node.timestamp)}</span>
          </div>
          {node.closedAt && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--sg-text-tertiary)' }}>
              <X className="w-4 h-4" />
              <span>Closed: {formatTime(node.closedAt)}</span>
            </div>
          )}
          {node.parentId && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--sg-text-tertiary)' }}>
              <Link2 className="w-4 h-4" />
              <span>Opened from another tab</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--sg-text-ghost)' }}>
            <Hash className="w-4 h-4" />
            <span className="font-mono">{node.id}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: isClosed ? 'var(--sg-surface-3)' : 'rgba(52, 211, 153, 0.15)',
              color: isClosed ? 'var(--sg-text-tertiary)' : 'var(--sg-emerald)',
              border: isClosed ? 'none' : '1px solid rgba(52, 211, 153, 0.2)',
            }}
          >
            {isClosed ? 'Closed' : 'Active'}
          </span>
          {node.userPositioned && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                color: 'var(--sg-purple)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
              }}
            >
              Positioned
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {isClosed ? (
            <button
              onClick={handleReopen}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--sg-cyan)',
                color: '#020617',
                boxShadow: '0 0 16px rgba(34, 211, 238, 0.25)',
              }}
            >
              <RotateCcw className="w-4 h-4" /> Reopen Tab
            </button>
          ) : (
            <button
              onClick={handleFocus}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--sg-cyan)',
                color: '#020617',
                boxShadow: '0 0 16px rgba(34, 211, 238, 0.25)',
              }}
            >
              <ExternalLink className="w-4 h-4" /> Focus Tab
            </button>
          )}

          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl transition-all"
            style={{
              background: 'rgba(251, 113, 133, 0.1)',
              color: 'var(--sg-rose)',
              border: '1px solid rgba(251, 113, 133, 0.15)',
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Open in new tab */}
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs transition-colors"
          style={{ color: 'var(--sg-text-ghost)' }}
        >
          Open in new tab →
        </a>
      </div>
    </motion.div>
  );
}
