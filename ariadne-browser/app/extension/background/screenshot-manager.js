/**
 * Screenshot Manager
 * 
 * Handles capturing tab screenshots using Chrome's captureVisibleTab API.
 * Optimizes images for storage and display.
 */

export class ScreenshotManager {
  constructor() {
    this.maxWidth = 400; // Max width for node thumbnails
    this.maxHeight = 300; // Max height for node thumbnails
    this.quality = 0.7; // JPEG quality (0-1)
  }

  /**
   * Capture a screenshot of a specific tab
   * @param {number} tabId - The tab ID to capture
   * @returns {Promise<string|null>} - Base64 encoded screenshot or null
   */
  async captureTab(tabId) {
    try {
      // Check if tab exists and is accessible
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) {
        return null;
      }

      // Skip certain URL types
      if (this.shouldSkipUrl(tab.url)) {
        return null;
      }

      // Capture the visible area
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: this.quality
      });

      // Resize and optimize the image
      const optimizedDataUrl = await this.optimizeImage(dataUrl);
      
      return optimizedDataUrl;
    } catch (error) {
      console.warn('[ScreenshotManager] Failed to capture tab:', tabId, error.message);
      return null;
    }
  }

  /**
   * Capture the current active tab
   * @returns {Promise<string|null>} - Base64 encoded screenshot or null
   */
  async captureActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        return null;
      }

      return await this.captureTab(tabs[0].id);
    } catch (error) {
      console.warn('[ScreenshotManager] Failed to capture active tab:', error.message);
      return null;
    }
  }

  /**
   * Check if URL should be skipped (chrome://, about:, etc.)
   * @param {string} url - The URL to check
   * @returns {boolean} - True if should skip
   */
  shouldSkipUrl(url) {
    if (!url) return true;
    
    const skipPrefixes = [
      'chrome://',
      'chrome-extension://',
      'about:',
      'data:',
      'file:',
      'javascript:',
      'blob:',
      'devtools://'
    ];

    return skipPrefixes.some(prefix => url.startsWith(prefix));
  }

  /**
   * Optimize image by resizing and compressing
   * @param {string} dataUrl - Original base64 image
   * @returns {Promise<string>} - Optimized base64 image
   */
  async optimizeImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        
        if (width > this.maxWidth) {
          height = (height * this.maxWidth) / width;
          width = this.maxWidth;
        }
        
        if (height > this.maxHeight) {
          width = (width * this.maxHeight) / height;
          height = this.maxHeight;
        }

        // Create canvas for resizing
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Draw and resize
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.convertToBlob({
          type: 'image/jpeg',
          quality: this.quality
        }).then(blob => {
          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }).catch(reject);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Get a placeholder image for nodes without screenshots
   * @param {string} title - Page title for generating placeholder
   * @returns {string} - Data URL for placeholder
   */
  getPlaceholder(title = '') {
    // Generate a colored placeholder based on title hash
    const hash = this.hashString(title || 'Ariadne');
    const hue = Math.abs(hash % 360);
    const color1 = `hsl(${hue}, 70%, 60%)`;
    const color2 = `hsl(${(hue + 30) % 360}, 70%, 50%)`;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#grad)"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" 
              fill="white" text-anchor="middle" dominant-baseline="middle">
          ${this.escapeXml(title.substring(0, 30) || 'New Tab')}
        </text>
      </svg>
    `;

    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  /**
   * Simple string hash function
   * @param {string} str - String to hash
   * @returns {number} - Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Escape XML special characters
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Clear old screenshots to free up storage
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} - Number of screenshots cleared
   */
  async clearOldScreenshots(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    const cutoff = Date.now() - maxAge;
    // This would be implemented if we stored screenshots separately
    // Currently screenshots are stored with node data
    return 0;
  }
}
