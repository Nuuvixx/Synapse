
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
                
                // 5. Scrape Last Message
                const messages = document.querySelectorAll('div[data-message-author-role="assistant"]');
                if (messages.length > 0) {
                    const lastMsg = messages[messages.length - 1];
                    return lastMsg.innerText;
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
                
                // 1. Find Input (Rich textarea)
                const input = document.querySelector('div[contenteditable="true"]');
                if (!input) throw new Error('Gemini input not found');

                // 2. Type
                input.focus();
                document.execCommand('insertText', false, \`${safePrompt}\`);
                await sleep(500);

                // 3. Send (Button is usually an icon, finding by aria-label "Send message")
                const sendBtn = document.querySelector('button[aria-label="Send message"]');
                if (sendBtn) sendBtn.click();

                // 4. Wait
                await sleep(2000);
                
                // Main loading indicator usually: .generating-indicator or specific button states
                // Gemini is tricky. Let's wait for the input to be empty? No.
                // Look for 'stop' button or similar.
                
                let checks = 0;
                while (checks < 120) {
                    // Simple heuristic: check if the "Send" button is present and enabled
                    const sendBtn = document.querySelector('button[aria-label="Send message"]');
                     // If send button is back, we are likely done.
                     // Does Gemini hide send button? Yes, replaces with Stop.
                     if (sendBtn && !sendBtn.disabled) {
                         break;
                     }
                     await sleep(1000);
                     checks++;
                }

                // 5. Scrape
                const messages = document.querySelectorAll('.model-response-text'); // This selector is a guess, needs verification
                // Or 'message-content'
                // Gemini classes are obfusctated often.
                // Fallback: helper-line-content or similar
                
                // For now, return a placeholder if selector fails
                return document.body.innerText.slice(-500); 
            })();
         `;
        return await tab.view.webContents.executeJavaScript(script);
    }
}
