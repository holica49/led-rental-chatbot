import { UserSession, QuoteResult, RentalQuoteResult } from '../../types/index.js';
import { calculateLEDInfo } from '../calculate-quote.js';
import axios from 'axios';
import { LineWorksAuth } from '../../config/lineworks-auth.js';

export function prepareNotionData(
  session: UserSession, 
  quote: QuoteResult | RentalQuoteResult | null, 
  schedules: { eventSchedule: string; installSchedule: string; rehearsalSchedule: string; dismantleSchedule: string } | null
): Record<string, any> {
  let notionData: any = {
    serviceType: session.serviceType || '',
    eventName: session.data.eventName || 'LED 프로젝트',
    customerName: session.data.customerName || '고객사',
    venue: session.data.venue || '',
    contactName: session.data.contactName || '',
    contactTitle: session.data.contactTitle || '',
    contactPhone: session.data.contactPhone || '',
    additionalRequests: session.data.additionalRequests || ''
  };
  
  if (session.serviceType === '설치') {
    notionData = {
      ...notionData,
      installEnvironment: session.data.installEnvironment || '',
      venue: session.data.installRegion || '', 
      eventSchedule: session.data.installSchedule || '',
      installSpace: session.data.installSpace || '',
      inquiryPurpose: session.data.inquiryPurpose || '',
      installBudget: session.data.installBudget || '',
      totalQuoteAmount: 0,
    };
  } else if (session.serviceType === '렌탈') {
    // LED 추가 정보 계산
    const ledsWithInfo = session.data.ledSpecs.map((led: any) => {
      const ledInfo = calculateLEDInfo(led.size);
      return {
        ...led,
        ...ledInfo
      };
    });
    
    notionData = {
      ...notionData,
      installEnvironment: session.data.installEnvironment || '실내',
      supportStructureType: session.data.supportStructureType || '',
      eventSchedule: schedules?.eventSchedule || '',
      periodSurchargeAmount: (quote as RentalQuoteResult)?.periodSurcharge?.surchargeAmount || 0,
      installSchedule: schedules?.installSchedule || '',
      rehearsalSchedule: schedules?.rehearsalSchedule || '',
      dismantleSchedule: schedules?.dismantleSchedule || '',
      ...ledsWithInfo.reduce((acc: any, led: any, index: number) => {
        acc[`led${index + 1}`] = led;
        return acc;
      }, {}),
      totalQuoteAmount: quote?.total || 0,
      totalModuleCount: quote?.totalModuleCount || 0,
      ledModuleCost: quote?.ledModules?.price || 0,
      structureCost: quote?.structure?.totalPrice || 0,
      controllerCost: quote?.controller?.totalPrice || 0,
      powerCost: quote?.power?.totalPrice || 0,
      installationCost: quote?.installation?.totalPrice || 0,
      transportCost: quote?.transport?.price || 0
    };
    
    // 오퍼레이터 비용이 있을 때만 추가
    if (quote?.operation?.totalPrice && quote.operation.totalPrice > 0) {
      notionData.operatorCost = quote.operation.totalPrice;
    }
    
    // 실외 렌탈인 경우 추가 필드
    if (session.data.installEnvironment === '실외') {
      notionData.inquiryPurpose = session.data.inquiryPurpose || '';
      notionData.installBudget = session.data.installBudget || '';
    }
  } else if (session.serviceType === '멤버쉽') {
    // LED 추가 정보 계산
    const ledsWithInfo = session.data.ledSpecs.map((led: any) => {
      const ledInfo = calculateLEDInfo(led.size);
      return {
        ...led,
        ...ledInfo
      };
    });
    
    notionData = {
      ...notionData,
      memberCode: session.data.memberCode || '',
      eventSchedule: schedules?.eventSchedule || '',
      installSchedule: schedules?.installSchedule || '',
      rehearsalSchedule: schedules?.rehearsalSchedule || '',
      dismantleSchedule: schedules?.dismantleSchedule || '',
      ...ledsWithInfo.reduce((acc: any, led: any, index: number) => {
        acc[`led${index + 1}`] = led;
        return acc;
      }, {}),
      totalQuoteAmount: quote?.total || 0,
      totalModuleCount: quote?.totalModuleCount || 0,
      ledModuleCost: quote?.ledModules?.price || 0,
      structureCost: quote?.structure?.totalPrice || 0,
      controllerCost: quote?.controller?.totalPrice || 0,
      powerCost: quote?.power?.totalPrice || 0,
      installationCost: quote?.installation?.totalPrice || 0,
      transportCost: quote?.transport?.price || 0,
      maxStageHeight: quote?.maxStageHeight || 0,
      installationWorkers: quote?.installationWorkers || 0,
      installationWorkerRange: quote?.installationWorkerRange || '',
      controllerCount: quote?.controllerCount || 0,
      powerRequiredCount: quote?.powerRequiredCount || 0,
      transportRange: quote?.transportRange || '',
      structureUnitPrice: quote?.structureUnitPrice || 0,
      structureUnitPriceDescription: quote?.structureUnitPriceDescription || ''
    };
    
    // 오퍼레이터 비용이 있을 때만 추가
    if (quote?.operation?.totalPrice && quote.operation.totalPrice > 0) {
      notionData.operatorCost = quote.operation.totalPrice;
    }
  }
  
  return notionData;
}