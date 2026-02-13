export class FABManager {
    private shadowHost: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private button: HTMLElement | null = null;
    private isVisible = false;
    private selectionTimeout: NodeJS.Timeout | null = null;

    constructor() {
        this.init();
    }

    private init() {
        // Create Shadow DOM host
        this.shadowHost = document.createElement('div');
        this.shadowHost.id = 'synapse-fab-host';
        this.shadowHost.style.position = 'absolute';
        this.shadowHost.style.top = '0';
        this.shadowHost.style.left = '0';
        this.shadowHost.style.width = '0';
        this.shadowHost.style.height = '0';
        this.shadowHost.style.zIndex = '2147483647'; // Max z-index
        this.shadowHost.style.pointerEvents = 'none'; // Don't block clicks elsewhere

        document.body.appendChild(this.shadowHost);
        this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });

        // Create Button
        this.button = document.createElement('button');
        this.button.innerText = '⚡ Capture';
        this.button.style.position = 'absolute';
        this.button.style.display = 'none';
        this.button.style.background = '#8b5cf6'; // Violet-500
        this.button.style.color = 'white';
        this.button.style.border = 'none';
        this.button.style.padding = '6px 12px';
        this.button.style.borderRadius = '20px';
        this.button.style.cursor = 'pointer';
        this.button.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        this.button.style.fontSize = '12px';
        this.button.style.fontWeight = '600';
        this.button.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        this.button.style.transition = 'opacity 0.2s, transform 0.2s';
        this.button.style.pointerEvents = 'auto'; // Re-enable clicks
        this.button.style.zIndex = '2147483647';

        // Hover effect
        this.button.onmouseenter = () => {
            this.button!.style.transform = 'scale(1.05)';
            this.button!.style.background = '#7c3aed'; // Violet-600
        };
        this.button.onmouseleave = () => {
            this.button!.style.transform = 'scale(1)';
            this.button!.style.background = '#8b5cf6';
        };

        // Click handler
        this.button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.capture();
        };

        this.shadowRoot.appendChild(this.button);

        // Listen for selection changes
        document.addEventListener('selectionchange', () => {
            if (this.selectionTimeout) clearTimeout(this.selectionTimeout);
            this.selectionTimeout = setTimeout(() => this.handleSelection(), 200);
        });

        // Hide on scroll/resize
        window.addEventListener('scroll', () => this.hide(), { passive: true });
        window.addEventListener('resize', () => this.hide(), { passive: true });
        document.addEventListener('mousedown', (e) => {
            // If clicking outside button, hide
            // Since button is in shadow dom, e.target is likely in light dom
            this.hide();
        });
    }

    private handleSelection() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
            this.hide();
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Calculate position (above the selection)
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

        const top = rect.top + scrollTop - 40; // 40px above
        const left = rect.left + scrollLeft + (rect.width / 2) - 40; // Centered-ish

        this.show(left, top);
    }

    private show(x: number, y: number) {
        if (!this.button) return;

        // Ensure within viewport
        const safeX = Math.max(10, Math.min(window.innerWidth - 80, x));
        const safeY = Math.max(10, Math.min(window.innerHeight - 40, y));

        this.button.style.left = `${safeX}px`;
        this.button.style.top = `${safeY}px`;
        this.button.style.display = 'block';

        // Animation
        this.button.style.opacity = '0';
        this.button.style.transform = 'translateY(5px)';
        requestAnimationFrame(() => {
            if (this.button) {
                this.button.style.opacity = '1';
                this.button.style.transform = 'translateY(0)';
            }
        });

        this.isVisible = true;
    }

    private hide() {
        if (!this.isVisible || !this.button) return;

        this.button.style.opacity = '0';
        this.button.style.transform = 'translateY(5px)';

        setTimeout(() => {
            if (this.button) this.button.style.display = 'none';
        }, 200);

        this.isVisible = false;
    }

    private capture() {
        // Trigger capture via exposed API
        // We assume 'window.api' exists and has a method provided by preload
        // Or we can define a custom event handling mechanism
        // But since this IS the preload code running, we can call the extraction logic directly?
        // No, preload code runs in isolated context if 'contextIsolation' is true.
        // Wait, ContentExtractor and FABManager are both classes in preload.
        // So I can pass a callback or specific function.

        // Dispatch event that preload/index.ts listens to?
        // Or better: FABManager accepts a 'onCapture' callback in constructor.

        console.log('[FAB] Capture clicked');
        const event = new CustomEvent('synapse-capture-trigger');
        window.dispatchEvent(event);

        this.hide();
        window.getSelection()?.removeAllRanges(); // Clear selection feedback
    }
}
