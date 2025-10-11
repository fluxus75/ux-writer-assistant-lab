# 🐳 Docker Desktop 무료 오픈소스 대안 가이드

## 📌 왜 대안이 필요한가?

### Docker Desktop 라이선스 제약
Docker Desktop은 다음 조건에 해당하는 회사에서 **유료 구독**이 필요합니다:
- 직원 수 250명 이상
- 연 매출 $10M 이상

**비용**: Pro ($5/월), Team ($7/월), Business (협의)

---

## 🚀 추천 대안: **Podman Desktop**

### 왜 Podman인가?

✅ **100% 무료 오픈소스** - 기업 환경에서도 무료
✅ **Docker 명령어 호환** - `docker` → `podman` 그대로 사용
✅ **docker-compose 지원** - `podman-compose` 또는 `docker-compose` 사용
✅ **보안 강화** - Daemonless, Rootless 컨테이너
✅ **Windows/Mac/Linux 지원** - WSL2 기반
✅ **GUI 제공** - Docker Desktop과 유사한 인터페이스

---

## 1️⃣ Podman Desktop 설치 (Windows)

### 사전 준비
- **Windows 10/11** (64-bit)
- **WSL2** 설치 및 활성화
- **Ubuntu 22.04 LTS** (WSL2에서)

### Step 1: WSL2 설치 (이미 설치된 경우 생략)
```powershell
# PowerShell (관리자 권한)
wsl --install
wsl --set-default-version 2

# Ubuntu 설치
wsl --install -d Ubuntu-22.04
```

**재부팅 후 Ubuntu 초기 설정 (사용자명/비밀번호 설정)**

### Step 2: Podman Desktop 다운로드 및 설치
1. **다운로드**: https://podman-desktop.io/downloads/windows
2. **설치 파일 실행**: `podman-desktop-X.X.X-setup.exe`
3. **설치 진행**: Next → Install → Finish

### Step 3: Podman Desktop 초기 설정
1. **Podman Desktop 실행**
2. **Podman Machine 생성**:
   - "Create Podman Machine" 클릭
   - 메모리: 4GB (권장)
   - CPU: 2 cores (권장)
   - Disk: 50GB
   - "Create" 클릭
3. **Machine 시작**: "Start" 버튼 클릭

### Step 4: WSL2에서 Podman CLI 설치
```bash
# WSL2 Ubuntu 터미널
sudo apt update
sudo apt install -y podman podman-compose

# 설치 확인
podman --version
podman-compose --version
```

### Step 5: Podman과 Docker 호환 설정
```bash
# Docker 명령어를 Podman으로 alias
echo 'alias docker=podman' >> ~/.bashrc
echo 'alias docker-compose=podman-compose' >> ~/.bashrc
source ~/.bashrc

# 확인
docker --version  # Podman 버전 출력
```

---

## 2️⃣ 프로젝트에서 Podman 사용하기

### 기존 docker-compose.yml 그대로 사용!

우리 프로젝트의 `infra/dev/docker-compose.yml`은 Podman과 **100% 호환**됩니다.

```bash
cd /mnt/c/Users/yoons/works/ux-writer-assistant-lab/infra/dev

# Docker Compose → Podman Compose
podman-compose up -d

# 또는 Docker 명령어 그대로 (alias 설정 시)
docker-compose up -d
```

### 컨테이너 관리

```bash
# 컨테이너 목록
podman ps

# 컨테이너 로그
podman logs dev-postgres-1
podman logs dev-qdrant-1

# 컨테이너 재시작
podman restart dev-postgres-1

# 전체 중지
podman-compose down
```

---

## 3️⃣ Podman vs Docker Desktop 비교

| 항목 | Docker Desktop | Podman Desktop |
|------|----------------|----------------|
| **비용** | 유료 (대기업) | 완전 무료 |
| **라이선스** | 제약 있음 | 오픈소스 |
| **아키텍처** | Daemon 기반 | Daemonless |
| **보안** | 표준 | Rootless (강화) |
| **Windows 지원** | ✅ | ✅ (WSL2) |
| **docker-compose** | ✅ | ✅ (podman-compose) |
| **GUI** | ✅ | ✅ |
| **성능** | 우수 | 유사 |

---

## 4️⃣ UX Writer Assistant 프로젝트 실행

### 방법 A: Podman Compose (권장)
```bash
# WSL2 Ubuntu 터미널
cd /mnt/c/Users/yoons/works/ux-writer-assistant-lab/infra/dev

# 완전 초기화
podman-compose down -v
rm -rf dev-data

# 시작
podman-compose up -d

# 상태 확인
podman ps
```

