import { UserSession } from '../../types/index.js';

class SessionManager {
  private sessions: Map<string, UserSession> = new Map();

  getSession(userId: string): UserSession {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        step: 'start',
        data: { ledSpecs: [] },
        ledCount: 0,
        currentLED: 1
      });
    }
    return this.sessions.get(userId)!;
  }

  clearSession(userId: string): void {
    this.sessions.delete(userId);
  }

  updateSession(userId: string, updates: Partial<UserSession>): void {
    const session = this.getSession(userId);
    Object.assign(session, updates);
  }
}

export const sessionManager = new SessionManager();