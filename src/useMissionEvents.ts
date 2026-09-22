import { useEffect, useState } from 'react';
import { missionEventSchema, seedEvents, type MissionEvent } from './model';

export type DataMode = 'demo' | 'live';

export function useMissionEvents() {
  const [events, setEvents] = useState<MissionEvent[]>(seedEvents);
  const [mode, setMode] = useState<DataMode>('demo');

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    const source = new EventSource('/events');
    source.onmessage = ({ data }) => {
      try {
        const event = missionEventSchema.parse(JSON.parse(data));
        setMode('live');
        setEvents((current) => [event, ...current.filter(({ id }) => id !== event.id)]);
      } catch {
        // A malformed collector event must not interrupt the deterministic fallback.
      }
    };
    source.onerror = () => setMode('demo');

    return () => source.close();
  }, []);

  return { events, mode };
}
