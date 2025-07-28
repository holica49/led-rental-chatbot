import { 
  handleAdditionalRequests,
  handleCustomerCompany,
  handleContactName,
  handleContactTitle,
  handleContactPhone,
  handleFinalConfirmation,
  handleResetRequest,
  checkResetRequest,
  checkPreviousRequest  // 추가
} from './common-handlers.js';

export const commonHandlers = {
  'get_additional_requests': handleAdditionalRequests,
  'get_customer_company': handleCustomerCompany,
  'get_contact_name': handleContactName,
  'get_contact_title': handleContactTitle,
  'get_contact_phone': handleContactPhone,
  'final_confirmation': handleFinalConfirmation
};

// 유틸리티 함수들도 export
export { 
  handleResetRequest, 
  checkResetRequest,
  checkPreviousRequest  // 추가
};