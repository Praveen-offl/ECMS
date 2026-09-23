import { useEffect, useRef, useState } from "react";
import { WS_BASE_URL } from "../api/httpClient";
import { createReconnectingSocket } from "../sockets/socketClient";

const MAX_HISTORY_POINTS = 60;

/**
 * Subscribes to /ws/vitals/{patientId} and maintains a rolling window of
 * recent readings for sparklines/trend charts, plus the single latest
 * reading for the big monitor-card numerals.
 */
export function useVitalsSocket(patientId) {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!patientId) return undefined;

    setHistory([]);
    setLatest(null);

    const url = `${WS_BASE_URL}/ws/vitals/${patientId}`;
    socketRef.current = createReconnectingSocket(url, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (payload) => {
        setLatest(payload);
        setHistory((prev) => {
          const next = [...prev, { ...payload, t: prev.length }];
          return next.length > MAX_HISTORY_POINTS ? next.slice(next.length - MAX_HISTORY_POINTS) : next;
        });
      },
    });

    return () => socketRef.current?.close();
  }, [patientId]);

  return { latest, history, connected };
}
