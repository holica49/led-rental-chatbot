FROM node:18-alpine

WORKDIR /app

# package.json과 package-lock.json만 먼저 복사
COPY package*.json ./

# npm install 사용 (ci 대신)
RUN npm install

# 소스 코드 복사
COPY . .

# TypeScript 빌드
RUN npm run build

# 포트 설정
EXPOSE 3000

# 서버 실행
CMD ["npm", "start"]