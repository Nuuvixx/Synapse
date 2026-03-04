
import { TabManager, Tab } from './TabManager';

export class LLMController {
    constructor(private tabManager: TabManager) { }

    async execute(payload: { model: string, prompt: string, context?: string }) {
        console.log('[LLM] Executing for model:', payload.model);

        let targetUrl = '';
        if (payload.model.toLowerCase().includes('chatgpt') || payload.model.toLowerCase().includes('gpt')) {
            targetUrl = 'chatgpt.com';
        } else if (payload.model.toLowerCase().includes('gemini')) {
            targetUrl = 'gemini.google.com';
        } else if (payload.model.toLowerCase().includes('claude')) {
            targetUrl = 'claude.ai';
        }

        if (!targetUrl) {
            console.warn('[LLM] Unknown model provider:', payload.model);
            this.tabManager.sendLLMResponse({
                model: payload.model,
                content: `Error: Unknown model "${payload.model}". Supported: ChatGPT, Gemini, Claude.`
            });
            return;
        }

        // 1. Find Tab
        const existingTabInfo = this.tabManager.findTabByUrl(targetUrl);
        let tab: Tab | undefined;

        if (existingTabInfo) {
            tab = this.tabManager.getTab(existingTabInfo.id);
        }

        // 2. If not found, create tab and wait for load
        if (!tab) {
            console.log('[LLM] Tab not found, opening:', targetUrl);
            const tabInfo = this.tabManager.createTab('https://' + targetUrl);
            tab = this.tabManager.getTab(tabInfo.id);

            if (!tab) {
                console.error('[LLM] Failed to create tab');
                this.tabManager.sendLLMResponse({
                    model: payload.model,
                    content: 'Error: Failed to create browser tab.'
                });
                return;
            }

            // Wait for page to actually finish loading (up to 15s)
            await this.waitForPageLoad(tab, 15000);
        }

        // 3. Activate Tab
        this.tabManager.switchTab(tab.id);

        // 4. Inject Strategy
        try {
            let response = '';
            if (targetUrl.includes('chatgpt')) {
                response = await this.injectChatGPT(tab, payload.prompt, payload.context);
            } else if (targetUrl.includes('gemini')) {
                response = await this.injectGemini(tab, payload.prompt, payload.context);
            } else if (targetUrl.includes('claude')) {
                response = await this.injectClaude(tab, payload.prompt, payload.context);
            }

            console.log('[LLM] Got response, length:', response?.length || 0);

            // 5. Send Result Back via Synapse
            if (response && response.length > 0) {
                this.tabManager.sendLLMResponse({
                    model: payload.model,
                    content: response
                });
            } else {
                this.tabManager.sendLLMResponse({
                    model: payload.model,
                    content: 'Error: No response received from ' + payload.model + '. The page may not be fully loaded or you may need to log in.'
                });
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[LLM] Injection failed:', errorMessage);
            this.tabManager.sendLLMResponse({
                model: payload.model,
                content: `Error during ${payload.model} injection: ${errorMessage}`
            });
        }
    }

    /**
     * Wait for a tab's page to finish loading
     */
    private waitForPageLoad(tab: Tab, timeoutMs: number): Promise<void> {
        return new Promise((resolve) => {
            if (!tab.view.webContents.isLoading()) {
                resolve();
                return;
            }

            const timeout = setTimeout(() => {
                console.log('[LLM] Page load timeout, proceeding anyway');
                resolve();
            }, timeoutMs);

            tab.view.webContents.once('did-finish-load', () => {
                clearTimeout(timeout);
                // Give extra time for JS frameworks to hydrate
                setTimeout(resolve, 2000);
            });
        });
    }

    private async injectChatGPT(tab: Tab, prompt: string, context?: string): Promise<string> {
        const fullPrompt = context ? `Context:\n${context}\n\nTask:\n${prompt}` : prompt;
        const safePrompt = fullPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$');

        const script = `
            (async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                
                // 1. Find Input
                const input = document.querySelector('#prompt-textarea');
                if (!input) {
                    throw new Error('ChatGPT input not found');
                }

                // 2. Set Value
                input.focus();
                document.execCommand('insertText', false, \`${safePrompt}\`);
                await sleep(500);
                
                // 3. Click Send
                const sendBtn = document.querySelector('button[data-testid="send-button"]');
                if (sendBtn) {
                    sendBtn.click();
                }
                
                // 4. Wait for completion
                await sleep(2000);
                
                let checks = 0;
                while (checks < 120) {
                    const stopBtn = document.querySelector('button[aria-label="Stop generating"]');
                    const sendBtn = document.querySelector('button[data-testid="send-button"]');
                    
                    if (!stopBtn && sendBtn) break;
                    await sleep(1000);
                    checks++;
                }
                
                // 5. Scrape Last Message
                const allMessages = Array.from(document.querySelectorAll('[data-message-author-role]'));
                let lastUserIndex = -1;
                
                for (let i = allMessages.length - 1; i >= 0; i--) {
                    if (allMessages[i].getAttribute('data-message-author-role') === 'user') {
                        lastUserIndex = i;
                        break;
                    }
                }
                
                if (lastUserIndex !== -1) {
                    const assistantMessages = allMessages.slice(lastUserIndex + 1);
                    return assistantMessages.map(m => m.innerText).join('\\n\\n');
                }
                
                const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
                if (assistantMessages.length > 0) {
                     return assistantMessages[assistantMessages.length - 1].innerText;
                }
                
                return "Failed to scrape response";
            })();
        `;

        return await tab.view.webContents.executeJavaScript(script);
    }

    private async injectGemini(tab: Tab, prompt: string, context?: string): Promise<string> {
        const fullPrompt = context ? `Context:\n${context}\n\nTask:\n${prompt}` : prompt;
        const safePrompt = fullPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\\/g, '\\\\');

        const script = `
            (async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                console.log('[LLM-Inject] Starting Gemini Injection');

                // 1. Find Input (comprehensive selector list for Gemini's evolving UI)
                const inputSelectors = [
                    '.ql-editor.textarea[contenteditable="true"]',
                    'div.ql-editor[contenteditable="true"]',
                    'rich-textarea .ql-editor[contenteditable="true"]',
                    'rich-textarea div[contenteditable="true"]',
                    '.input-area-container [contenteditable="true"]',
                    'div[contenteditable="true"][aria-label]',
                    'div[contenteditable="true"]'
                ];
                
                let input = null;
                for (const sel of inputSelectors) {
                    const candidates = document.querySelectorAll(sel);
                    for (const c of candidates) {
                        // Filter out tiny or hidden elements
                        const rect = c.getBoundingClientRect();
                        if (rect.width > 50 && rect.height > 10) {
                            input = c;
                            console.log('[LLM-Inject] Found input:', sel, 'size:', rect.width, 'x', rect.height);
                            break;
                        }
                    }
                    if (input) break;
                }

                if (!input) {
                    console.error('[LLM-Inject] No input found');
                    return 'Error: Gemini input not found. Is the page fully loaded? Are you logged in?';
                }

                // 2. Type with robust event dispatching
                input.focus();
                
                // Clear first
                input.innerHTML = '';
                input.textContent = '';
                
                // Use insertText for React/Quill compatibility
                document.execCommand('insertText', false, \`${safePrompt}\`);
                
                // Dispatch all relevant events
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('keyup', { bubbles: true }));
                
                await sleep(1000);
                console.log('[LLM-Inject] Text inserted, length:', input.textContent?.length);

                // 3. Send - try multiple button selectors, fallback to Enter
                const sendSelectors = [
                    'button[aria-label="Send message"]',
                    'button.send-button',
                    'button[data-testid="send-button"]',
                    '.send-button-container button',
                    'button[mattooltip="Send message"]',
                    'button.gmat-mdc-button[aria-label="Send message"]'
                ];

                let sent = false;
                for (const sel of sendSelectors) {
                    const btn = document.querySelector(sel);
                    if (btn && !btn.disabled) {
                        btn.click();
                        console.log('[LLM-Inject] Clicked send button:', sel);
                        sent = true;
                        break;
                    }
                }

                if (!sent) {
                    // Fallback: Press Enter
                    console.log('[LLM-Inject] No send button found, pressing Enter');
                    input.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
                    }));
                    input.dispatchEvent(new KeyboardEvent('keypress', {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
                    }));
                    input.dispatchEvent(new KeyboardEvent('keyup', {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
                    }));
                }

                // 4. Wait for response using CONTENT STABILITY detection
                await sleep(5000); // Let generation start
                
                let lastContent = '';
                let stableCount = 0;
                const STABLE_THRESHOLD = 4; // 4 seconds of no change = done
                
                for (let i = 0; i < 120; i++) {
                    // Get the latest model response (multiple selectors for Gemini variants)
                    const responseSelectors = [
                        'model-response',
                        'message-content.model-response-text',
                        '.model-response-text',
                        '.response-container',
                        '[data-message-author-role="assistant"]'
                    ];
                    
                    let currentContent = '';
                    for (const sel of responseSelectors) {
                        const els = document.querySelectorAll(sel);
                        if (els.length > 0) {
                            currentContent = els[els.length - 1].innerText || '';
                            if (currentContent.length > 0) break;
                        }
                    }
                    
                    if (currentContent.length > 0 && currentContent === lastContent) {
                        stableCount++;
                        if (stableCount >= STABLE_THRESHOLD) {
                            console.log('[LLM-Inject] Content stable for', STABLE_THRESHOLD, 'seconds. Done.');
                            break;
                        }
                    } else {
                        stableCount = 0;
                        lastContent = currentContent;
                    }
                    
                    await sleep(1000);
                }

                // 5. Scrape the final response
                const modelSelectors = [
                    'model-response',
                    'message-content.model-response-text',
                    '.model-response-text',
                    '.response-container',
                    '[data-message-author-role="assistant"]'
                ];
                
                for (const sel of modelSelectors) {
                    const els = document.querySelectorAll(sel);
                    if (els.length > 0) {
                        const text = els[els.length - 1].innerText;
                        if (text && text.length > 0) {
                            console.log('[LLM-Inject] Scraped response length:', text.length);
                            return text;
                        }
                    }
                }
                
                // Deep Fallback
                console.warn('[LLM-Inject] No model response elements found');
                const main = document.querySelector('main');
                if (main) return main.innerText.slice(-15000);
                return document.body.innerText.slice(-15000); 
            })();
        `;
        return await tab.view.webContents.executeJavaScript(script);
    }

