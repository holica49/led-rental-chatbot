import { Request, Response } from 'express';
import { sessionManager } from './session/session-manager';
import { processUserMessage } from './message-processor';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { QuickReply } from '../types';  // 기존 타입 import

interface KakaoRequest {
  userRequest?: {
    user?: {
      id?: string;
    };
    utterance?: string;
  };
}

interface KakaoSkillResponse {
  version: string;
  template: {
    outputs: Array<{
      simpleText: {
        text: string;
      };
    }>;
    quickReplies?: QuickReply[];
  };
}

export const kakaoChatbotTool = {
  name: 'kakao_chatbot',
  description: 'Kakao chatbot for LED rental/installation quotes',
  
  inputSchema: {
    type: 'object' as const,
    properties: {
      request: {
        type: 'object',
        description: 'Kakao skill request object'
      }
    },
    required: ['request']
  },

  handler: async (args: { request: unknown }) => {
    try {
      const kakaoRequest = args.request as KakaoRequest;
      
      // 사용자 ID 추출
      const userId = kakaoRequest.userRequest?.user?.id;
      if (!userId) {
        throw new McpError(ErrorCode.InvalidRequest, 'User ID not found');
      }

      // 사용자 메시지 추출
      const utterance = kakaoRequest.userRequest?.utterance || '';
      
      // 세션 가져오기
      const session = sessionManager.getSession(userId);
      
      // 메시지 처리
      const response = await processUserMessage(utterance, session);
      
      // Kakao 응답 형식으로 변환
      const kakaoResponse: KakaoSkillResponse = {
        version: '2.0',
        template: {
          outputs: [{
            simpleText: {
              text: response.text
            }
          }]
        }
      };
      
      // 빠른 응답 추가
      if (response.quickReplies && response.quickReplies.length > 0) {
        kakaoResponse.template.quickReplies = response.quickReplies;
      }
      
      return kakaoResponse;
      
    } catch (error) {
      console.error('Kakao chatbot error:', error);
      
      // 에러 응답
      const errorResponse: KakaoSkillResponse = {
        version: '2.0',
        template: {
          outputs: [{
            simpleText: {
              text: '죄송합니다. 일시적인 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.'
            }
          }],
          quickReplies: [{
            label: '처음으로',
            action: 'message',
            messageText: '처음부터'
          }]
        }
      };
      
      return errorResponse;
    }
  }
};

// Express 라우트 핸들러 (별도 사용 시)
export async function handleKakaoWebhook(req: Request, res: Response) {
  try {
    const result = await kakaoChatbotTool.handler({ request: req.body });
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      version: '2.0',
      template: {
        outputs: [{
          simpleText: {
            text: '오류가 발생했습니다. 다시 시도해주세요.'
          }
        }]
      }
    });
  }
}