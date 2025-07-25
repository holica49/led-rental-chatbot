import { UserSession, KakaoResponse } from '../../types/index.js';

export type HandlerFunction = (message: string, session: UserSession) => KakaoResponse | Promise<KakaoResponse>;

export interface HandlerMap {
  [key: string]: HandlerFunction;
}