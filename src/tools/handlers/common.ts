import { 
  handleAdditionalRequests,
  handleCustomerCompany,
  handleContactName,
  handleContactTitle,
  handleContactPhone,
  handleFinalConfirmation
} from './common-handlers';

export const commonHandlers = {
  'get_additional_requests': handleAdditionalRequests,
  'get_customer_company': handleCustomerCompany,
  'get_contact_name': handleContactName,
  'get_contact_title': handleContactTitle,
  'get_contact_phone': handleContactPhone,
  'final_confirmation': handleFinalConfirmation
};