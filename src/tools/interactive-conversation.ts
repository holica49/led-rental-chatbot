// src/tools/interactive-conversation.ts - 대화형 정보 수집 시스템

interface ConversationState {
  userId: string;
  projectId?: string;
  step: 'collecting' | 'confirming' | 'completed';
  missingInfo: string[];
  collectedInfo: Record<string, any>;
  lastQuestion: string;
  attempts: number;
  timestamp: number;
}

interface QuestionTemplate {
  field: string;
  question: string;
  validation?: (answer: string) => boolean;
  suggestions?: string[];
  required: boolean;
}

export class InteractiveConversationManager {
  private conversations: Map<string, ConversationState> = new Map();
  private readonly CONVERSATION_TIMEOUT = 10 * 60 * 1000; // 10분

  /**
   * 프로젝트 생성 시 추가 정보가 필요한지 확인
   */
  checkMissingInfoForCreation(projectInfo: any, serviceType: string): string[] {
    const missing: string[] = [];

    // 공통 필수 정보
    if (!projectInfo.customer) missing.push('customer');
    if (!projectInfo.location) missing.push('location');
    if (!projectInfo.eventDate) missing.push('eventDate');

    // 서비스별 필수 정보
    switch (serviceType) {
      case '렌탈':
      case '멤버쉽':
        if (!projectInfo.ledInfos || projectInfo.ledInfos.length === 0) {
          missing.push('ledInfo');
        } else {
          // LED 정보 상세 체크
          projectInfo.ledInfos.forEach((led: any, index: number) => {
            if (!led.size) missing.push(`led${index + 1}Size`);
            if (led.stageHeight === undefined) missing.push(`led${index + 1}StageHeight`);
          });
        }
        break;
      
      case '설치':
        if (!projectInfo.installEnvironment) missing.push('installEnvironment');
        if (!projectInfo.installSpace) missing.push('installSpace');
        if (!projectInfo.installBudget) missing.push('installBudget');
        break;
    }

    return missing;
  }

  /**
   * 대화형 정보 수집 시작
   */
  startInteractiveCollection(
    userId: string, 
    missingInfo: string[], 
    existingInfo: Record<string, any>,
    projectId?: string
  ): { needsInteraction: boolean; firstQuestion?: string } {
    
    if (missingInfo.length === 0) {
      return { needsInteraction: false };
    }

    // 기존 대화 정리
    this.cleanupExpiredConversations();
    
    // 새 대화 상태 생성
    const conversationState: ConversationState = {
      userId,
      projectId,
      step: 'collecting',
      missingInfo: [...missingInfo],
      collectedInfo: { ...existingInfo },
      lastQuestion: '',
      attempts: 0,
      timestamp: Date.now()
    };

    this.conversations.set(userId, conversationState);

    // 첫 번째 질문 생성
    const firstQuestion = this.generateNextQuestion(userId);
    
    return {
      needsInteraction: true,
      firstQuestion
    };
  }

  /**
   * 사용자 응답 처리
   */
  processUserResponse(userId: string, response: string): {
    isComplete: boolean;
    nextQuestion?: string;
    collectedInfo?: Record<string, any>;
    needsConfirmation?: boolean;
    confirmationMessage?: string;
    error?: string;
  } {
    const conversation = this.conversations.get(userId);
    
    if (!conversation) {
      return {
        isComplete: false,
        error: '진행 중인 대화를 찾을 수 없습니다. 처음부터 다시 시도해주세요.'
      };
    }

    // 취소 요청 처리
    if (this.isCancelRequest(response)) {
      this.conversations.delete(userId);
      return {
        isComplete: true,
        error: '정보 수집이 취소되었습니다.'
      };
    }

    // 확인 단계 처리
    if (conversation.step === 'confirming') {
      return this.processConfirmationResponse(userId, response);
    }

    // 현재 질문에 대한 답변 처리
    const currentField = conversation.missingInfo[0];
    const validationResult = this.validateAndStoreResponse(userId, currentField, response);

    if (!validationResult.valid) {
      conversation.attempts++;
      if (conversation.attempts >= 3) {
        // 3번 실패 시 해당 항목 스킵
        conversation.missingInfo.shift();
        conversation.attempts = 0;
        
        if (conversation.missingInfo.length === 0) {
          return this.prepareConfirmation(userId);
        }
        
        return {
          isComplete: false,
          nextQuestion: `해당 정보는 나중에 입력하겠습니다.\n\n${this.generateNextQuestion(userId)}`
        };
      }
      
      return {
        isComplete: false,
        nextQuestion: `${validationResult.error}\n\n${conversation.lastQuestion}`,
        error: validationResult.error
      };
    }

    // 다음 질문으로 진행
    conversation.missingInfo.shift();
    conversation.attempts = 0;

    if (conversation.missingInfo.length === 0) {
      return this.prepareConfirmation(userId);
    }

    return {
      isComplete: false,
      nextQuestion: this.generateNextQuestion(userId)
    };
  }

