// src/models/user-model.ts (사용자 관리 모델)
import { Client } from '@notionhq/client';

export interface UserProfile {
  id: string;
  lineWorksUserId: string;
  email: string;
  name: string;
  displayName: string;
  department: string;
  position: string;
  calendarId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // 추가 정보
  phoneNumber?: string;
  extension?: string;
  manager?: string;
  location?: string;
}

export interface CreateUserRequest {
  lineWorksUserId: string;
  email: string;
  name: string;
  department: string;
  position: string;
  phoneNumber?: string;
  extension?: string;
  manager?: string;
  location?: string;
}

export class UserManagementService {
  private notion: Client;
  private userDatabaseId: string;

  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });
    
    // 새로운 사용자 관리용 Notion 데이터베이스 ID
    this.userDatabaseId = process.env.NOTION_USER_DATABASE_ID || '';
    
    if (!this.userDatabaseId) {
      console.warn('⚠️ NOTION_USER_DATABASE_ID가 설정되지 않았습니다. 사용자 관리 기능이 제한됩니다.');
    }
  }

  /**
   * LINE WORKS 사용자 ID로 사용자 조회
   */
  async getUserByLineWorksId(lineWorksUserId: string): Promise<UserProfile | null> {
    try {
      if (!this.userDatabaseId) {
        // 데이터베이스가 없으면 기본값 반환
        return this.createDefaultUser(lineWorksUserId);
      }

      const response = await this.notion.databases.query({
        database_id: this.userDatabaseId,
        filter: {
          property: 'LINE WORKS ID',
          rich_text: {
            equals: lineWorksUserId
          }
        }
      });

      if (response.results.length === 0) {
        console.log(`🔍 사용자를 찾을 수 없습니다: ${lineWorksUserId}`);
        return this.createDefaultUser(lineWorksUserId);
      }

      const userPage: any = response.results[0];
      return this.parseUserFromNotion(userPage);

    } catch (error) {
      console.error('❌ 사용자 조회 오류:', error);
      return this.createDefaultUser(lineWorksUserId);
    }
  }

  /**
   * 이메일로 사용자 조회
   */
  async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      if (!this.userDatabaseId) {
        return null;
      }

      const response = await this.notion.databases.query({
        database_id: this.userDatabaseId,
        filter: {
          property: '이메일',
          email: {
            equals: email
          }
        }
      });

      if (response.results.length === 0) {
        return null;
      }

      const userPage: any = response.results[0];
      return this.parseUserFromNotion(userPage);

    } catch (error) {
      console.error('❌ 이메일로 사용자 조회 오류:', error);
      return null;
    }
  }

  /**
   * 이름으로 사용자 검색 (참석자 이메일 생성용)
   */
  async findUsersByName(name: string): Promise<UserProfile[]> {
    try {
      if (!this.userDatabaseId) {
        return [];
      }

      // 직급 제거한 이름으로 검색
      const cleanName = name.replace(/[팀장|과장|차장|부장|대리|사원|님|씨]/g, '');

      const response = await this.notion.databases.query({
        database_id: this.userDatabaseId,
        filter: {
          property: '이름',
          title: {
            contains: cleanName
          }
        }
      });

      return response.results.map((page: any) => this.parseUserFromNotion(page));

    } catch (error) {
      console.error('❌ 이름으로 사용자 검색 오류:', error);
      return [];
    }
  }

  /**
   * 새 사용자 등록
   */
  async createUser(userData: CreateUserRequest): Promise<UserProfile | null> {
    try {
      if (!this.userDatabaseId) {
        throw new Error('NOTION_USER_DATABASE_ID가 설정되지 않았습니다.');
      }

      const now = new Date().toISOString();

      const response = await this.notion.pages.create({
        parent: { database_id: this.userDatabaseId },
        properties: {
          '이름': {
            title: [{
              text: { content: userData.name }
            }]
          },
          'LINE WORKS ID': {
            rich_text: [{
              text: { content: userData.lineWorksUserId }
            }]
          },
          '이메일': {
            email: userData.email
          },
          '부서': {
            select: { name: userData.department }
          },
          '직급': {
            select: { name: userData.position }
          },
          '표시명': {
            rich_text: [{
              text: { content: `${userData.name}${userData.position}` }
            }]
          },
          '활성상태': {
            checkbox: true
          },
          '등록일': {
            date: { start: now }
          },
          '수정일': {
            date: { start: now }
          }
        }
      });

      console.log('✅ 새 사용자 등록 완료:', userData.name);
      return this.parseUserFromNotion(response as any);

    } catch (error) {
      console.error('❌ 사용자 등록 오류:', error);
      return null;
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  async updateUser(userId: string, updates: Partial<CreateUserRequest>): Promise<boolean> {
    try {
      if (!this.userDatabaseId) {
        return false;
      }

      const properties: any = {
        '수정일': {
          date: { start: new Date().toISOString() }
        }
      };

      if (updates.name) {
        properties['이름'] = { title: [{ text: { content: updates.name } }] };
      }
      if (updates.email) {
        properties['이메일'] = { email: updates.email };
      }
      if (updates.department) {
        properties['부서'] = { select: { name: updates.department } };
      }
      if (updates.position) {
        properties['직급'] = { select: { name: updates.position } };
      }

      await this.notion.pages.update({
        page_id: userId,
        properties
      });

      console.log('✅ 사용자 정보 업데이트 완료:', userId);
      return true;

    } catch (error) {
      console.error('❌ 사용자 업데이트 오류:', error);
      return false;
    }
  }

  /**
   * 전체 사용자 목록 조회
   */
  async getAllUsers(): Promise<UserProfile[]> {
    try {
      if (!this.userDatabaseId) {
        return [];
      }

      const response = await this.notion.databases.query({
        database_id: this.userDatabaseId,
        filter: {
          property: '활성상태',
          checkbox: {
            equals: true
          }
        },
        sorts: [
          {
            property: '부서',
            direction: 'ascending'
          },
          {
            property: '이름',
            direction: 'ascending'
          }
        ]
      });

      return response.results.map((page: any) => this.parseUserFromNotion(page));

    } catch (error) {
      console.error('❌ 전체 사용자 조회 오류:', error);
      return [];
    }
  }

  /**
   * 부서별 사용자 조회
   */
  async getUsersByDepartment(department: string): Promise<UserProfile[]> {
    try {
      if (!this.userDatabaseId) {
        return [];
      }

      const response = await this.notion.databases.query({
        database_id: this.userDatabaseId,
        filter: {
          and: [
            {
              property: '부서',
              select: {
                equals: department
              }
            },
            {
              property: '활성상태',
              checkbox: {
                equals: true
              }
            }
          ]
        }
      });

      return response.results.map((page: any) => this.parseUserFromNotion(page));

    } catch (error) {
      console.error('❌ 부서별 사용자 조회 오류:', error);
      return [];
    }
  }

  /**
   * Notion 페이지에서 사용자 정보 파싱
   */
  private parseUserFromNotion(page: any): UserProfile {
    const props = page.properties;
    
    return {
      id: page.id,
      lineWorksUserId: props['LINE WORKS ID']?.rich_text?.[0]?.text?.content || '',
      email: props['이메일']?.email || '',
      name: props['이름']?.title?.[0]?.text?.content || '',
      displayName: props['표시명']?.rich_text?.[0]?.text?.content || '',
      department: props['부서']?.select?.name || '',
      position: props['직급']?.select?.name || '',
      calendarId: props['캘린더 ID']?.rich_text?.[0]?.text?.content || undefined,
      isActive: props['활성상태']?.checkbox || false,
      createdAt: props['등록일']?.date?.start || '',
      updatedAt: props['수정일']?.date?.start || '',
      phoneNumber: props['전화번호']?.phone_number || undefined,
      extension: props['내선번호']?.rich_text?.[0]?.text?.content || undefined,
      manager: props['상급자']?.rich_text?.[0]?.text?.content || undefined,
      location: props['근무지']?.select?.name || undefined
    };
  }

  /**
   * 기본 사용자 생성 (데이터베이스가 없거나 사용자를 찾을 수 없을 때) - 개선된 버전
   */
  private createDefaultUser(lineWorksUserId: string): UserProfile {
    const now = new Date().toISOString();
    
    // LINE WORKS ID에서 더 나은 기본 이름 생성
    let defaultName = lineWorksUserId;
    
    // UUID 형태면 "미등록 사용자"로 표시
    if (lineWorksUserId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
      defaultName = '미등록 사용자';
    }
    
    console.log(`⚠️ 사용자 정보를 찾을 수 없어 기본 사용자 생성: ${lineWorksUserId} → ${defaultName}`);
    
    return {
      id: `default-${lineWorksUserId}`,
      lineWorksUserId,
      email: `${defaultName}@anyractive.co.kr`,
      name: defaultName,
      displayName: `${defaultName} (미등록)`,
      department: '미정',
      position: '사원',
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * 스마트 이메일 생성 (참석자용)
   */
  async generateEmailForAttendee(attendeeName: string): Promise<string> {
    try {
      // 1. 정확한 이름으로 검색
      const users = await this.findUsersByName(attendeeName);
      
      if (users.length > 0) {
        // 가장 유사한 사용자 반환
        const bestMatch = users.find(user => 
          user.name === attendeeName || 
          user.displayName === attendeeName
        ) || users[0];
        
        console.log(`✅ 참석자 이메일 찾음: ${attendeeName} → ${bestMatch.email}`);
        return bestMatch.email;
      }

      // 2. 사용자를 찾을 수 없으면 기본 형식으로 생성
      const cleanName = attendeeName.replace(/[팀장|과장|차장|부장|대리|사원|님|씨]/g, '');
      const defaultEmail = `${cleanName}@anyractive.co.kr`;
      
      console.log(`⚠️ 참석자를 찾을 수 없어 기본 이메일 생성: ${attendeeName} → ${defaultEmail}`);
      return defaultEmail;

    } catch (error) {
      console.error('❌ 참석자 이메일 생성 오류:', error);
      // 오류 시 기본 형식 반환
      const cleanName = attendeeName.replace(/[팀장|과장|차장|부장|대리|사원|님|씨]/g, '');
      return `${cleanName}@anyractive.co.kr`;
    }
  }
}

// 싱글톤 인스턴스 생성
export const userService = new UserManagementService();