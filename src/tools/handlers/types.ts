import { UserSession, KakaoResponse } from '../../types';

export type HandlerFunction = (message: string, session: UserSession) => KakaoResponse | Promise<KakaoResponse>;

export interface HandlerMap {
  [key: string]: HandlerFunction;
}