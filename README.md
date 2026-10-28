# 비상장비 Web NFC 매니저 (Emergency Equipment NFC Tool)

안드로이드 크롬(Chrome for Android) 환경에서 동작하는 **비상장비 관리용 Web NFC(W3C 표준 `NDEFReader`) 읽기/쓰기 모바일 웹 애플리케이션**입니다.
별도 서드파티 런타임 라이브러리 없이 순수 브라우저 Web NFC API와 Vite + Vanilla TypeScript 기반으로 구축되었습니다.

---

## ⚠️ 모바일 테스트 시 필수 주의사항 (Web NFC 보안 정책)

> **Web NFC API는 엄격한 Secure Context (`window.isSecureContext === true`)를 요구합니다.**  
> 동일 Wi-Fi 상에서 PC의 사설 IP(예: `http://192.168.x.x:5173`)로 스마트폰 브라우저에 접속하면, 브라우저 보안 정책상 **Insecure Context**로 분류되어 `NDEFReader` API 호출이 전면 차단(`SecurityError` 또는 `undefined`)됩니다.

### 권장 해결 방안 2가지

#### 방법 1. Chrome DevTools Port Forwarding (로컬 테스트 시 추천 ⭐)
스마트폰과 PC를 USB로 연결한 후 `localhost`로 터널링하면, 폰 브라우저에서도 `localhost`를 **보안 컨텍스트(Secure Context)**로 인정하여 권한 에러 없이 즉시 동작합니다.

1. 안드로이드 스마트폰 설정에서 **[개발자 옵션] &rarr; [USB 디버깅]** 활성화
2. PC와 스마트폰을 USB 케이블로 연결
3. 로컬 Vite 개발 서버 실행:
   ```bash
   npm run dev
   ```
4. PC의 Google Chrome 브라우저에서 주소창에 아래 주소 입력:
   ```text
   chrome://inspect/#devices
   ```
5. **Port forwarding...** 버튼 클릭 후 설정 추가:
   - **Port**: `5173`
   - **IP address and port**: `localhost:5173`
   - **Enable port forwarding** 체크 후 Done
6. 안드로이드 폰의 Chrome 브라우저를 열고 주소창에 접속:
   ```text
   http://localhost:5173
   ```
7. 앱 상단에 `⚡ Web NFC 준비 완료 (Ready)` 녹색 배지가 뜨며 정상 작동합니다.

#### 방법 2. Vercel 배포 (현장 실전 배포 추천 ⭐)
- Vercel, Cloudflare Pages 등으로 배포하면 자동으로 유효한 **HTTPS 인증서**가 적용되므로 스마트폰에서 URL로 바로 접속하여 사용 가능합니다.
- `vercel` CLI 또는 GitHub 연동 후 바로 배포할 수 있습니다:
  ```bash
  npx vercel
  ```

---

## 주요 기능 및 사양

1. **탭 1: 운영자 쓰기 모드 (Admin Write)**
   - 빠른 장비 프리셋 버튼 지원: AED(자동심장충격기), 소화기(EXT), 완강기(ESC), 구급함(MED)
   - 장비 고유 식별자(`AED-01` 등) 및 점검 상세 URL 입력
   - NDEF 표준 레코드 기록:
     - `recordType: "url"`: 스마트폰 기본 카메라/NFC 터치 시 웹 브라우저가 바로 열리도록 유도
     - `recordType: "text"`: 장비 ID 및 부가 메타데이터 백업 기록
   - 햅틱 피드백 (`navigator.vibrate`) 연동

2. **탭 2: 현장 점검자 읽기 모드 (Inspector Read)**
   - NFC 스캔 시작/중지 토글 컨트롤 및 실시간 레이더 펄스 인디케이터
   - 태그 접촉 시 감지된 장비 ID, UID(Serial Number), 점검 URL, 시각을 카드 형태로 즉시 렌더링
   - `[점검 페이지로 바로 이동]` 원클릭 액션 버튼
   - 최근 스캔 내역 로컬스토리지(LocalStorage) 자동 영속화

3. **시스템 로그 실시간 콘솔**
   - NDEF 이벤트, 통신 성공/오류(권한 거부, 규격 불일치 등) 타임스탬프 로깅
   - 로그 복사 및 비우기 기능

---

## 프로젝트 구조

```text
NFC_TOOL/
├── index.html              # 모바일 최적화 시맨틱 HTML 및 주의사항 배너
├── src/
│   ├── main.ts             # 애플리케이션 진입점 및 탭 제어
│   ├── nfc/
│   │   ├── nfc-service.ts  # Web NFC NDEFReader API 래퍼 & 햅틱 & 에러 포맷
│   │   └── types.ts        # 타입 정의 (ScanResult, EquipmentInfo 등)
│   ├── ui/
│   │   ├── admin-view.ts   # 운영자 태그 쓰기 모듈
│   │   ├── inspector-view.ts # 점검자 태그 스캔/결과 카드/히스토리 모듈
│   │   └── logger-view.ts  # 실시간 시스템 로그 콘솔
│   └── styles/
│       └── main.css        # Linear/Toss TDS 스타일 모던 다크모드 CSS
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 로컬 개발 서버 실행

```bash
npm run dev
```
기본 접속 주소: `http://localhost:5173`
