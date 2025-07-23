const fs = require('fs');
const path = require('path');

function analyzeComplexity(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // 복잡도 지표 계산
  const metrics = {
    fileName: path.basename(filePath),
    totalLines: lines.length,
    codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,
    functions: (content.match(/function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(/g) || []).length,
    classes: (content.match(/class\s+\w+/g) || []).length,
    imports: (content.match(/^import\s+/gm) || []).length,
    exports: (content.match(/^export\s+/gm) || []).length,
    ifStatements: (content.match(/if\s*\(/g) || []).length,
    switchCases: (content.match(/case\s+/g) || []).length,
    cyclomaticComplexity: 1 // 기본값
  };
  
  // 순환 복잡도 계산 (간단한 버전)
  metrics.cyclomaticComplexity += metrics.ifStatements;
  metrics.cyclomaticComplexity += metrics.switchCases;
  metrics.cyclomaticComplexity += (content.match(/\?\s*:/g) || []).length; // 삼항 연산자
  metrics.cyclomaticComplexity += (content.match(/\|\||\&\&/g) || []).length; // 논리 연산자
  
  return metrics;
}

// src/tools 디렉토리 분석
const toolsDir = './src/tools';
const files = fs.readdirSync(toolsDir)
  .filter(f => f.endsWith('.ts'))
  .map(f => path.join(toolsDir, f));

console.log('\n📊 코드 복잡도 분석\n');
console.log('파일명 | 전체라인 | 코드라인 | 함수 | 복잡도');
console.log('-------|---------|---------|------|-------');

const results = files.map(analyzeComplexity);
results.sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);

results.forEach(r => {
  const complexity = r.cyclomaticComplexity > 20 ? `⚠️ ${r.cyclomaticComplexity}` : r.cyclomaticComplexity;
  console.log(
    `${r.fileName.padEnd(25)} | ${String(r.totalLines).padEnd(7)} | ${String(r.codeLines).padEnd(7)} | ${String(r.functions).padEnd(4)} | ${complexity}`
  );
});

// 요약 통계
console.log('\n📈 요약:');
console.log(`총 파일 수: ${results.length}`);
console.log(`총 코드 라인: ${results.reduce((sum, r) => sum + r.codeLines, 0)}`);
console.log(`총 함수 수: ${results.reduce((sum, r) => sum + r.functions, 0)}`);
console.log(`평균 복잡도: ${Math.round(results.reduce((sum, r) => sum + r.cyclomaticComplexity, 0) / results.length)}`);

// 리팩토링 우선순위
console.log('\n🔥 리팩토링 우선순위 (복잡도 기준):');
results.slice(0, 3).forEach((r, i) => {
  console.log(`${i + 1}. ${r.fileName} (복잡도: ${r.cyclomaticComplexity})`);
});