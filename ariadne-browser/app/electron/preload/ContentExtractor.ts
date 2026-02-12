import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

interface ExtractedContent {
    title: string;
    content: string; // Markdown
    url: string;
    excerpt?: string;
    byline?: string;
    type: 'article' | 'chat' | 'selection' | 'unknown';
}

export class ContentExtractor {
    private turndown: TurndownService;

    constructor() {
        this.turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });
    }

    public extract(doc: Document, url: string): ExtractedContent {
        const isChatGPT = url.includes('chatgpt.com') || url.includes('chat.openai.com');

        if (isChatGPT) {
            return this.extractChatGPT(doc, url);
        }

        return this.extractArticle(doc, url);
    }

    public extractSelection(doc: Document, url: string, selectionHtml: string): ExtractedContent {
        // Convert selection HTML to Markdown
        const markdown = this.turndown.turndown(selectionHtml);
        return {
            title: doc.title,
            content: markdown,
            url,
            type: 'selection'
        };
    }

    private extractArticle(doc: Document, url: string): ExtractedContent {
        // specific check for PDF or other types?

        // Use Readability
        // Readability mutates the DOM clone, so we should clone it?
        // Actually Readability constructor takes a document object.
        // It's better to pass a clone if we don't want to mess up the page, but Readability creates a clone internally usually?
        // Checking Readability docs: "The object you pass... will be modified."
        const clone = doc.cloneNode(true) as Document;
        const reader = new Readability(clone);
        const article = reader.parse();

        if (!article) {
            // Fallback
            return {
                title: doc.title,
                content: this.turndown.turndown(doc.body.innerHTML),
                url,
                type: 'unknown'
            };
        }

        const markdown = this.turndown.turndown(article.content);

        return {
            title: article.title,
            content: markdown,
            excerpt: article.excerpt,
            byline: article.byline,
            url,
            type: 'article'
        };
    }

    private extractChatGPT(doc: Document, url: string): ExtractedContent {
        // Custom extractor for ChatGPT
        // Structure: div.text-message, or specific data-testid

        // As of late 2024/2025, ChatGPT structure is complex.
        // We generally look for conversation turns.
        // Simple heuristic: Select all elements that look like messages.

        // Strategy: Look for "article" tags or specific classes.
        // Using a general approach for now to avoid breaking often.
        // We will try to find the main chat container.

        // Selector for user/assistant turns
        let content = '';
        const turns = doc.querySelectorAll('div[data-message-author-role]');

        if (turns.length > 0) {
            turns.forEach(turn => {
                const role = turn.getAttribute('data-message-author-role'); // 'user' or 'assistant'
                const text = (turn as HTMLElement).innerText;
                content += `**${role?.toUpperCase()}**:\n${text}\n\n---\n\n`;
            });
        } else {
            // Fallback: just dump body text but formatted
            content = this.turndown.turndown(doc.body.innerHTML);
        }

        return {
            title: doc.title || 'ChatGPT Conversation',
            content: content,
            url,
            type: 'chat'
        };
    }
}
