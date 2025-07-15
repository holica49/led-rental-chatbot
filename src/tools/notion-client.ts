import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

export const notionClient = new Client({
  auth: process.env.NOTION_API_KEY,
});

export const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

// LED 개소별 사양 타입
export interface LEDSpecs {
  size?: string;
  stageHeight?: number;
  moduleCount?: number;
  needOperator?: boolean;
  operatorDays?: number;
}

// 업데이트된 NotionEvent 타입 (totalModuleCount 추가)
export interface NotionEvent {
  id?: string;
  eventName: string;
  customerName: string;
  eventStatus: string;
  venue: string;
  assignee?: string;
  customerContact?: string;
  customerManager?: string;
  
  // 일정 정보
  installDate?: string;
  eventDate?: string;
  dismantleDate?: string;
  rehearsalDate?: string;
  
  // LED 개소별 정보 (최대 5개소)
  led1?: LEDSpecs;
  led2?: LEDSpecs;
  led3?: LEDSpecs;
  led4?: LEDSpecs;
  led5?: LEDSpecs;
  
  // 총 비용 정보
  totalQuoteAmount?: number;
  totalModuleCount?: number;        // 🔥 새로 추가
  ledModuleCost?: number;
  structureCost?: number;
  controllerCost?: number;
  powerCost?: number;
  installationCost?: number;
  operatorCost?: number;
  transportCost?: number;
  
  // 링크
  requestSheetUrl?: string;
  quoteSheetUrl?: string;
}