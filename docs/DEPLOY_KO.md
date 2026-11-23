# GitHub → Netlify 배포 절차

## 1. GitHub 저장소 만들기

GitHub에서 New repository를 누르고 `GARD-X80-Y16-SCORE-FACTORY`처럼 구별되는 이름을 사용합니다. 기본 선택은 Private를 권합니다. README 초기 생성은 하지 않아도 됩니다. 빈 저장소를 만든 후 이 패키지의 소스를 업로드합니다.

이 안내는 사용자가 새 저장소를 생성하는 절차입니다. 제공 ZIP 자체가 원격 저장소 생성이나 Netlify 연결을 수행한 것은 아닙니다.

## 2. 파일 업로드

GitHub 화면에서는 **Add file → Upload files**로 소스 폴더 내부 항목을 올립니다. 저장소 루트에 `package.json`, `package-lock.json`, `index.html`, `netlify.toml`이 직접 보여야 합니다. 패키지 전체 ZIP을 파일 하나로 올리면 Netlify가 소스를 빌드할 수 없습니다.

`public/models/`의 33개 자산을 반드시 포함합니다. 개별 모델 파일은 약 1.9~6.4MB입니다. GitHub 웹 업로드 시 문제가 생기면 GitHub Desktop으로 빈 저장소를 복제하고 파일을 복사한 뒤 Commit·Push합니다. `.github`, `.gitignore`, `.gitattributes`, `.nvmrc` 등 점으로 시작하는 항목도 함께 복사합니다. Windows에서 숨겨진 항목 표시를 켜면 확인하기 쉽습니다.

터미널을 사용하는 경우, 이미 생성한 실제 저장소 URL을 마지막 줄의 주소에 넣습니다. 아래 예시는 주소를 대신 생성하지 않습니다.

```bash
git init -b main
git add .
git commit -m "Migrate X80 Y16 factory to GitHub and Netlify"
git remote add origin YOUR_ACTUAL_GITHUB_REPOSITORY_URL
git push -u origin main
```

## 3. Netlify 연결

Netlify 팀 화면에서 **Add new project → Import a Git repository → GitHub**를 선택하고 위 저장소의 접근을 허용합니다. 저장소 목록에 없으면 Netlify의 GitHub 설치 권한에서 해당 저장소를 추가합니다.

| 설정 | 값 |
|---|---|
| Production branch | `main` |
| Base directory | 비움 |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node.js | 22 (`netlify.toml`, `.nvmrc` 포함) |
| Environment variables | 필수 항목 없음 |
| Functions directory | 별도 설정 없음 |
| Identity | 사용하지 않음 |

Deploy/Publish를 실행합니다. 이후 main에 Push하면 Netlify가 다시 빌드합니다. Netlify 서비스 요금과 공개범위는 계정 설정에 따릅니다.

## 4. 첫 실행 검수

1. 새 Netlify 주소를 엽니다.
2. 기본 가상 사례에서 **16개 Frozen ML 계산**을 누릅니다. 처음에는 약 60MB의 모델·메타데이터를 같은 사이트에서 내려받으므로 기다립니다.
3. 16개 결과와 선택 항목의 M0 매뉴얼 소견을 확인합니다. 적용되지 않는 성별 Target은 NA입니다.
4. **ML 결과·M0 소견 저장** 후 **로컬 기록**에서 확인합니다.
5. JSON·CSV 내보내기와 전체 기록 내보내기·가져오기를 시험합니다.
6. `examples/x80-synthetic-3-cases.csv`를 가져와 3행 일괄 결과 CSV가 만들어지는지 확인합니다.

## 빌드 없이 임시 확인하기

함께 제공한 `NETLIFY_DROP_READY.zip`은 빌드 완료 결과입니다. 압축을 풀면 `index.html`, `assets/`, `models/`, `_headers`가 직접 있는 폴더가 됩니다. Netlify의 수동 배포 영역에 그 폴더를 넣으면 됩니다. 이것은 GitHub 연결 배포와 별개이며, 이후 GitHub 자동 배포를 쓰려면 위 연결 절차가 필요합니다.

## 문제 해결

| 증상 | 확인·해결 |
|---|---|
| `package.json`을 찾지 못함 | 소스 폴더를 통째로 중첩 업로드했는지 확인. 루트에 파일이 직접 있어야 함 |
| Vite 또는 TypeScript 버전 오류 | Node.js 22.13 이상과 원본 `package-lock.json` 사용, `npm ci` 재실행 |
| 모델 로딩 실패 | `public/models` 파일 누락 여부 확인. 새 주소의 `/models/registry.json`이 JSON을 반환하는지 확인 |
| SHA 검증 실패 | 모델 `.bin` 변형·누락 여부 확인. ZIP 원본에서 해당 모델과 메타데이터 복구 |
| 모델 대신 HTML이 반환됨 | 무조건 `/* → /index.html`로 보내는 강제 redirect를 추가하지 말 것. 이 앱은 단일 루트 화면이어서 SPA fallback이 필요 없음 |
| 기존 기록이 보이지 않음 | 주소별 저장소가 다름. 기존 전체 기록 JSON을 새 앱에서 가져오기 |
| CSV가 거부됨 | 정확한 X80 헤더 사용. 빈 파일·중복 헤더·100행 초과 파일은 수정 |
| `index.html` 더블클릭 후 빈 화면 | HTTP 서버/Netlify에서 실행. `file://` 실행 미지원 |
| 비공개 GitHub인데 앱은 누구나 열림 | 저장소 접근권한과 호스팅 방문자 접근권한을 각각 설정 |

설정 근거: [Netlify Git 배포](https://docs.netlify.com/start/quickstarts/deploy-from-repository/), [Netlify Vite](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/), [Vite 정적 배포](https://vite.dev/guide/static-deploy.html#netlify). 확인일 2026-11-23.
