/**
 * Node Card Component — Stitch & Glass Design
 * 
 * Glassmorphism node cards with glowing borders,
 * neon status indicators, and hover reveal actions.
 */

import { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { GraphNode } from '@/types';
import { useGraphStore } from '@/store/graphStore';

interface NodeCardProps {
  node: GraphNode;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export const NodeCard = memo(function NodeCard({
  node,
  selected,
  onClick,
  onDoubleClick
}: NodeCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const showThumbnails = useGraphStore(state => state.showThumbnails);
  const showFavicons = useGraphStore(state => state.showFavicons);
  const dimClosedNodes = useGraphStore(state => state.dimClosedNodes);

  const isClosed = node.status === 'closed';
  const shouldDim = isClosed && dimClosedNodes;

  const getDomain = useCallback((url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }, []);

  const getPlaceholderGradient = useCallback((domain: string) => {
    const gradients = [
      'linear-gradient(135deg, #0e7490 0%, #7c3aed 100%)',
      'linear-gradient(135deg, #059669 0%, #0891b2 100%)',
      'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
      'linear-gradient(135deg, #0284c7 0%, #6d28d9 100%)',
      'linear-gradient(135deg, #0d9488 0%, #2563eb 100%)',
      'linear-gradient(135deg, #9333ea 0%, #0ea5e9 100%)',
    ];
    const hash = domain.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return gradients[Math.abs(hash) % gradients.length];
  }, []);

  const domain = getDomain(node.url);
  const placeholderGradient = getPlaceholderGradient(domain);

  const truncatedTitle = node.title.length > 40
    ? node.title.substring(0, 40) + '...'
    : node.title;

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 ease-out"
      style={{
        width: 200,
        minHeight: showThumbnails && node.screenshot && !imageError ? 150 : 60,
        background: 'var(--sg-glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: selected
          ? '1.5px solid var(--sg-cyan)'
          : isHovered
            ? '1.5px solid var(--sg-border-glow-cyan)'
            : '1.5px solid var(--sg-glass-border)',
        boxShadow: selected
          ? 'var(--sg-glow-cyan-intense)'
          : isHovered
            ? 'var(--sg-glow-cyan)'
            : 'var(--sg-shadow-md)',
        opacity: shouldDim ? 0.35 : 1,
        filter: shouldDim ? 'grayscale(0.6)' : 'none',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      layout
    >
      {/* Screenshot Thumbnail */}
      {showThumbnails && node.screenshot && !imageError && (
        <div className="relative w-full h-24 overflow-hidden">
          <img
            src={node.screenshot}
            alt={node.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, var(--sg-surface-1) 0%, transparent 60%)' }}
          />
        </div>
      )}

      {/* Placeholder when no screenshot */}
      {(!showThumbnails || !node.screenshot || imageError) && (
        <div
          className="w-full h-16 flex items-center justify-center"
          style={{ background: placeholderGradient }}
        >
          <span className="text-white/80 text-xs font-medium px-2 text-center">
            {domain.substring(0, 20)}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Favicon */}
          {showFavicons && node.favicon && (
            <img
              src={node.favicon}
              alt=""
              className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}

          {/* Title */}
          <p
            className="text-xs leading-tight line-clamp-2 flex-1 font-medium"
            style={{ color: 'var(--sg-text-primary)' }}
          >
            {truncatedTitle}
          </p>
        </div>

        {/* URL hint */}
        <p
          className="text-[10px] mt-1 truncate"
          style={{ color: 'var(--sg-text-ghost)' }}
        >
          {domain}
        </p>
      </div>

      {/* Status indicators */}
      <div className="absolute top-2 right-2 flex gap-1">
        {isClosed && (
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: 'var(--sg-text-ghost)' }}
            title="Closed"
          />
        )}
        {node.status === 'active' && (
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{
              background: 'var(--sg-emerald)',
              boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)',
            }}
            title="Active"
          />
        )}
      </div>

      {/* Hover overlay with actions */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center gap-2"
          style={{
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <button
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: 'var(--sg-cyan)',
              color: '#020617',
              boxShadow: '0 0 16px rgba(34, 211, 238, 0.3)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDoubleClick();
            }}
          >
            {isClosed ? 'Reopen' : 'Focus'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
});