  /**
   * 다음 질문 생성
   */
  private generateNextQuestion(userId: string): string {
    const conversation = this.conversations.get(userId);
    if (!conversation || conversation.missingInfo.length === 0) {
      return '';
    }

    const field = conversation.missingInfo[0];
    const template = this.getQuestionTemplate(field);
    
    let question = `[${conversation.missingInfo.length}개 남음] ${template.question}`;
    
    if (template.suggestions && template.suggestions.length > 0) {
      question += `\n\n💡 예시: ${template.suggestions.join(', ')}`;
    }
    
    // 스킵 옵션 추가
    if (!template.required) {
      question += `\n\n"스킵"이라고 입력하면 이 항목을 건너뜁니다.`;
    }
    
    conversation.lastQuestion = question;
    return question;
  }

  /**
   * 질문 템플릿 가져오기
   */
  private getQuestionTemplate(field: string): QuestionTemplate {
    const templates: Record<string, QuestionTemplate> = {
      customer: {
        field: 'customer',
        question: '🏢 고객사명을 알려주세요.',
        suggestions: ['삼성전자', '현대모터스', '롯데그룹'],
        required: true,
        validation: (answer) => answer.length > 1
      },
      
      location: {
        field: 'location',
        question: '📍 행사 장소를 알려주세요.',
        suggestions: ['코엑스', '킨텍스', '강남역', '홍대'],
        required: true,
        validation: (answer) => answer.length > 1
      },
      
      eventDate: {
        field: 'eventDate',
        question: '📅 행사 날짜를 알려주세요.',
        suggestions: ['8월 25일', '2025-08-25', '다음 주 월요일'],
        required: true,
        validation: (answer) => /\d/.test(answer)
      },
      
      ledInfo: {
        field: 'ledInfo',
        question: '📺 LED 개수와 크기를 알려주세요.',
        suggestions: ['2개소, 6000x3500과 4000x2000', '1개소 5000x3000'],
        required: true,
        validation: (answer) => /\d/.test(answer)
      },
      
      led1Size: {
        field: 'led1Size',
        question: '📺 첫 번째 LED 크기를 알려주세요.',
        suggestions: ['6000x3500', '5000x3000', '4000x2500'],
        required: true,
        validation: (answer) => /\d+\s*[x×X]\s*\d+/.test(answer)
      },
      
      led1StageHeight: {
        field: 'led1StageHeight',
        question: '🏗️ 첫 번째 LED 무대높이를 알려주세요.',
        suggestions: ['600mm', '800mm', '1000mm', '0mm'],
        required: false,
        validation: (answer) => /\d+/.test(answer)
      },
      
      led2Size: {
        field: 'led2Size',
        question: '📺 두 번째 LED 크기를 알려주세요.',
        suggestions: ['4000x2500', '3000x2000', '6000x3000'],
        required: true,
        validation: (answer) => /\d+\s*[x×X]\s*\d+/.test(answer)
      },
      
      led2StageHeight: {
        field: 'led2StageHeight',
        question: '🏗️두 번째 LED 무대높이를 알려주세요.',
        suggestions: ['600mm', '800mm', '1000mm', '0mm'],
        required: false,
        validation: (answer) => /\d+/.test(answer)
      },
      
      installEnvironment: {
        field: 'installEnvironment',
        question: '🏠 설치 환경을 알려주세요.',
        suggestions: ['실내', '실외'],
        required: true,
        validation: (answer) => ['실내', '실외'].includes(answer)
      },
      
      installSpace: {
        field: 'installSpace',
        question: '🏢 설치 공간 유형을 알려주세요.',
        suggestions: ['기업', '상가', '병원', '공공시설', '숙박시설'],
        required: true,
        validation: (answer) => answer.length > 1
      },
      
      installBudget: {
        field: 'installBudget',
        question: '💰 설치 예산 범위를 알려주세요.',
        suggestions: ['1억 미만', '1-3억', '3-5억', '5억 이상'],
        required: false,
        validation: (answer) => answer.length > 1
      }
    };

    return templates[field] || {
      field,
      question: `${field} 정보를 알려주세요.`,
      required: false,
      validation: () => true
    };
  }

