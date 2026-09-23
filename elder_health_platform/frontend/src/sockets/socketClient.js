/**
 * socketClient.js
 * ================
 * NOTE ON A DELIBERATE STACK ADJUSTMENT:
 * The original Phase 1 tech stack listed `socket.io-client` for the
 * frontend. The Phase 2 backend, however, was built with FastAPI's native
 * WebSocket support (`@app.websocket(...)`), not `python-socketio` — plain
 * FastAPI WebSockets are simpler to reason about for this project's needs
 * (no extra server dependency, no Engine.IO handshake/room abstraction to
 * learn) and don't require a Socket.IO-speaking server. socket.io-client
 * cannot talk to a raw WebSocket endpoint (different handshake protocol),
 * so this module uses the browser's native `WebSocket` API to match what
 * `main.py` actually serves. If a future phase swaps the backend to
 * `python-socketio`, only this file needs to change — every component
 * consumes the `createReconnectingSocket` interface below, not WebSocket
 * directly.
 *
 * Provides automatic reconnect with exponential backoff, since a caregiver
 * dashboard silently going stale after a dropped connection is worse than
 * a vitals endpoint being briefly unreachable.
 */

const MAX_BACKOFF_MS = 15000;
const BASE_BACKOFF_MS = 1000;

/**
 * @param {string} url - full ws:// or wss:// URL to connect to
 * @param {object} handlers
 * @param {(data: any) => void} handlers.onMessage
 * @param {() => void} [handlers.onOpen]
 * @param {() => void} [handlers.onClose]
 * @returns {{ close: () => void }}
 */
export function createReconnectingSocket(url, { onMessage, onOpen, onClose }) {
  let socket = null;
  let attempt = 0;
  let closedByCaller = false;
  let retryTimer = null;

  const connect = () => {
    socket = new WebSocket(url);

    socket.onopen = () => {
      attempt = 0;
      onOpen?.();
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err, event.data);
      }
    };

    socket.onclose = () => {
      // BUG FIX: this used to call onClose?.() unconditionally, before
      // checking closedByCaller. Under React 18 StrictMode (see main.jsx),
      // every effect runs once, is cleaned up, then runs again on mount —
      // so useVitalsSocket/useAlertsSocket's effect creates a FIRST socket,
      // immediately calls close() on it (setting closedByCaller = true for
      // THAT socket), then creates a SECOND, real socket. The first
      // socket's close handshake finishes asynchronously a few seconds
      // later, and its onclose still fired onClose?.() -> setConnected(false)
      // — stomping the second (real, healthy) connection's "connected: true"
      // back to false, permanently stuck showing "Reconnecting" even though
      // data was still flowing. Checking closedByCaller FIRST means a
      // deliberately-closed socket never reports itself as disconnected to
      // the caller — only an unexpected drop does.
      if (closedByCaller) return;
      onClose?.();
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      retryTimer = setTimeout(connect, backoff);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();

  return {
    close: () => {
      closedByCaller = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    },
  };
}