export {
  missionEventKinds,
  missionEventStatuses,
  type MissionEvent,
} from '../shared/mission-event.ts';

export type MissionEventKind = import('../shared/mission-event.ts').MissionEvent['kind'];
export type MissionEventStatus = import('../shared/mission-event.ts').MissionEvent['status'];