### 방법 B: Podman Desktop GUI
1. **Podman Desktop 열기**
2. **Containers** → **Play Kubernetes/Compose** 클릭
3. **docker-compose.yml** 파일 선택
4. **Play** 클릭

### 연결 확인
```bash
# PostgreSQL
podman exec -it dev-postgres-1 psql -U ux_writer -d ux_writer -c "SELECT version();"

# Qdrant
curl http://localhost:6333/collections
```

---

## 5️⃣ 문제 해결 (Troubleshooting)

### Podman Machine이 시작되지 않음
```bash
# PowerShell
podman machine stop
podman machine rm podman-machine-default
podman machine init
podman machine start
```

### WSL2에서 Podman 연결 오류
```bash
# WSL2 Ubuntu
export DOCKER_HOST="unix:///run/user/1000/podman/podman.sock"
echo 'export DOCKER_HOST="unix:///run/user/1000/podman/podman.sock"' >> ~/.bashrc
```

### 컨테이너가 중지됨
```bash
# 로그 확인
podman logs <container-name>

# 재시작
podman restart <container-name>
```

### 볼륨 권한 문제
```bash
# 데이터 디렉토리 권한 설정
sudo chmod -R 777 dev-data/
```

---

## 6️⃣ 다른 대안들

### Rancher Desktop
- **장점**: Kubernetes 기본 포함, GUI 우수
- **단점**: 더 무거움 (메모리 4GB+)
- **다운로드**: https://rancherdesktop.io/

**설치:**
```powershell
# Windows
winget install rancher-desktop
```

**사용:**
```bash
# dockerd (moby) 선택 → docker-compose 그대로 사용
docker-compose up -d
```

### Minikube
- **장점**: Kubernetes 환경 테스트에 적합
- **단점**: 설정이 복잡함

### Multipass
- **장점**: Ubuntu VM 관리 간편
- **단점**: 컨테이너 직접 지원 없음

---

## 7️⃣ 마이그레이션 체크리스트

### Docker Desktop → Podman Desktop

- [ ] Podman Desktop 설치
- [ ] WSL2 Ubuntu에 podman-compose 설치
- [ ] Docker alias 설정 (`docker=podman`)
- [ ] 기존 docker-compose.yml 테스트
- [ ] PostgreSQL 연결 확인
- [ ] Qdrant 연결 확인
- [ ] 백엔드 서버 연결 확인
- [ ] 데이터 백업 (선택사항)

### 검증 명령어
```bash
# 1. Podman 작동 확인
podman --version
podman ps

# 2. Compose 작동 확인
cd infra/dev
podman-compose up -d
podman-compose ps

# 3. 서비스 연결 확인
curl http://localhost:6333/collections
psql postgresql://ux_writer:ux_writer@localhost:5432/ux_writer -c "SELECT 1;"
```

---

## 8️⃣ 권장 사항

### 개인 개발 환경
- **Docker Desktop** 또는 **Podman Desktop** 모두 좋음
- GUI 선호 시 → **Podman Desktop**

### 회사 환경 (라이선스 제약)
- **Podman Desktop** (1순위 추천)
- **Rancher Desktop** (2순위)

### CI/CD 환경
- **Podman** (Daemonless, Rootless 보안 강화)
- GitHub Actions, GitLab CI와 호환

---

## 9️⃣ 참고 자료

### 공식 문서
- **Podman Desktop**: https://podman-desktop.io/
- **Podman**: https://podman.io/
- **Rancher Desktop**: https://rancherdesktop.io/

### 커뮤니티
- **Podman GitHub**: https://github.com/containers/podman
- **Podman Desktop GitHub**: https://github.com/containers/podman-desktop

### 튜토리얼
- [Podman on WSL2 Tutorial](https://medium.com/devops-tech-2025/how-to-run-podman-on-wsl2-your-complete-tutorial-665fa5309bc9)
- [Docker to Podman Migration](https://docs.podman.io/en/latest/)

---

## 🎯 결론

**Podman Desktop**은 Docker Desktop의 완벽한 무료 대안입니다.

✅ 우리 프로젝트의 `docker-compose.yml`은 수정 없이 그대로 사용 가능
✅ Windows WSL2에서 안정적으로 작동
✅ 회사 환경에서 라이선스 걱정 없이 사용
✅ 보안 강화 (Daemonless, Rootless)

**추천**: 개인 프로젝트는 Docker Desktop, 회사 프로젝트는 Podman Desktop 사용
