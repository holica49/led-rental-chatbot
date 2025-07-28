// src/utils/session-utils.ts (새 파일)

import { UserSession, SessionData } from '../types/index.js';

/**
 * 현재 세션 상태를 이전 상태로 저장
 */
export function savePreviousStep(session: UserSession): void {
  session.previousStep = session.step;
  session.previousData = JSON.parse(JSON.stringify(session.data));
  session.previousServiceType = session.serviceType;
  session.previousLedCount = session.ledCount;
  session.previousCurrentLED = session.currentLED;
}

/**
 * 이전 단계로 복원
 */
export function restorePreviousStep(session: UserSession): boolean {
  if (!session.previousStep) {
    return false;
  }

  session.step = session.previousStep;
  session.data = session.previousData ? JSON.parse(JSON.stringify(session.previousData)) : { ledSpecs: [] };
  session.serviceType = session.previousServiceType;
  session.ledCount = session.previousLedCount || 0;
  session.currentLED = session.previousCurrentLED || 1;

  // 이전 상태 초기화 (한 단계만 뒤로 가기)
  session.previousStep = undefined;
  session.previousData = undefined;
  session.previousServiceType = undefined;
  session.previousLedCount = undefined;
  session.previousCurrentLED = undefined;

  return true;
}

/**
 * 이전 단계가 있는지 확인
 */
export function hasPreviousStep(session: UserSession): boolean {
  return !!session.previousStep;
}