/**
 * Node Card Component
 * 
 * Renders a single node in the graph with:
 * - Screenshot thumbnail (if available)
 * - Favicon
 * - Page title
 * - Status indicators
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
  
  // Get domain from URL for placeholder
  const getDomain = useCallback((url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }, []);
  
  // Get placeholder color based on domain
  const getPlaceholderColor = useCallback((domain: string) => {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
      'from-cyan-500 to-blue-600',
      'from-violet-500 to-indigo-600'
    ];
    const hash = domain.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }, []);
  
  const domain = getDomain(node.url);
  const placeholderGradient = getPlaceholderColor(domain);
  
  // Truncate title
  const truncatedTitle = node.title.length > 40
    ? node.title.substring(0, 40) + '...'
    : node.title;
  
  return (
    <motion.div
      className={`
        relative rounded-xl overflow-hidden cursor-pointer
        transition-all duration-200 ease-out
        ${selected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''}
        ${shouldDim ? 'opacity-40 grayscale' : 'opacity-100'}
      `}
      style={{
        width: 200,
        minHeight: showThumbnails && node.screenshot && !imageError ? 150 : 60,
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        boxShadow: selected
          ? '0 0 30px rgba(34, 211, 238, 0.4)'
          : isHovered
          ? '0 10px 40px rgba(0, 0, 0, 0.4)'
          : '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
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
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        </div>
      )}
      
      {/* Placeholder when no screenshot */}
      {(!showThumbnails || !node.screenshot || imageError) && (
        <div className={`w-full h-16 bg-gradient-to-br ${placeholderGradient} flex items-center justify-center`}>
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
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          
          {/* Title */}
          <p className="text-xs text-slate-200 leading-tight line-clamp-2 flex-1">
            {truncatedTitle}
          </p>
        </div>
        
        {/* URL hint */}
        <p className="text-[10px] text-slate-500 mt-1 truncate">
          {domain}
        </p>
      </div>
      
      {/* Status indicators */}
      <div className="absolute top-2 right-2 flex gap-1">
        {isClosed && (
          <span className="w-2 h-2 rounded-full bg-slate-500" title="Closed" />
        )}
        {node.status === 'active' && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active" />
        )}
      </div>
      
      {/* Hover overlay with actions */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-slate-900/80 flex items-center justify-center gap-2"
        >
          <button
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-xs rounded-lg transition-colors"
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
