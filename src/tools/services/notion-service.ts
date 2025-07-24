import { UserSession } from '../../types';

export function prepareNotionData(session: UserSession, quote: any, schedules: any): any {
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
    notionData = {
      ...notionData,
      installEnvironment: session.data.installEnvironment || '실내',
      supportStructureType: session.data.supportStructureType || '',
      eventSchedule: session.data.rentalPeriod ? `${session.data.rentalPeriod}일` : '',
      periodSurchargeAmount: quote?.periodSurcharge?.surchargeAmount || 0,
      installSchedule: schedules?.installSchedule || '',
      rehearsalSchedule: schedules?.rehearsalSchedule || '',
      dismantleSchedule: schedules?.dismantleSchedule || '',
      ...session.data.ledSpecs.reduce((acc: any, led: any, index: number) => {
        acc[`led${index + 1}`] = led;
        return acc;
      }, {}),
      totalQuoteAmount: quote?.total || 0,
      totalModuleCount: quote?.totalModuleCount || 0,
      ledModuleCost: quote?.ledModules?.price || 0,
      transportCost: quote?.transport?.price || 0
    };
  } else if (session.serviceType === '멤버쉽') {
    notionData = {
      ...notionData,
      memberCode: session.data.memberCode || '',
      eventSchedule: schedules?.eventSchedule || '',
      installSchedule: schedules?.installSchedule || '',
      rehearsalSchedule: schedules?.rehearsalSchedule || '',
      dismantleSchedule: schedules?.dismantleSchedule || '',
      ...session.data.ledSpecs.reduce((acc: any, led: any, index: number) => {
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
      operatorCost: quote?.operation?.totalPrice || 0,
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
  }
  
  return notionData;
}