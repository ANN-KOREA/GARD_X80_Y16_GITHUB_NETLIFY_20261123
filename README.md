# GARD X80 → Y16 Score Reconstruction Factory

기존 ChatGPT Sites 앱을 **독립 GitHub 저장소 + Netlify 정적 웹앱**으로 이전하는 완전한 소스입니다. 원본 v5의 화면, X80 입력, M0 공식, 16개 Frozen ML 모델과 로컬 계산 기록을 포함합니다.

**추천 저장소 이름: `GARD-X80-Y16-SCORE-FACTORY`**

## 바로 시작

1. 이 폴더의 **내용 전체**를 GitHub 새 저장소의 루트에 올립니다. `package.json`, `netlify.toml`, `index.html`이 저장소 첫 화면에 보여야 합니다.
2. Netlify에서 **Add new project → Import a Git repository → GitHub**를 선택합니다.
3. 위 저장소를 선택하고 Build command **`npm run build`**, Publish directory **`dist`**를 확인합니다. Base directory는 비워 둡니다.
4. 배포 후 가상 사례를 선택하고 **16개 Frozen ML 계산**을 누릅니다.

원본의 학습완료 모델은 `public/models/`에 실제 바이너리로 포함되어 있습니다. 이 폴더를 빼면 ML 계산이 작동하지 않습니다. 데이터베이스, 유료 AI API, ChatGPT 계정, API 키, Netlify Functions, Netlify Identity 설정은 필요하지 않습니다.

현재 산출물은 파일 패키지입니다. GitHub 원격 저장소 생성·업로드 및 Netlify 실제 배포는 아직 수행하지 않았습니다.

## 유지한 기능

| 기능 | 구현 |
|---|---|
| 80개 X 입력 | 핵심 11개 / 전체 80개, 그룹별 입력 |
| 입력 정리 | 원본 품질 게이트, 결측 정리, Score 열 입력 제외 |
| ML 계산 | 16개 고정 모델을 브라우저에서 추론 |
| M0 기준선 | 16개 공식, 매뉴얼 소견, ML과 단계 차이 비교 |
| 성별 적용성 | 전립선암 M, 유방암·난소암 F, 그 외 구조적 NA |
| 파일 입출력 | JSON 입력 / 현재 결과 JSON·CSV / 최대 100행 일괄 CSV 계산 |
| 로컬 기록 | 최대 100건 저장·불러오기·삭제·전체 JSON 내보내기 |
| 기록 이전 | 기존 전체 기록 JSON을 가져와 병합·복원, ID 중복 처리 |
| 출력 | 브라우저 인쇄 및 PDF 저장 |

## 로컬 실행

Node.js 22.13 이상이 필요합니다. Windows에서는 `run_local_windows.bat`을 실행하거나 아래 명령을 사용합니다.

```bash
npm ci
npm run dev
```

개발 주소는 터미널에 표시됩니다. 배포할 결과물을 만들 때:

```bash
npm run check
```

테스트와 타입 검사, 16개 모델 SHA-256 검사를 마친 뒤 `dist/`를 생성합니다. 결과물만 확인하려면 `npm run preview`를 사용합니다. `index.html`을 파일 더블클릭으로 실행하지 말고 HTTP 서버 또는 Netlify에서 여세요.

## 이전 전 확인할 두 가지

**기록:** 브라우저 저장소는 주소별로 분리됩니다. 기존 사이트의 **로컬 기록 → 전체 내보내기**로 JSON을 내려받고, 새 앱의 **입력·계산 → JSON / CSV 가져오기**에서 선택하세요. 저장하지 않은 입력은 기존 사이트에서 현재 결과 JSON으로 따로 내보냅니다. 원본 기록을 자동으로 가져오지는 않습니다.

**접근권한:** 원본은 ChatGPT 워크스페이스 접근제어를 사용했습니다. 이 정적판에는 해당 로그인 장벽이 포함되지 않습니다. GitHub 비공개 저장소와 Netlify 방문자 접근제어는 서로 다른 설정입니다. 웹앱을 공개하면 방문자가 JavaScript와 16개 모델 바이너리를 내려받을 수 있습니다. 모델의 비밀 유지가 필요하면 배포 전 호스팅 접근제어를 적용해야 합니다.

