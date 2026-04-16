# SliceTemplate — 슬라이스 파일 작성 템플릿

> 이 파일은 참조용 템플릿입니다. 실제 슬라이스가 아닙니다.
> 신규 슬라이스 파일 작성 시 이 구조를 복사하여 사용하세요.

---

```
---
slice_id: S?
slice_name: ...
architect_id: S?
status: ⚪ 대기
expected_sessions: N
current_progress: 0%
---
```

---

# S? 슬라이스명

## 목표 (Why)

이 슬라이스가 존재하는 이유. 어떤 JTBD 단계를 달성하는가.

## 포함 요구사항

- **Must**: M?, M?
- **엔티티**: E? (R/W/RW), E? (R)
- **라우트**: `/admin/...`
- **신규 엔티티 (신규 스키마 필요)**: (없으면 생략)

## 선행 조건

- 슬라이스: S?(완료) — 이유
- 이벤트: `event.name` 파이프 선행 필요 — 이유

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| API명 | 용도 | mock stub / 실연결 |

## Tasks (체크리스트)

- [ ] T?.1 스키마 + mock fixture 준비
- [ ] T?.2 핵심 UI 컴포넌트 구현
- [ ] T?.3 라우트·페이지 연결
- [ ] T?.4 이벤트 파이프 연결
- [ ] T?.5 DoD 검증

> Tasks는 킥오프 세션에서 세분화합니다. 여기서는 핵심 작업 묶음 수준으로만.

## DoD (Definition of Done)

- [ ] 라우트 접근 시 admin role 가드 통과
- [ ] Mock fixture로 UI 전체 렌더링 오류 없음
- [ ] 핵심 Must AC 전부 통과
- [ ] `npm run build` 오류 0
- [ ] `npm run lint` 경고 0
- [ ] 커밋: `feat(S?): ...`

## 블로커 / 사용자 결정 필요

- **BL-?**: 의제 — ProgressDashboard 참조

## 리스크

- **R?**: 리스크 설명 / 완화: 완화 방법

## 의사결정 로그

- YYYY-MM-DD: (없음)

## 이슈·발견

- (없음)

## 변경 이력

| 날짜 | 내용 |
|---|---|
| YYYY-MM-DD | 생성 |
