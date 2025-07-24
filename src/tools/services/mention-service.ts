import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function addMentionToPage(pageId: string, eventData: any) {
  try {
    const managersConfig = JSON.parse(process.env.MANAGERS_CONFIG || '{"managers":[]}');
    
    let targetManagers = [];
    
    if (eventData.serviceType === '설치') {
      targetManagers = managersConfig.managers.filter((m: any) => 
        m.notionId === '225d872b-594c-8157-b968-0002e2380097'
      );
    } else if (eventData.serviceType === '렌탈' || eventData.serviceType === '멤버쉽') {
      targetManagers = managersConfig.managers.filter((m: any) => 
        m.notionId === '237d872b-594c-8174-9ab2-00024813e3a9'
      );
    } else {
      targetManagers = managersConfig.managers.filter((m: any) => m.isActive);
    }
    
    if (targetManagers.length === 0) {
      console.warn('지정된 담당자가 없습니다.');
      return;
    }
    
    const richTextContent: any[] = [
      {
        type: 'text',
        text: { content: '🚨 새로운 견적 요청이 접수되었습니다!\n\n' },
        annotations: { bold: true, color: 'red' }
      },
      {
        type: 'text',
        text: { content: `🔖 서비스 유형: ${eventData.serviceType}\n` },
        annotations: { bold: true }
      },
      {
        type: 'text',
        text: { content: `📋 행사명: ${eventData.eventName}\n` },
        annotations: { bold: true }
      },
      {
        type: 'text',
        text: { content: `🏢 고객사: ${eventData.customerName}\n` }
      },
      {
        type: 'text',
        text: { content: `👤 담당자: ${eventData.contactName} (${eventData.contactTitle})\n` }
      },
      {
        type: 'text',
        text: { content: `📞 연락처: ${eventData.contactPhone}\n` }
      },
      {
        type: 'text',
        text: { content: `📅 행사기간: ${eventData.eventPeriod}\n` }
      },
      {
        type: 'text',
        text: { content: `🎪 행사장: ${eventData.venue}\n` }
      },
      {
        type: 'text',
        text: { content: `💰 견적금액: ${eventData.totalAmount?.toLocaleString() || '계산중'}원\n\n` }
      }
    ];
    
    if (eventData.ledSpecs && eventData.ledSpecs.length > 0) {
      richTextContent.push({
        type: 'text',
        text: { content: '📺 LED 사양:\n' },
        annotations: { bold: true }
      });
      
      eventData.ledSpecs.forEach((spec: any, index: number) => {
        const [w, h] = spec.size.split('x').map(Number);
        const moduleCount = (w / 500) * (h / 500);
        richTextContent.push({
          type: 'text',
          text: { content: `${index + 1}. ${spec.size} (무대높이: ${spec.stageHeight}mm, ${moduleCount}개)\n` }
        });
      });
    }
    
    richTextContent.push({
      type: 'text',
      text: { content: '\n' + '─'.repeat(15) + '\n' }
    });
    
    richTextContent.push({
      type: 'text',
      text: { content: '담당자 확인 요청: ' },
      annotations: { bold: true }
    });
    
    targetManagers.forEach((manager: any, index: number) => {
      richTextContent.push({
        type: 'mention',
        mention: {
          type: 'user',
          user: { id: manager.notionId }
        }
      });
      
      if (manager.department) {
        richTextContent.push({
          type: 'text',
          text: { content: `(${manager.department})` }
        });
      }
      
      if (index < targetManagers.length - 1) {
        richTextContent.push({
          type: 'text',
          text: { content: ', ' }
        });
      }
    });
    
    richTextContent.push({
      type: 'text',
      text: { content: '\n\n⏰ 빠른 확인 부탁드립니다!' },
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