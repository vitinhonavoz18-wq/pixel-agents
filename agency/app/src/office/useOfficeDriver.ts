import { interpretOfficeMessage, OfficeSync } from '@pixel-agency/shared';
import { useCallback, useEffect, useRef } from 'react';

import type { ClientMessage, ServerMessage } from '../../../../core/src/messages';
import { useAgency } from '../state/store';

/** Desktop (Desktop Bridge) agents get ids far from the agency's. */
const DESKTOP_ID_OFFSET = 10_000;

function remapDesktop(msg: ServerMessage): ServerMessage | null {
  const shift = (id: number) => id + DESKTOP_ID_OFFSET;
  switch (msg.type) {
    case 'agentCreated':
      return { ...msg, id: shift(msg.id), folderName: 'desktop', isExternal: true };
    case 'existingAgents':
      return null; // the backend replays these as agentCreated
    case 'agentTeamInfo':
      return {
        ...msg,
        id: shift(msg.id),
        leadAgentId: msg.leadAgentId ? shift(msg.leadAgentId) : undefined,
      };
    case 'agentClosed':
    case 'agentStatus':
    case 'agentToolStart':
    case 'agentToolDone':
    case 'agentToolsClear':
    case 'agentToolPermission':
    case 'agentToolPermissionClear':
      return { ...msg, id: shift(msg.id) } as ServerMessage;
    default:
      return null;
  }
}

/**
 * Bridges the zustand store and the embedded office: diffs agency state into
 * office protocol messages (OfficeSync) and turns office clicks/saves into
 * store actions. Platform views only provide `post`.
 */
export function useOfficeDriver(post: (msgs: ServerMessage[]) => void) {
  const syncRef = useRef(new OfficeSync());
  const readyRef = useRef(false);
  const postRef = useRef(post);
  postRef.current = post;

  const push = useCallback(() => {
    if (!readyRef.current) return;
    const { agents, runtimes } = useAgency.getState();
    const msgs = syncRef.current.sync(
      Object.values(agents)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((agent) => ({ agent, runtime: runtimes[agent.id] })),
    );
    if (msgs.length > 0) postRef.current(msgs);
  }, []);

  useEffect(() => {
    const unsub = useAgency.subscribe((s, prev) => {
      if (s.agents !== prev.agents || s.runtimes !== prev.runtimes) push();
    });
    const unsubDesktop = useAgency.getState().onDesktop((messages) => {
      if (!readyRef.current) return;
      const mapped = messages.map(remapDesktop).filter((m): m is ServerMessage => m !== null);
      if (mapped.length > 0) postRef.current(mapped);
    });
    return () => {
      unsub();
      unsubDesktop();
    };
  }, [push]);

  const onOfficeMessage = useCallback(
    (msg: ClientMessage) => {
      const intent = interpretOfficeMessage(msg);
      const store = useAgency.getState();
      switch (intent.kind) {
        case 'ready': {
          readyRef.current = true;
          syncRef.current.reset();
          syncRef.current.setSeats(store.officeSeats);
          if (store.officeLayout)
            postRef.current([{ type: 'layoutLoaded', layout: store.officeLayout }]);
          push();
          break;
        }
        case 'selectAgent': {
          if (intent.numericId >= DESKTOP_ID_OFFSET) {
            void store.api
              ?.desktopCommand({ type: 'focusAgent', id: intent.numericId - DESKTOP_ID_OFFSET })
              .catch(() => undefined);
            break;
          }
          const agentId = syncRef.current.agentIdFor(intent.numericId);
          if (agentId) store.selectAgent(agentId);
          break;
        }
        case 'saveLayout':
          store.saveOfficeLayout(intent.layout);
          break;
        case 'saveSeats': {
          const seats: Record<string, string> = { ...store.officeSeats };
          for (const [num, seatId] of Object.entries(intent.seats)) {
            const agentId = syncRef.current.agentIdFor(Number(num));
            if (agentId) seats[agentId] = seatId;
          }
          store.saveOfficeSeats(seats);
          break;
        }
        default:
          break;
      }
    },
    [push],
  );

  const onReload = useCallback(() => {
    readyRef.current = false;
    syncRef.current.reset();
  }, []);

  return { onOfficeMessage, onReload };
}

export const OFFICE_ENVELOPE = '__pixelAgency';