  /**
   * 응답 검증 및 저장
   */
  private validateAndStoreResponse(userId: string, field: string, response: string): {
    valid: boolean;
    error?: string;
  } {
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      return { valid: false, error: '대화 상태를 찾을 수 없습니다.' };
    }

    const template = this.getQuestionTemplate(field);
    
    // 스킵 처리
    if (response.toLowerCase().includes('스킵') && !template.required) {
      return { valid: true };
    }

    // 검증
    if (template.validation && !template.validation(response)) {
      return { 
        valid: false, 
        error: '올바른 형식으로 입력해주세요.' 
      };
    }

    // 저장
    conversation.collectedInfo[field] = this.parseFieldValue(field, response);
    return { valid: true };
  }

  /**
   * 필드 값 파싱
   */
  private parseFieldValue(field: string, response: string): any {
    switch (field) {
      case 'eventDate':
        // 날짜 파싱 로직
        const dateMatch = response.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ||
                         response.match(/(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
        if (dateMatch) {
          if (dateMatch.length === 3) {
            const currentYear = new Date().getFullYear();
            return `${currentYear}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
          } else {
            return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
          }
        }
        return response;

      case 'led1StageHeight':
      case 'led2StageHeight':
        const heightMatch = response.match(/(\d+)/);
        return heightMatch ? parseInt(heightMatch[1]) : 0;

      case 'led1Size':
      case 'led2Size':
        const sizeMatch = response.match(/(\d+)\s*[x×X]\s*(\d+)/);
        return sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : response;

      case 'ledInfo':
        // 복합 LED 정보 파싱
        return this.parseLEDInfo(response);

      default:
        return response.trim();
    }
  }

  /**
   * LED 정보 파싱
   */
  private parseLEDInfo(response: string): any {
    const ledInfos: any[] = [];
    
    // 개수 추출
    const countMatch = response.match(/(\d+)\s*개소/);
    const count = countMatch ? parseInt(countMatch[1]) : 1;

    // 크기 추출
    const sizePattern = /(\d+)\s*[x×X]\s*(\d+)/g;
    let sizeMatch;
    while ((sizeMatch = sizePattern.exec(response)) !== null) {
      ledInfos.push({
        size: `${sizeMatch[1]}x${sizeMatch[2]}`
      });
    }

    // 무대높이 추출
    const heightMatch = response.match(/(?:둘|모두|전부)?\s*(?:다|모두)?\s*(\d+)\s*(?:mm|밀리)?/);
    if (heightMatch) {
      const height = parseInt(heightMatch[1]);
      ledInfos.forEach(led => led.stageHeight = height);
    }

    return {
      count,
      ledInfos
    };
  }

  /**
   * 확인 단계 준비
   */
  private prepareConfirmation(userId: string): any {
    const conversation = this.conversations.get(userId);
    if (!conversation) return { isComplete: false };

    conversation.step = 'confirming';
    
    const confirmationMessage = this.generateConfirmationMessage(conversation.collectedInfo);
    
    return {
      isComplete: false,
      needsConfirmation: true,
      confirmationMessage
    };
  }

  /**
   * 확인 메시지 생성
   */
  private generateConfirmationMessage(info: Record<string, any>): string {
    let message = '📋 수집된 정보를 확인해주세요:\n\n';
    
    if (info.customer) message += `🏢 고객사: ${info.customer}\n`;
    if (info.location) message += `📍 장소: ${info.location}\n`;
    if (info.eventDate) message += `📅 일정: ${info.eventDate}\n`;
    
    if (info.ledInfo) {
      message += `📺 LED 정보: ${info.ledInfo.count}개소\n`;
      info.ledInfo.ledInfos?.forEach((led: any, index: number) => {
        message += `  • LED${index + 1}: ${led.size}`;
        if (led.stageHeight) message += ` (높이: ${led.stageHeight}mm)`;
        message += '\n';
      });
    }
    
    if (info.led1Size) {
      message += `📺 LED1: ${info.led1Size}`;
      if (info.led1StageHeight) message += ` (높이: ${info.led1StageHeight}mm)`;
      message += '\n';
    }
    
    if (info.led2Size) {
      message += `📺 LED2: ${info.led2Size}`;
      if (info.led2StageHeight) message += ` (높이: ${info.led2StageHeight}mm)`;
      message += '\n';
    }
    
    if (info.installEnvironment) message += `🏠 환경: ${info.installEnvironment}\n`;
    if (info.installSpace) message += `🏢 공간: ${info.installSpace}\n`;
    if (info.installBudget) message += `💰 예산: ${info.installBudget}\n`;
    
    message += '\n✅ "확인" 또는 "맞습니다"를 입력하면 프로젝트를 생성합니다.';
    message += '\n❌ "수정" 또는 "다시"를 입력하면 수정할 수 있습니다.';
    message += '\n🚫 "취소"를 입력하면 취소됩니다.';
    
    return message;
  }

  /**
   * 확인 응답 처리
   */
  private processConfirmationResponse(userId: string, response: string): any {
    const conversation = this.conversations.get(userId);
    if (!conversation) return { isComplete: false };

    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('확인') || lowerResponse.includes('맞') || lowerResponse.includes('좋') || lowerResponse.includes('네')) {
      const collectedInfo = conversation.collectedInfo;
      this.conversations.delete(userId);
      
      return {
        isComplete: true,
        collectedInfo
      };
    }
    
    if (lowerResponse.includes('수정') || lowerResponse.includes('다시')) {
      // 수정 모드로 전환
      conversation.step = 'collecting';
      return {
        isComplete: false,
        nextQuestion: '어떤 정보를 수정하시겠습니까?\n\n' +
                     '예시: "고객사", "LED 크기", "일정" 등을 입력하세요.'
      };
    }
    
    if (lowerResponse.includes('취소')) {
      this.conversations.delete(userId);
      return {
        isComplete: true,
        error: '프로젝트 생성이 취소되었습니다.'
      };
    }
    
    return {
      isComplete: false,
      nextQuestion: '확인, 수정, 취소 중 하나를 선택해주세요.',
      error: '명확한 응답을 해주세요.'
    };
  }

  /**
   * 유틸리티 함수들
   */
  private isCancelRequest(response: string): boolean {
    const cancelKeywords = ['취소', '그만', '끝', '종료', '나가'];
    return cancelKeywords.some(keyword => response.includes(keyword));
  }

  private cleanupExpiredConversations(): void {
    const now = Date.now();
    for (const [userId, conversation] of this.conversations.entries()) {
      if (now - conversation.timestamp > this.CONVERSATION_TIMEOUT) {
        this.conversations.delete(userId);
      }
    }
  }

  /**
   * 진행 중인 대화 확인
   */
  hasActiveConversation(userId: string): boolean {
    this.cleanupExpiredConversations();
    return this.conversations.has(userId);
  }

  /**
   * 대화 상태 조회
   */
  getConversationState(userId: string): ConversationState | undefined {
    return this.conversations.get(userId);
  }
}

// 싱글톤 인스턴스
let conversationManagerInstance: InteractiveConversationManager | null = null;

export function getConversationManager(): InteractiveConversationManager {
  if (!conversationManagerInstance) {
    conversationManagerInstance = new InteractiveConversationManager();
  }
  return conversationManagerInstance;
}