## 계산 결과의 의미

Y16은 기존 전문가 Final Score의 재구성 값입니다. 암 확진, 질환 발생확률, 임상 민감도·특이도나 치료 판단값이 아닙니다. 원본의 검증 수치는 역사적 메타데이터로 보존했습니다. 이번 이전에서 새로 확인한 것은 **모델 파일 동일성, 내장 smoke 기대값 재현, 계산·기록·입출력 동작**입니다. 원본 학습자료·병리 결과·추적 outcome은 이 패키지에 포함되어 있지 않습니다.

## 주요 파일

| 경로 | 역할 |
|---|---|
| `app/page.tsx` | 원본 UI 기반 입력·계산·기록·검증 화면 |
| `app/globals.css` | 원본 색상과 반응형 스타일, 글자 크기 개선 |
| `lib/score-engine.ts` | 원본과 바이트가 같은 M0 공식·X80 스키마 |
| `lib/ml-runtime.ts` | 원본과 바이트가 같은 portable ML 실행기 |
| `public/models/registry.json` | 16개 모델 목록과 원본 해시 |
| `public/models/stage1.json` … `stage16.json` | 전처리·적용성·검증 메타데이터 |
| `public/models/stage1.bin` … `stage16.bin` | 실제 학습완료 모델 16개 |
| `index.html`, `main.tsx`, `vite.config.ts` | 독립 실행 진입점과 빌드 |
| `netlify.toml`, `public/_headers` | Netlify 빌드·보안·캐시 설정 |
| `package.json`, `package-lock.json` | 고정 버전 의존성과 실행 명령 |
| `.github/workflows/ci.yml` | GitHub에서 자동 테스트·빌드 |
| `scripts/verify-models.mjs`, `tests/factory.test.mjs` | 모델 누락·변조·추론 회귀 검사 |
| `examples/` | 가상 사례 JSON·CSV와 빈 X80 템플릿 |
| `docs/DEPLOY_KO.md` | GitHub·Netlify 상세 절차와 오류 해결 |
| `docs/MIGRATION_KO.md` | 변경점, 기록 이전, 접근제어 설명 |
| `docs/VERIFICATION_KO.md` | 이번 검증 범위와 한계 |
| `docs/source-provenance.json` | 원본 버전·커밋·33개 모델 자산 해시 |
| `docs/x80-data-contract.csv` | 정확한 입력 열 이름·그룹·형식 |
| `FILE_MANIFEST.json`, `SHA256SUMS.txt` | 소스 파일 전수 목록과 무결성 |

## 운영 원칙

입력값과 기록은 해당 브라우저의 localStorage에 저장합니다. 이 앱은 입력 전송 API, 원격 분석 도구나 계정 동기화를 포함하지 않습니다. 페이지와 모델을 내려받는 HTTP 요청은 발생하며 호스팅 사업자는 일반 접속 로그를 남길 수 있습니다. 브라우저 저장소 자체는 암호화 금고가 아니므로 공용 기기 사용 시 기록 관리가 필요합니다.

실제 개인 데이터, 기록 백업 JSON, API 키는 저장소에 올리지 마세요. 모델 교체 시 레지스트리와 관련 메타데이터·해시도 함께 갱신하고 `npm run check`를 실행하세요. 브라우저에서 저장한 입력을 바꾸면 ML 결과를 초기화하며, 계산 중에는 입력 변경을 막습니다.

## 참고

- [원본 사이트](https://x80-y16-score-factory.gard-7199.chatgpt.site)
- [Netlify의 Git 저장소 배포 안내](https://docs.netlify.com/start/quickstarts/deploy-from-repository/)
- [Netlify의 Vite 안내](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)
- [Vite 정적 배포 안내](https://vite.dev/guide/static-deploy.html#netlify)

작성일: 2026-11-23 / 원본 사이트 버전: 5 / 이전판: 1.0.0
