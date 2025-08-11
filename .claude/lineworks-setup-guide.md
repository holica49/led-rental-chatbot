# LINE WORKS Bot 설정 가이드

## 🚨 현재 상황 (2025-08-11)

### 완료된 작업
1. ✅ 기존 `led-rental-mcp` 프로젝트에 LINE WORKS 기능 추가
2. ✅ 필요한 패키지 설치 (`jsonwebtoken`, `axios`, `@notionhq/client`)
3. ✅ 코드 작성 완료
   - `src/config/lineworks-auth.ts`
   - `src/tools/lineworks-bot.ts`
   - `src/test-lineworks-auth.ts`

### 현재 문제
```
❌ Access token 발급 실패: {
  error_description: 'Request scope is not valid.',
  error: 'invalid_scope'
}
```

## 🔧 해결 방법

### 1. LINE WORKS Console 설정

#### A. OAuth Scopes 설정
```
경로: Console > API > Client App > OAuth Scopes
필요한 권한:
- ✅ bot (봇 기본 권한)
- ✅ bot.message (메시지 송수신)
- ✅ user.read (사용자 정보 조회)
- ✅ orgunit.read (조직 정보 조회) - 선택사항
```

#### B. Private Key 다운로드
```
경로: Console > API > Client App > 인증정보
1. Private Key 섹션에서 다운로드
2. 파일명: private_key.pem
3. 프로젝트 루트에 저장
```

#### C. Service Account 확인
```
경로: Console > API > Service Account
- Service Account ID 확인
- 상태: 활성
```

### 2. 프로젝트 설정

#### A. Private Key 파일 배치
```
led-rental-mcp/
├── src/
├── .env
├── .gitignore
└── private_key.pem  ← 여기에 저장
```

#### B. .gitignore 업데이트
```
# LINE WORKS
private_key.pem
*.pem
```

#### C. .env 파일 확인
```env
# LINE WORKS Bot
LINEWORKS_BOT_ID=10569178
LINEWORKS_BOT_SECRET=새로운_시크릿_키_입력
LINEWORKS_DOMAIN_ID=92438
LINEWORKS_SERVICE_ACCOUNT_ID=서비스_계정_ID_(있다면)
```

### 3. 코드 수정 필요 사항

`src/config/lineworks-auth.ts`의 `getPrivateKey()` 메서드:
```typescript
private getPrivateKey(): string {
  // Private Key 파일에서 읽기
  const keyPath = path.join(process.cwd(), 'private_key.pem');
  return fs.readFileSync(keyPath, 'utf8');
}
```

## 📋 체크리스트

- [ ] Bot Secret 재발급 (노출됨)
- [ ] OAuth Scopes 설정
- [ ] Private Key 다운로드
- [ ] private_key.pem 파일 프로젝트에 저장
- [ ] .env 파일 업데이트
- [ ] 인증 테스트 실행: `npm run test:lineworks`

## 🧪 테스트 명령어

```bash
# 인증 테스트
npm run test:lineworks

# 서버 실행
npm run dev

# Railway 배포
git add .
git commit -m "Add LINE WORKS bot"
git push
```

## 📌 주의사항

1. **Bot Secret이 GitHub에 노출되었으므로 반드시 재발급 필요**
2. **Private Key는 절대 Git에 커밋하지 말 것**
3. **ES Module 프로젝트이므로 모든 import에 .js 확장자 필수**

## 🔗 참고 링크

- [LINE WORKS Bot API 문서](https://developers.worksmobile.com/kr/docs/bot)
- [LINE WORKS 인증 가이드](https://developers.worksmobile.com/kr/docs/auth-oauth)

## 📞 LINE WORKS Bot 엔드포인트

Railway 배포 후:
```
Webhook URL: https://your-app.up.railway.app/lineworks/callback
```

이 URL을 LINE WORKS Console의 Bot 설정에서 Callback URL로 등록해야 함.