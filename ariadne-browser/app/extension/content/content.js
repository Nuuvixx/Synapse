/**
 * Ariadne Content Script
 * 
 * Injected into all web pages to:
 * - Detect page metadata (title, description, keywords)
 * - Track user interactions (clicks, scroll)
 * - Communicate with background script
 */

(function() {
  'use strict';

  console.log('[Ariadne] Content script loaded on:', window.location.href);

  // Extract page metadata
  function extractMetadata() {
    const getMeta = (name) => {
      const meta = document.querySelector(`meta[name="${name}"], meta[property="og:${name}"], meta[property="twitter:${name}"]`);
      return meta ? meta.getAttribute('content') : null;
    };

    return {
      url: window.location.href,
      title: document.title,
      description: getMeta('description'),
      keywords: getMeta('keywords'),
      author: getMeta('author'),
      siteName: getMeta('site_name'),
      image: getMeta('image'),
      type: getMeta('type') || 'website',
      timestamp: Date.now()
    };
  }

  // Send metadata to background script
  function sendMetadata() {
    const metadata = extractMetadata();
    
    chrome.runtime.sendMessage({
      action: 'pageMetadata',
      data: metadata
    }).catch(() => {
      // Extension might not be available
    });
  }

  // Track link clicks for relationship building
  function trackClicks() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.href) {
        // Send click event to background
        chrome.runtime.sendMessage({
          action: 'linkClicked',
          data: {
            fromUrl: window.location.href,
            toUrl: link.href,
            linkText: link.textContent.trim(),
            timestamp: Date.now()
          }
        }).catch(() => {
          // Extension might not be available
        });
      }
    }, true);
  }

  // Notify when page is fully loaded
  function onPageLoad() {
    sendMetadata();
    
    // Send page load complete event
    chrome.runtime.sendMessage({
      action: 'pageLoaded',
      data: {
        url: window.location.href,
        title: document.title,
        loadTime: performance.now(),
        timestamp: Date.now()
      }
    }).catch(() => {
      // Extension might not be available
    });
  }

  // Initialize
  function init() {
    // Send metadata immediately
    sendMetadata();
    
    // Track clicks
    trackClicks();
    
    // Wait for page to fully load
    if (document.readyState === 'complete') {
      onPageLoad();
    } else {
      window.addEventListener('load', onPageLoad);
    }

    // Handle SPA navigation (history API)
    let lastUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        
        // New page navigation detected
        setTimeout(() => {
          sendMetadata();
          onPageLoad();
        }, 500);
      }
    });

    observer.observe(document, { subtree: true, childList: true });

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        sendMetadata();
        onPageLoad();
      }, 100);
    });
  }

  // Start
  init();
})();
