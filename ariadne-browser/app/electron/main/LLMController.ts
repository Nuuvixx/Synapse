
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
            return;
        }

        // 1. Find Tab
        const existingTabInfo = this.tabManager.findTabByUrl(targetUrl);
        let tab: Tab | undefined;

        if (existingTabInfo) {
            tab = this.tabManager.getTab(existingTabInfo.id);
        }

        // 2. If not found, create (User might need to login)
        if (!tab) {
            console.log('[LLM] Tab not found, opening:', targetUrl);
            const tabInfo = this.tabManager.createTab('https://' + targetUrl);
            tab = this.tabManager.getTab(tabInfo.id);

            // Wait for load (basic 3s wait, unreliable but simple for now)
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!tab) return;

        // 3. Activate Tab
        this.tabManager.switchTab(tab.id);

        // 4. Inject Strategy
        try {
            let response = '';
            if (targetUrl.includes('chatgpt')) {
                response = await this.injectChatGPT(tab, payload.prompt, payload.context);
            } else if (targetUrl.includes('gemini')) {
                response = await this.injectGemini(tab, payload.prompt, payload.context);
            }

            // 5. Send Result Back via Synapse
            if (response) {
                // We use a custom message type 'LLM_RESPONSE'
                // But TabManager only has sendToNeuralNotes which sends 'CAPTURE_PAGE'
                // We'll use a hack or add a method. 
                // Hack: We'll send it via the socket connection directly if we can access it,
                // or we added a method to TabManager to send raw messages? No we didn't.
                // We'll use sendToNeuralNotes with a special type? 
                // No, SynapseServer expects LLM_RESPONSE type to forward it to 'ai:web-response'.
                // If we send CAPTURE_PAGE, it saves a note.
                // We need to add 'sendLLMResponse' to TabManager.
                // For now, I'll access the private 'synapseConnection' via a public method or just type casting.
                // Actually, I should add sendLLMResponse to TabManager.

                // Let's assume I'll add sendLLMResponse to TabManager next.
                // @ts-ignore
                this.tabManager.sendLLMResponse({
                    model: payload.model,
                    content: response
                });
            }

        } catch (error) {
            console.error('[LLM] Injection failed:', error);
        }
    }

    private async injectChatGPT(tab: Tab, prompt: string, context?: string): Promise<string> {
        const fullPrompt = context ? `Context:\n${context}\n\nTask:\n${prompt}` : prompt;
        // Escape backticks for template string
        const safePrompt = fullPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$');

        const script = `
            (async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                
                // 1. Find Input
                const input = document.querySelector('#prompt-textarea');
                if (!input) {
                    throw new Error('ChatGPT input not found');
                }

                // 2. Set Value (React requires specific events)
                input.focus();
                document.execCommand('insertText', false, \`${safePrompt}\`);
                await sleep(500);
                
                // 3. Click Send
                const sendBtn = document.querySelector('button[data-testid="send-button"]');
                if (sendBtn) {
                    sendBtn.click();
                } else {
                    // Sometimes it's Enter?
                    // input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                }
                
                // 4. Watch for Completion
                // We look for the "Stop generating" button to appear and then disappear.
                // Or we look for the last assistant message and wait for it to stop changing.
                // Better: Wait for "send-button" to reappear/be enabled.
                
                await sleep(2000); // Wait for generation to start
                
                let checks = 0;
                while (checks < 120) { // Max 2 minutes
                    const stopBtn = document.querySelector('button[aria-label="Stop generating"]');
                    const sendBtn = document.querySelector('button[data-testid="send-button"]');
                    
                    if (!stopBtn && sendBtn) {
                        // Generation likely done
                        break;
                    }
                    await sleep(1000);
                    checks++;
                }
                
                // 5. Scrape Last Message (Robust Multi-Part Handling)
                // ChatGPT sometimes splits responses into multiple chunks.
                // We find the last 'user' message, and take everything after it.
                
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
                    return assistantMessages.map(m => m.innerText).join('\n\n');
                }
                
                // Fallback: just return the last assistant message if we can't find user
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
        const safePrompt = fullPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$');

        const script = `
            (async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                console.log('[LLM] Starting Gemini Injection');

                // 1. Find Input (try multiple selectors)
                const inputSelectors = [
                    'div.ql-editor[contenteditable="true"]',
                    'rich-textarea div[contenteditable="true"]',
                    'div[contenteditable="true"]'
                ];
                
                let input = null;
                for (const sel of inputSelectors) {
                    input = document.querySelector(sel);
                    if (input) { console.log('[LLM] Found input:', sel); break; }
                }

                if (!input) {
                    console.error('[LLM] No input found. Selectors tried:', inputSelectors);
                    return 'Error: Gemini input not found. Is the page fully loaded?';
                }

                // 2. Type with robust event dispatching
                input.focus();
                input.textContent = '';
                document.execCommand('insertText', false, \`${safePrompt}\`);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                await sleep(800);
                console.log('[LLM] Text inserted, length:', input.textContent.length);

                // 3. Send - try button, fallback to Enter
                const sendSelectors = [
                    'button[aria-label="Send message"]',
                    'button.send-button',
                    'button[data-testid="send-button"]'
                ];

                let sent = false;
                for (const sel of sendSelectors) {
                    const btn = document.querySelector(sel);
                    if (btn && !btn.disabled) {
                        btn.click();
                        console.log('[LLM] Clicked send:', sel);
                        sent = true;
                        break;
                    }
                }

                if (!sent) {
                    console.log('[LLM] No send button found, pressing Enter');
                    input.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
                    }));
                }

                // 4. Wait for response using CONTENT STABILITY detection
                //    Instead of relying on brittle button selectors, we:
                //    - Wait a bit for generation to start
                //    - Then poll for model response content
                //    - When content stops changing for 3 consecutive checks, we're done
                
                await sleep(3000); // Let generation start
                
                let lastContent = '';
                let stableCount = 0;
                const STABLE_THRESHOLD = 3; // 3 seconds of no change = done
                
                for (let i = 0; i < 120; i++) { // Max 2 minutes
                    // Get the latest model response
                    const modelEls = document.querySelectorAll('model-response, [data-message-author-role="assistant"], .model-response-text');
                    
                    if (modelEls.length > 0) {
                        const currentContent = modelEls[modelEls.length - 1].innerText || '';
                        
                        if (currentContent.length > 0 && currentContent === lastContent) {
                            stableCount++;
                            if (stableCount >= STABLE_THRESHOLD) {
                                console.log('[LLM] Content stable for', STABLE_THRESHOLD, 'seconds. Done.');
                                break;
                            }
                        } else {
                            stableCount = 0;
                            lastContent = currentContent;
                        }
                    }
                    
                    await sleep(1000);
                }

                // 5. Scrape the final response
                const modelSelectors = ['model-response', '[data-message-author-role="assistant"]', '.model-response-text'];
                
                for (const sel of modelSelectors) {
                    const els = document.querySelectorAll(sel);
                    if (els.length > 0) {
                        const text = els[els.length - 1].innerText;
                        console.log('[LLM] Scraped response, length:', text.length);
                        return text;
                    }
                }
                
                // Deep Fallback
                console.warn('[LLM] No model response elements found, using fallback');
                const main = document.querySelector('main');
                if (main) return main.innerText.slice(-15000);
                return document.body.innerText.slice(-15000); 
            })();
        `;
        return await tab.view.webContents.executeJavaScript(script);
    }
}
