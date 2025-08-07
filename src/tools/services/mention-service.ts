import { Client } from '@notionhq/client';
import { LEDSpec } from '../../types/index.js';
import { 
  STATUS_MESSAGES, 
  getNotionServiceType, 
  getManagerId, 
  getManagerName,
  COMMON_ELEMENTS 
} from '../../constants/notion-messages.js';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

interface MentionEventData {
  serviceType?: string;
  eventName?: string;
  customerName?: string;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  eventPeriod?: string;
  venue?: string;
  totalAmount?: number;
  ledSpecs?: LEDSpec[];
  memberCode?: string;
}

export async function addMentionToPage(pageId: string, eventData: MentionEventData) {
  try {
    const notionServiceType = getNotionServiceType(eventData.serviceType || '');
    const managerId = getManagerId(notionServiceType);
    const managerName = getManagerName(notionServiceType);
    
    // LED 사양 포맷팅
    let ledSpecsText = '';
    if (eventData.ledSpecs && eventData.ledSpecs.length > 0) {
      ledSpecsText = eventData.ledSpecs.map((spec: any, index: number) => {
        const [w, h] = spec.size.split('x').map(Number);
        const moduleCount = (w / 500) * (h / 500);
        return `${index + 1}. ${spec.size} (무대높이: ${spec.stageHeight}mm, ${moduleCount}개)`;
      }).join('\n');
    }
    
    // 템플릿 선택 및 변수 치환
    let messageTemplate = STATUS_MESSAGES.QUOTE_REQUEST_TO_REVIEW[notionServiceType];
    
    // 변수 치환
    let messageText = messageTemplate
      .replace('{{eventName}}', eventData.eventName || '')
      .replace('{{customerName}}', eventData.customerName || '')
      .replace('{{contactName}}', eventData.contactName || '')
      .replace('{{contactTitle}}', eventData.contactTitle || '')
      .replace('{{contactPhone}}', eventData.contactPhone || '')
      .replace('{{eventPeriod}}', eventData.eventPeriod || '')
      .replace('{{venue}}', eventData.venue || '')
      .replace('{{ledSpecs}}', ledSpecsText)
      .replace('{{memberCode}}', eventData.memberCode || '')
      .replace('{{totalAmount}}', eventData.totalAmount?.toLocaleString() || '0')
      .replace('{{mention}}', `${COMMON_ELEMENTS.MENTION_REQUEST}@${managerName}`)
      .replace('{{timestamp}}', COMMON_ELEMENTS.TIMESTAMP.replace('{{timestamp}}', new Date().toLocaleString('ko-KR')));
    
    // Notion rich text 형식으로 변환
    const richTextContent: any[] = [];
    
    // 메시지를 줄바꿈으로 분리하여 처리
    const lines = messageText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 담당자 확인 요청 줄 처리
      if (line.includes(COMMON_ELEMENTS.MENTION_REQUEST)) {
        const beforeMention = line.split('@')[0];
        const afterMention = line.split('@')[1] || '';
        
        richTextContent.push({
          type: 'text',
          text: { content: beforeMention },
          annotations: { bold: true }
        });
        
        richTextContent.push({
          type: 'mention',
          mention: {
            type: 'user',
            user: { id: managerId }
          }
        });
        
        if (afterMention) {
          richTextContent.push({
            type: 'text',
            text: { content: afterMention }
          });
        }
      } else {
        // 일반 텍스트 처리
        const isBold = line.includes('새로운') || line.includes('정보:') || line.includes('사양:') || line.includes('다음 단계:');
        
        richTextContent.push({
          type: 'text',
          text: { content: line },
          annotations: { bold: isBold }
        });
      }
      
      // 줄바꿈 추가 (마지막 줄 제외)
      if (i < lines.length - 1) {
        richTextContent.push({
          type: 'text',
          text: { content: '\n' }
        });
      }
    }
    
    // 빠른 확인 요청 추가
    richTextContent.push({
      type: 'text',
      text: { content: `\n\n${COMMON_ELEMENTS.QUICK_CHECK}` },
      annotations: { bold: true }
    });
    
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: richTextContent
    });
    
    console.log('✅ 담당자 언급 알림 완료');
    
  } catch (error) {
    console.error('❌ 담당자 언급 실패:', error);
  }
}