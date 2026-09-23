import { useEffect, useRef, useState } from "react";
import { WS_BASE_URL } from "../api/httpClient";
import { createReconnectingSocket } from "../sockets/socketClient";

/**
 * Subscribes to /ws/alerts/{caregiverId}. Every message pushed by the
 * backend's threshold engine / anomaly worker / fall-detection worker
 * lands here in real time, and is surfaced to the store for the anomaly
 * log table and (for fall_detection alerts) the emergency modal.
 */
export function useAlertsSocket(caregiverId, onAlert) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  useEffect(() => {
    if (!caregiverId) return undefined;

    const url = `${WS_BASE_URL}/ws/alerts/${caregiverId}`;
    socketRef.current = createReconnectingSocket(url, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (payload) => onAlertRef.current?.(payload),
    });

    return () => socketRef.current?.close();
  }, [caregiverId]);

  return { connected };
}