    private async injectClaude(tab: Tab, prompt: string, context?: string): Promise<string> {
        const fullPrompt = context ? `Context:\n${context}\n\nTask:\n${prompt}` : prompt;
        const safePrompt = fullPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$');

        const script = `
            (async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                
                // Find Claude's input
                const input = document.querySelector('[contenteditable="true"]');
                if (!input) return 'Error: Claude input not found';
                
                input.focus();
                document.execCommand('insertText', false, \`${safePrompt}\`);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(500);
                
                // Send
                const sendBtn = document.querySelector('button[aria-label="Send Message"]') || 
                                document.querySelector('button[type="submit"]');
                if (sendBtn) sendBtn.click();
                
                // Wait for response stability
                await sleep(3000);
                let lastContent = '';
                let stableCount = 0;
                
                for (let i = 0; i < 120; i++) {
                    const messages = document.querySelectorAll('[data-is-streaming], .font-claude-message');
                    if (messages.length > 0) {
                        const current = messages[messages.length - 1].innerText || '';
                        if (current.length > 0 && current === lastContent) {
                            stableCount++;
                            if (stableCount >= 3) break;
                        } else {
                            stableCount = 0;
                            lastContent = current;
                        }
                    }
                    await sleep(1000);
                }
                
                // Scrape
                const messages = document.querySelectorAll('.font-claude-message, [data-is-streaming]');
                if (messages.length > 0) return messages[messages.length - 1].innerText;
                return 'Failed to scrape Claude response';
            })();
        `;
        return await tab.view.webContents.executeJavaScript(script);
    }
}
