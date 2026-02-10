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
      className="relative rounded-[24px] overflow-hidden cursor-pointer group"
      style={{
        width: 180,
        height: 54,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: selected
          ? '1.5px solid var(--sg-cyan)'
          : isHovered
            ? '1.5px solid var(--sg-cyan)'
            : '1.5px solid rgba(148, 163, 184, 0.2)',
        boxShadow: selected
          ? '0 0 20px rgba(34, 211, 238, 0.4)'
          : isHovered
            ? '0 0 15px rgba(34, 211, 238, 0.2)'
            : '0 4px 12px rgba(0, 0, 0, 0.3)',
        opacity: shouldDim ? 0.5 : 1,
        filter: shouldDim ? 'grayscale(0.8)' : 'none',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Progress Bar / Activity Indicator (Bottom Line) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background: node.status === 'active'
            ? 'linear-gradient(90deg, transparent, var(--sg-cyan), transparent)'
            : 'transparent'
        }}
      />

      <div className="flex items-center h-full px-3 gap-3">
        {/* Icon Container (Orb) */}
        <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-800/80 border border-white/10 shadow-inner group-hover:border-cyan-500/50 transition-colors">
          {showFavicons && node.favicon && !imageError ? (
            <img
              src={node.favicon}
              className="w-4 h-4 rounded-sm"
              onError={() => setImageError(true)}
              alt=""
            />
          ) : (
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: placeholderGradient }}
            />
          )}

          {/* Status Dot */}
          {node.status === 'active' && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-500 border-2 border-slate-900 animate-pulse" />
          )}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4 className="text-[12px] font-semibold text-slate-200 truncate leading-tight group-hover:text-cyan-100 transition-colors">
            {truncatedTitle}
          </h4>
          <p className="text-[9px] text-slate-500 truncate font-mono mt-0.5 group-hover:text-slate-400">
            {domain}
          </p>
        </div>
      </div>
    </motion.div>
  );
});
