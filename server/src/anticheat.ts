import type { QuizEvent, QuizFlags } from '@sagotka/shared';

export interface QuizSession {
  token: string;
  formId: string;
  fullscreenRequired: boolean;
  startedAt: number;
  submittedAt: number | null;
}

export function computeQuizFlags(
  session: QuizSession,
  events: QuizEvent[],
  now = Date.now(),
): QuizFlags {
  let tabSwitches = 0;
  let fullscreenExits = 0;
  let copyAttempts = 0;
  let sawFullscreenEnter = false;
  for (const e of events) {
    switch (e.type) {
      case 'hidden':
        tabSwitches += 1;
        break;
      case 'fullscreen-enter':
        sawFullscreenEnter = true;
        break;
      case 'fullscreen-exit':
        fullscreenExits += 1;
        break;
      case 'copy':
        copyAttempts += 1;
        break;
      default:
        break;
    }
  }
  const submittedAt = session.submittedAt ?? now;
  return {
    tabSwitches,
    fullscreenExits,
    copyAttempts,
    durationMs: Math.max(0, submittedAt - session.startedAt),
    ...(session.fullscreenRequired && !sawFullscreenEnter ? { fullscreenDenied: true } : {}),
  };
}
