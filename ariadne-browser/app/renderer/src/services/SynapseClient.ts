
import { create } from 'zustand';

interface SynapseState {
    isConnected: boolean;
    lastPing: number;
    connect: () => void;
    capturePage: (data: { title: string; url: string; content: string; favicon?: string }) => void;
}

const RECONNECT_INTERVAL = 5000;
const PING_INTERVAL = 30000;

export const useSynapseClient = create<SynapseState>((set, get) => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let pingTimer: NodeJS.Timeout | null = null;

    const connect = () => {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

        try {
            ws = new WebSocket('ws://localhost:9847');

            ws.onopen = () => {
                console.log('[Synapse] Connected to NeuralLink');
                set({ isConnected: true });

                // Start heartbeat
                if (pingTimer) clearInterval(pingTimer);
                pingTimer = setInterval(() => {
                    if (ws?.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'PING' }));
                    }
                }, PING_INTERVAL);
            };

            ws.onclose = () => {
                console.log('[Synapse] Disconnected');
                set({ isConnected: false });
                ws = null;

                // Auto-reconnect
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        connect();
                    }, RECONNECT_INTERVAL);
                }
            };

            ws.onerror = (err) => {
                console.warn('[Synapse] Connection error:', err);
                ws?.close();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'PONG') {
                        set({ lastPing: Date.now() });
                    } else if (data.type === 'CAPTURE_SUCCESS') {
                        console.log('[Synapse] Capture confirmed:', data.message);
                        // Could add a toast notification here
                    }
                } catch (e) {
                    console.error('[Synapse] Error parsing message', e);
                }
            };

        } catch (err) {
            console.error('[Synapse] Setup error:', err);
        }
    };

    return {
        isConnected: false,
        lastPing: 0,
        connect,
        capturePage: (payload) => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'CAPTURE_PAGE',
                    payload
                }));
            } else {
                console.warn('[Synapse] Cannot capture, offline');
            }
        }
    };
});
