# hena — 명세

상태: 초안 v0.2 (인터뷰 기반 + 리뷰 반영, 구현 이전)
날짜: 2026-06-12
라이선스: MIT
npm 스코프: `@hena-dev/*`

---

## 1. hena란 무엇인가

hena는 오픈 소스 **헤드리스 에이전트 런타임(headless agent runtime)**이다.
서버 우선(server-first) 하니스로서, 에이전트 루프를 가능한 한 작게 유지하고
**나머지 모든 것 — 대부분의 하니스가 핵심이라고 여기는 것들까지 포함하여 — 을
확장(extension)**으로 만든다.

이 프로젝트를 정의하는 세 가지 약속:

1. **진정으로 최소한의 코어 루프.** 커널은 정확히 §3의 목록이다: 턴 루프와
   그 직접적 어포던스(타입이 지정된 이벤트, 트랜스크립트, 도구 디스패치/검증,
   스티어링/후속, ask, 훅 디스패치, 에러 분류, 컨텍스트 회계, 취소), 그리고
   확장 레지스트리와 설정 로딩. 그 외에 특권을 가진 것은 없다.
2. **모든 것은 수정 가능한 인터페이스 뒤의 확장이다.** 프로바이더, 영속화,
   권한, 압축(compaction), 재시도, 도구(심지어 `read`와 `grep`까지), 스킬,
   시스템 프롬프트, 텔레메트리, HTTP 서버, 기본 웹 UI까지 모두 확장이다.
   퍼스트파티(first-party) 확장은 모노레포 안에 있지만 오직 공개 API만
   사용한다 — 솔기(seam)가 실재함을 의도적으로 증명하는 교체 가능한 증거이다.
3. **자기 개선(self-improvement).** 에이전트는 자신이 실행 중인 하니스를 확장할
   수 있다: 퍼스트파티 `self-dev` 확장은 에이전트가 새 확장을 스캐폴딩하고,
   작성하고, 테스트하고, 자신의 프로세스에 핫 로드(hot-load)하도록 해주며,
   이는 승인(approval)으로 게이팅된다.

### 1.1 레퍼런스 프로젝트에서 얻은 교훈

이 설계에 앞서 두 개의 오픈 소스 하니스를 연구했다:

- **opencode** (SST): 어디에나 Effect를 사용; 매 반복마다 영속화된 상태에서
  "다음에 무엇을 할지"를 다시 도출하는 DB 기반 `while(true)` 루프; 트랜잭션
  프로젝터를 갖춘 이벤트 소싱(event-sourced) SQLite 영속화; 순차 변형(mutation)
  플러그인 훅 약 20개; 1,400줄짜리 프로바이더 quirk 변환 계층을 가진 AI SDK v6.
  채택: 프로젝션을 갖춘 이벤트 소싱 영속화, 타입이 지정된 에러 분류 체계,
  구조화된 인터럽션, 일시 중단(suspension) 프리미티브로서의 ask/승인, 스키마에서
  파생된 와이어 프로토콜. 회피: 저장소와 결합된 코어 루프, 갓 파일(god-file)
  (`prompt.ts`, 1,722줄), 타임아웃 없는 훅 디스패치, V1/V2 이중 쓰기 마이그레이션
  부채, 런타임 npm 설치.
- **pi** (badlogic): 742줄짜리 인메모리 루프; 88줄짜리 `EventStream`
  프리미티브; "스트림은 절대 throw하지 않는다 — 에러는 데이터이다"; 재시도와
  압축이 루프 *바깥*에 존재; 스티어링(steering)/후속(follow-up) 큐; 추가
  전용(append-only) JSONL 세션 트리; 확장 언어로서의 TypeScript; 코어에 MCP/권한/
  서브에이전트 없음. 채택: 인메모리 리듀서 루프, 데이터로서의 에러, 메커니즘
  바깥의 정책, 스티어링/후속 큐, 명령형 ExtensionAPI, 테스트용 스크립트 가짜
  프로바이더, 간결한 기본 도구 세트와 프롬프트. 회피: 모놀리식 세션/대화형 계층
  (3.1k/5.7k줄), 유일한 메커니즘으로서의 정규식 전용 에러 분류, 중복된 압축/세션
  코드.

---

## 2. 아키텍처 개요

```
┌────────────────────────────────────────────────────────────────┐
│  clients (default Web UI extension, community UIs, scripts)    │
└──────────────▲─────────────────────────────────────────────────┘
               │  HTTP + SSE (schema-derived typed protocol)
┌──────────────┴─────────────────────────────────────────────────┐
│  @hena-dev/extensions/server        (extension)                │
├────────────────────────────────────────────────────────────────┤
│  extensions: provider · persistence-sqlite · permissions ·     │
│  compaction · recovery · tools (read/write/edit/bash/…) ·      │
│  skills · system-prompt · subagents · self-dev · telemetry ·   │
│  provider-script · web-ui                                      │
├────────────────────────────────────────────────────────────────┤
│  @hena-dev/core (the kernel)                                   │
│  turn loop · event protocol · transcript · tool dispatch ·     │
│  steering/follow-up · ask primitive · hook dispatcher ·        │
│  extension registry · config loader                            │
├────────────────────────────────────────────────────────────────┤
│  Effect v4 (effect-smol) · AI SDK v7 · Bun                     │
└────────────────────────────────────────────────────────────────┘
```

- **정체성:** 헤드리스 런타임/서버 우선. UI(우리 것을 포함하여)는 프로토콜
  클라이언트다. `hena` 바이너리는 코어 + 설정된 확장들을 부팅하고 프로토콜을
  제공한다.
- **Effect 경계:** 코어 내부(루프, 서비스, 동시성, 인터럽션, 스팬)는 Effect
  (v4 / effect-smol)이다. **확장 API는 일반 Promise/AsyncIterable**이며 — 확장
  작성자는 Effect를 결코 보지 않는다. 코어가 경계에서 확장 콜백을 Effect로
  감싼다(하나의 브리지, 코어가 소유하고 100%까지 테스트됨).
- **런타임:** 명시적으로 **Bun 전용**. `bun:sqlite`, `Bun.serve`, 확장 로딩을
  위한 네이티브 TS 임포트. Node 사용자는 HTTP를 통해 런타임을 소비한다.

---

## 3. 코어 (`@hena-dev/core`)

코어는 유일하게 제거 불가능한 코드이다. 이 섹션의 모든 것은 커널이며, 이 섹션에
없는 모든 것은 확장이다. 목표: pi 정신에 따른 필수 루프 — pi의 742줄짜리 루프 중
약 350줄의 핫 패스(hot path) — 작은 파일(각 ≤150줄, lint로 강제)로 측정된다.

### 3.1 상태 모델: 인메모리 리듀서 + 이벤트 스트림

- 루프는 세션 트랜스크립트를 **메모리 안에** 보관하고 모든 상태 전이에 대해
  타입이 지정된 이벤트를 방출한다. 루프는 결코 저장소를 읽지 않는다.
- 영속화, 크래시 복원, 감사, 동기화는 이벤트 스트림을 구독하고 이벤트를
  재생(replay)하여 구축되는 확장의 관심사이다.
- 이벤트 스트림 프리미티브는 최소한의 async-iterable 푸시 큐(pi 스타일
  `EventStream`)이며, 내부적으로 Effect 위에 구현되고 외부에는
  `AsyncIterable`로 노출된다.
- 코어는 **초기 트랜스크립트를 가진** 세션 생성(하이드레이션)을 노출한다 —
  영속화 확장이 크래시 복원에 사용하는 API이다. 코어 자신은 여전히 저장소를
  결코 읽지 않는다.

### 3.2 턴 실행: 자체 루프, `streamText` = 한 턴

루프는 hena가 존재하는 이유이다; AI SDK는 전송(transport) + 프로바이더일 뿐이다.

```
runLoop(session):
  emit agent_start
  loop:
    inject steering messages (if any)
    emit turn_start
    assistant = streamText(model, convert(transcript), tools, single-step)
                 # streamed: message_start / message_delta / message_end
    if assistant.stopReason in {error, aborted}:
        emit turn_end, agent_end(reason)        # errors are DATA, loop ends
        return
    toolCalls = assistant.toolCalls
    if toolCalls: execute via tool dispatcher    # tool_* events
                  append results to transcript
    emit turn_end (usage, context accounting)
    if no toolCalls:
        if steering queued: continue          # injected at top of loop
        if follow-up queued: inject follow-up; continue
        break
  emit agent_end(completed)
```

- 반복마다 하나의 프로바이더 턴; hena가 도구 실행, 훅 타이밍, 스티어링 주입을
  소유한다. `ToolLoopAgent` / AI SDK 멀티스텝은 사용하지 않는다.
- **스트림은 절대 throw하지 않는다.** 프로바이더/전송 실패는 `stopReason:
  "error" | "aborted"`와 타입이 지정된 분류(3.7 참조)를 가진 최종 어시스턴트
  메시지로 정규화된다. 비정상적인 프로바이더 종료(예: max-tokens →
  `output-length`, 콘텐츠 필터)도 같은 방식으로 정규화되어, 실행은 이 단일
  경로를 통해서만 종료된다. 에러 경로는 성공 경로와 동일한 형태이다.
- **`continue`는 (프롬프트와 함께) 두 번째 코어 진입점이다**: 사용자 메시지를
  추가하지 않고 기존 트랜스크립트 위에서 루프를 재개한다 — 새로운
  `agent_start`; 실행이 활성 상태이면 거부(HTTP 409); 대기 중인 스티어링/후속은
  3.4에 따라 드레인된다. recovery와 compaction이 이를 호출하며,
  `POST /sessions/:id/continue`로 노출된다.
- 재시도와 압축 **정책**은 루프 안에 없다(확장 참조); 루프는 오직 `continue`
  메커니즘만 제공한다.
- 동시성: **세션당 하나의 활성 실행.** 실행 중인 세션에 대한 프롬프트는
  스티어링이나 후속으로 보내야 하며; 그렇지 않으면 서버가 409로 응답한다.

### 3.3 트랜스크립트: 자체 최소 이벤트 소싱 포맷

- 코어는 작은 `TranscriptEntry` 유니온을 정의한다: `user`, `assistant`,
  `toolResult`, 그리고 확장을 위한 확장 가능한 `custom` 엔트리. 모든 엔트리는
  안정적인 단조 증가 ID(세션별 범위), 타임스탬프, 그리고 (어시스턴트의 경우)
  사용량/비용/모델 메타데이터를 가진다. 어시스턴트 본문은 파트의 순서 있는
  목록(`text | reasoning | tool-call`)이며 파트 주소를 가진 `message_delta`로
  스트림된다; 도구 결과는 구조화된 콘텐츠(텍스트, 이미지, 파일)를 담을 수 있다.
- 트랜스크립트는 **트랜스크립트에 영향을 주는 이벤트 부분집합(3.13) 위의 순수
  폴드(fold)**이다: `user_message` → `user`, `message_end` → `assistant`,
  `tool_end` → `toolResult`, `custom_entry` → `custom`, `transcript_replaced`
  → 스플라이스. 영속화 재구축 = 정확히 이 이벤트들의 재생.
- 정확히 **하나의** 변환 함수만 `streamText` 경계에 존재한다:
  `toModelMessages(transcript)`. 네이티브 포맷을 작게 유지하면 변환도 작게
  유지된다(opencode의 744줄짜리 변환기가 반면교사이다).
- AI SDK `UIMessage`/`ModelMessage`는 결코 영속화되지 않으며 공개 API에도
  결코 나타나지 않는다.

### 3.4 실행 중 상호작용: 스티어링과 후속 큐

코어 어포던스로, 프로토콜을 통해 노출된다:

- **스티어링(Steering)**: 스트림을 죽이지 않고 다음 턴 경계에서(현재 도구
  배치 이후) 주입되는 메시지.
- **후속(Follow-up)**: 에이전트가 그렇지 않았다면 멈췄을 시점에 실행되도록
  대기열에 넣은 메시지(루프가 종료되는 대신 계속된다).
- 드레인 모드: 큐별로 `one-at-a-time`(기본값) | `all`.
- 식별자 토큰: `followup`(`followup_queued`, `POST …/followup`); 산문에서는
  "후속(follow-up)"을 사용한다.

### 3.5 도구 디스패치와 검증

- 도구 호출은 실행 전에 도구의 스키마에 대해 검증된다; 검증 실패, 알 수 없는
  도구, 던져진 에러는 모두 **모델로 되먹임되는 에러 도구 결과**가 된다 — 루프는
  도구 실패로 결코 크래시하지 않는다.
- 실행 순서: 소스 순서, 기본적으로 순차적. 도구는 `parallel: true`를 선언할 수
  있다; 배치 내에서 인접한 병렬 안전(parallel-safe) 호출들은 동시에 실행되지만,
  도구 *결과*는 어시스턴트 소스 순서로 추가되어 트랜스크립트가 결정적으로
  유지된다. 사전 점검(preflight) 훅은 항상 순차적으로 실행된다.
- 도구는 `(args, ctx)`를 받으며, 여기서 `ctx`는 `toolCallId`, 세션,
  `AbortSignal`, 실시간 진행 이벤트를 위한 `update(partial)`, 그리고
  `ask(question)`(3.6 참조)을 포함한다.
- **도구 스키마:** `registerTool`은 어떤 **Standard Schema** 검증기(표준 스키마
  인터페이스를 통한 Zod v4, Valibot, ArkType, Effect Schema) **또는 원시 JSON
  Schema 객체**도 받는다. 코어는 모델을 위해 JSON Schema로 변환한다. 따라서
  에이전트가 작성한 도구는 의존성이 없을 수 있다.

### 3.6 ask 프리미티브 (일시 중단)

하나의 코어 메커니즘이 승인, 질문, 그리고 모든 휴먼 인 더 루프(human-in-the-loop)
상호작용을 구동한다:

- 어떤 도구나 훅도 **ask 이벤트**(질문, 선택지, 컨텍스트)를 방출할 수 있다.
  방출하는 계산은 **reply 이벤트**가 도착할 때까지 일시 중단되며, 설정 가능한
  타임아웃과 기본 답변을 가진다; 타임아웃이 없으면 reply 또는 중단까지
  블록된다.
- ask는 SSE를 통해 전달되고; reply는 POST를 통해 도착한다. 여러 클라이언트가
  지켜볼 수 있으며; 첫 번째 reply가 이기고, 늦은 reply는 거부된다(HTTP 409).
- 권한 확장은 *언제* 물어볼지를 결정하고; 클라이언트는 *어떻게* 렌더링할지를
  결정한다. (AI SDK의 도구 승인 장치는 사용되지 않는다 — hena가 도구 실행을
  소유한다.)

### 3.7 에러 모델과 분류

- 코어는 모든 프로바이더/전송 실패를 타입이 지정된 분류 체계(`aborted`, `auth`,
  `rate-limit`, `overloaded`, `context-overflow`, `output-length`, `network`,
  `api`, `unknown`)로 정규화하여 최종 어시스턴트 메시지와 `agent_end` 이벤트에
  실어 보낸다.
- 분류는 **플러그형 매처(matcher) 레지스트리**이다(확장이 매처를 등록할 수
  있다. 예: 프로바이더별 오버플로 정규식 — 표준 오버플로 에러가 존재하지 않는다는
  pi의 교훈). 코어는 오직 일반(generic) 매처만 제공한다.

### 3.8 컨텍스트 회계(accounting)

- 코어는 `streamText` 결과로부터 토큰 사용량을 추적하고, 매 턴 `context_usage`
  이벤트를 방출하며, 프로바이더 컨텍스트 오버플로 에러를 `context_overflow`
  이벤트로 표면화한다(원본 에러를 그대로 보존).
- 코어는 **트랜스크립트 교체 연산**(이벤트로 출처가 기록되는 원자적 스플라이스)을
  노출한다 — 압축 정책 확장이 사용하는 메커니즘이다. 코어 자체에는 임계값도
  요약(summarization)도 없다.

### 3.9 훅 디스패치 계약

- **변환/거부(Transform/veto) 훅**(예: `tool_call`, `context`,
  `before_model_call`)은 **등록 순서대로 순차적으로** 실행되며, 각각 훅별
  타임아웃(설정으로 재정의 가능)과 실패 시 타입이 지정된 폴백을 가진다.
- **관찰 전용(Observe-only) 이벤트**는 **동시에** 팬아웃되며 루프를 막을 수 없다.
- 훅 실패나 타임아웃은 진단 이벤트를 방출하고 그 외에는 격리(contain)된다.
  **확장 에러는 결코 루프를 크래시하지 않는다**(opencode의 무타임아웃 결함을
  명시적으로 설계 단계에서 배제했다).
- 변환 훅 지점은 **이벤트와 별개의 네임스페이스**이다(3.13). 초기 어휘:
  `before_model_call`, `tool_call`, `context`.

### 3.10 취소(Cancellation)

- 코어 내부에서 종단 간 Effect 인터럽션; 실행당 하나의 `AbortController`.
  파이버 인터럽트 → 스코프 종료 → 프로바이더 호출과 실행 중인 모든 도구로의
  `AbortSignal`. `POST /sessions/:id/abort`가 이를 트리거한다.
- 실행과 함께 죽는 진행 중 도구 호출은 합성된(synthetic) "interrupted" 에러
  결과로 마무리되어, 어떤 프로바이더도 매달린(dangling) 도구 호출을 보지 않는다.

### 3.11 확장 레지스트리와 설정 (부트스트랩)

이 둘은 확장이 로드되기 전에 존재해야 하므로 코어에 속한다:

- **레지스트리**: 설정된 확장들을 로드하고, 훅/레지스트리/포트 테이블을 소유하며,
  3.9에 따라 디스패치하고, 언로드/리로드(핫 리로드용)를 지원한다.
- **설정**: JSONC, 스키마 검증됨(Effect Schema; `$schema` 자동완성을 위해 JSON
  Schema 게시). 캐스케이드: 내장 기본값 < 글로벌
  (`~/.config/hena/config.jsonc`) < 프로젝트(`hena.jsonc`) < 환경(`HENA_*`) <
  플래그. 객체는 깊은 병합(deep-merge); 배열은 교체. 프로젝트 로컬 설정과 확장은
  최초 사용 시 **신뢰 프롬프트(trust prompt)** 뒤에서 게이팅된다: 대화형이면
  부팅 시 TTY에서 답하고; 헤드리스 부팅은 신뢰가 사전 부여되지 않는 한
  (`--trust` 플래그 또는 글로벌 설정의 신뢰 목록) 닫힌 채로 실패(fail
  closed)한다.

### 3.12 이벤트 스키마: 1일차부터 버전이 지정된 엔벨로프

- 모든 이벤트는 `schemaVersion`을 담는다. 이벤트 타입은 Effect Schema에서
  **한 번** 정의되며; 와이어 JSON, SQLite 페이로드, 생성된 클라이언트 타입이
  모두 동일한 정의에서 파생된다.
- 1.0 이전의 잦은 변경은 **마이그레이션이 있을 때만** 허용된다: 읽기 시점
  업그레이드 변환, N→1 지원. 영속화된 세션은 항상 로드되어야 한다.

### 3.13 코어 이벤트 어휘 (초기)

`agent_start`, `turn_start`, `message_start`, `message_delta`, `message_end`,
`user_message`, `custom_entry`, `tool_start`, `tool_update`, `tool_end`,
`turn_end`, `agent_end`, `context_usage`, `context_overflow`,
`transcript_replaced`, `ask`, `reply`, `steering_queued`, `followup_queued`,
`extension_loaded`, `extension_unloaded`, `extension_error`,
`session_created`, `session_deleted`, `config_changed`.
(이름은 잠정적; 최종 이름은 Effect Schema 정의로 고정된다. `user_message`는
`source: prompt | steering | followup`을 담는다. 트랜스크립트에 영향을 주는
부분집합은 3.3에서 정의된다.)

---

## 4. 확장 시스템

### 4.1 API 형태: 명령형 ExtensionAPI (pi 스타일)

확장은 기본 export를 가진 TypeScript 모듈이다:

```ts
import type { ExtensionAPI } from "@hena-dev/core";

export default function (api: ExtensionAPI) {
  api.on("turn_end", async (ev) => { /* observe */ });
  api.on("tool_call", async (ev) => ({ block: false }));   // transform/veto
  api.registerTool({ name, description, parameters, execute });
  api.registerSkill(...); api.registerCommand(...);
  api.providePersistence("sqlite", impl);  // port: named impl, config selects
  api.provideProvider("ai-sdk", impl);     // port
  api.registerErrorMatcher(...);           // registry: additive
  api.serve(route, handler);   // registry: core route table, served by `server`
}
```

표면은 명령형이지만, 그 기저 의미론은 명시적으로 세 종류이다(문서에도 그렇게
기술됨):

- **포트(Ports)** (`provide*`): 이름이 지정된 구현들; 설정이 활성 구현을
  선택한다(예: `"ports": { "persistence": "sqlite" }`). 충돌은 경쟁(race)이
  아니라 진단(diagnostic)이다.
- **레지스트리(Registries)** (`register*`): 가산적(additive)(도구, 스킬, 명령,
  매처, 라우트).
- **훅(Hooks)** (`on`): 3.9 계약에 따라 관찰(동시) 또는 변환(순서, 타임아웃).

전체 API는 Promise/AsyncIterable 기반이다. 확장 작성에는 Effect가 전혀
나타나지 않는다.

### 4.2 실행 모델

- **인프로세스(in-process)**, TS를 Bun 네이티브 동적 `import()`로 로드 — jiti
  없음, 번들러 없음. 에러는 3.9에 따라 격리된다. 보안 격리는 문서화된
  **비목표(non-goal)**이다: 적대적 환경에서는 런타임 전체를 컨테이너화하라
  (pi의 입장).
- **핫 리로드(Hot reload)**는 일급(first-class) 런타임 기능이다(개발 전용이
  아님). 자기 개선이 이를 요구하기 때문이다: 변경된 확장 파일은 캐시 무효화
  (cache-busting)와 함께 다시 임포트되고; 레지스트리는 옛 등록을 폐기하며(각
  확장은 폐기 스코프를 받는다) 다시 등록한다.

### 4.3 발견(Discovery)과 설정

- 소스: 퍼스트파티 서브패스 export(`@hena-dev/extensions/<name>`), npm 패키지
  이름, 로컬 경로(`~/.config/hena/extensions/*.ts`, `.hena/extensions/*.ts`).
  모두 설정에서 선언/토글된다:

```jsonc
{
  "$schema": "https://hena.dev/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "extensions": {
    "@hena-dev/extensions/write": false,         // remove a default tool
    "@hena-dev/extensions/grep": true,           // enable an optional tool
    "./.hena/extensions/my-linter.ts": true      // add local
  },
  "ports": { "persistence": "sqlite" }           // select port impls
}
```

- 런타임 npm 설치는 결코 하지 않는다(공급망 + Nix 재현성).

### 4.4 확장 간 의존성

- 확장은 **설정 순서대로 순차적으로** 로드된다; 나중 확장은 앞선 확장이 이미
  등록을 마쳤음에 의존할 수 있다.
- 확장 간 직접 임포트나 호출은 없다. 유일한 솔기는 코어가 소유한다: 포트,
  레지스트리, 이벤트, 그리고 코어 세션 연산(prompt/continue/ask). 예:
  `api.serve`는 코어 라우트 테이블에 쓰고; server 확장은 거기서 찾은 것을
  제공한다.
- 소비자가 없는 등록은 비활성(inert)이다(진단 이벤트와 함께); 채워지지 않은
  포트는 그것을 소비하는 기능을 (각자의 명세에 따라) 격하시키지만, 결코
  크래시시키지 않는다.

---

## 5. 퍼스트파티 확장

모두 모노레포 안에 있고, **도구/기능당 하나의 확장**(최대 세분화)이며,
**`@hena-dev/extensions`의 서브패스 export**로 패키징된다(하나의 버전, 하나의
게시; 각 확장은 자체 테스트를 가진 독립 디렉터리). 유일한 예외: `web-ui`는
Vite 빌드 파이프라인 때문에 자체 패키지(`@hena-dev/web-ui`)로 출하된다 —
그래도 여전히 그저 하나의 확장이다. 모두 오직 공개 API에 대해서만 빌드된다.

| 확장 | 종류 | 요약 |
|---|---|---|
| `provider` | 포트 | 모델 문자열 → AI SDK v7 모델. models.dev 카탈로그(가져오고, 캐시하고, 레포 내 정적 폴백 스냅샷); 큐레이션된 번들 `@ai-sdk/*` 프로바이더; 커스텀 baseURL/key 설정. v1에는 quirk 변환 계층 없음: AI SDK를 신뢰하고, 프로바이더별 수정 확장의 탈출구로서 `before_model_call`(params/headers/messages/providerOptions) 훅을 노출. 자격 증명: v1에서는 환경 변수 + 설정 키만(OAuth/키체인 없음), 의도적으로. |
| `persistence-sqlite` | 포트 | 기본 영속화. `bun:sqlite`: 추가 전용 이벤트 로그(`schemaVersion` 포함) + 이벤트 배치마다 트랜잭션으로 갱신되는 프로젝션 테이블(sessions, messages). 재구축 = 재생. 서버를 위한 세션 목록/읽기 API. DB는 `~/.local/share/hena/hena.db`에 위치. |
| `permissions` | 훅 | ask 프리미티브 위의 정책: 도구/경로/명령별 패턴 규칙 세트(`allow | ask | deny`, 마지막 매치가 이김); 둠 루프(doom-loop) 감지(N개의 동일한 연속 호출 → ask); 세션 범위 "always allow"; ask 타임아웃 기본값은 거부(deny). |
| `compaction` | 훅 | 코어 회계 위의 정책: 선제적 임계값(컨텍스트 윈도우 아래 예약 버퍼)과 `context_overflow`에 대한 반응적 처리; 숨겨진 에이전트 프롬프트를 통한 요약 턴(구조화된 체크포인트: 목표/진행/결정/다음 단계 + 손댄 파일 목록); 최근 턴 꼬리를 그대로 보존; 코어 트랜스크립트 교체 사용 후 코어 `continue()`로 재개. |
| `recovery` | 훅 | 루프 바깥의 재시도: 에러로 종료된 실행을 관찰하고, 재시도 가능성을 분류하며(타입이 지정된 분류 체계 + 매처 레지스트리), `retry-after`를 존중하는 지수 백오프 후 코어 `continue()`. 오버플로로 트리거된 연속(continuation)에 대한 원샷 가드. |
| `read`, `write`, `edit`, `bash` | 레지스트리(도구) | 기본 활성 도구 세트(간결, pi 스타일). `bash`가 검색/실행의 일꾼이다. |
| `grep`, `glob`, `webfetch`, `todo` | 레지스트리(도구) | 출하되지만 **기본 비활성**. 각각 독립적으로 토글 가능. |
| `system-prompt` | 포트 | 시스템 프롬프트 조립: 100줄 미만 템플릿(정체성, 도구 목록, cwd, 날짜) + 프로젝트 컨텍스트 파일(`AGENTS.md` 존중) + 스킬 인덱스(코어 스킬 레지스트리에서 읽음). 완전히 교체 가능. |
| `skills` | 레지스트리 | Anthropic Agent Skills 명세 호환(`SKILL.md` + frontmatter, 점진적 공개: 프롬프트 내 인덱스, 본문은 필요 시 읽기). 소스: `~/.config/hena/skills`, `.hena/skills`. |
| `subagents` | 도구 + 훅 | **오직 공개 런타임 API만 통해** 자식 세션을 생성하는 `task` 도구(세션 생성, 프롬프트, 이벤트 대기) — API 충분성의 산성 시험(acid test). 설정/마크다운에서의 에이전트 정의. 자식은 `parentSessionId`를 기록; 재귀는 기본 비활성; 중단(abort)은 부모→자식으로 연쇄. |
| `self-dev` | 도구 + 스킬 | §7 참조. |
| `provider-script` | 포트(테스트) | 결정적 스크립트 프로바이더: 제어 가능한 청킹을 가진 스크립트 텍스트/도구 호출/에러/오버플로 스트림. 모든 테스트 계층에서 사용되며 공개 테스트 유틸리티로 출하된다. |
| `telemetry` | 훅 | 코어 Effect 스팬(턴, 모델 호출, 도구 실행, 훅 디스패치)의 OTLP 내보내기 + 구조화된 로그. 미설정 시 오버헤드 제로. |
| `server` | 호스트 | `Bun.serve` 위의 HTTP + SSE 프로토콜(§6 참조); 다른 확장이 기여한 라우트(`api.serve`)를 호스팅. |
| `web-ui` | 클라이언트 | 기본 웹 UI(§8 참조), `server`에 정적 자산 + 라우트로 등록. |
| `mcp` | post-v1 | 도구 레지스트리 API가 안정화된 **이후** 퍼스트파티 확장으로서의 MCP 클라이언트(stdio + HTTP). v1 지침: `bash`/CLI 래퍼를 통해 MCP 서버를 연결. |

---

## 6. 와이어 프로토콜 (`@hena-dev/extensions/server`, `@hena-dev/client`)

- **자체 타입 지정 프로토콜: HTTP + SSE.** SSE 스트림은 정확히 코어 이벤트
  어휘(동일한 Effect Schema 정의)를 전달하고; REST 동사가 명령을 담당한다.
  생성/파생된 TS 클라이언트가 `@hena-dev/client`로 출하된다(웹 UI와 서드파티가
  사용). 동일한 스키마에서 OpenAPI 게시.
- 스케치:
  - `POST /sessions` · `GET /sessions` · `GET /sessions/:id` ·
    `DELETE /sessions/:id`
  - `POST /sessions/:id/prompt` (실행 중이면 409) ·
    `POST /sessions/:id/steer` · `POST /sessions/:id/followup` ·
    `POST /sessions/:id/abort` · `POST /sessions/:id/continue`
  - `GET /sessions/:id/events` (SSE: 라이브 + 커서로부터 재생) ·
    `GET /events` (글로벌 파이어호스)
  - `POST /asks/:id/reply`
  - `GET /config` · `PATCH /config` (외과적 JSONC 편집) ·
    `GET /extensions` · `POST /extensions/reload` (전체, 또는 `{ "ids": [...] }`)
- 세션 목록/읽기와 SSE 커서 재생은 영속화 포트가 뒷받침한다; 영속화가 설정되지
  않으면 서버는 라이브 SSE만 제공하고 재생/목록에는 타입이 지정된
  능력(capability) 에러로 응답한다.
- ACP/MCP 서버 브리지는 나중에 확장으로 가능하다; 네이티브 프로토콜이 정전
  (canonical)으로 유지된다.
- **보안 기본값:** `127.0.0.1`에 바인딩, **토큰 인증 없음**(opencode 스타일),
  크게 문서화된 경고와 함께(어떤 로컬 프로세스든 bash를 실행하는 에이전트를
  구동할 수 있다). `Origin`/`Host` 검증(CSRF/DNS 리바인딩 방어)은 항상 켜져
  있으며 끄는 스위치가 없다. 비로컬호스트 바인딩은 명시적 플래그 **그리고**
  토큰 인증이 필요하다; 토큰 인증은 로컬호스트에서도 설정 뒤에서 사용 가능하며
  문서에서 권장된다. 1.0 전에 재검토.

---

## 7. 자기 개선 (`self-dev`)

대표 기능; 메커니즘:

1. **능력(Capability)**: 새 확장을 스캐폴딩(테스트 파일이 있는 템플릿)하고,
   워크스페이스 확장 디렉터리(`.hena/extensions/` 또는
   `~/.config/hena/extensions/`)에서 작성/편집하며, 그 테스트를 실행하는 도구들.
2. **지식(Knowledge)**: ExtensionAPI 문서, 이벤트 어휘, 설정 스키마, 동작하는
   예제를 노출하는 내장 스킬(문서는 런타임 자료이다 — 에이전트에게 먹이기 위해
   작성됨).
3. **게이트(Gate, 기본값)**: **활성화 전 질문 + 테스트 통과 필수.** 확장의
   vitest 스위트가 먼저 실행되며; 그 후에만 활성화가 승인을 위한 ask 이벤트를
   발화한다. 승인된 확장은 실행 중인 세션에 핫 로드되고 설정에 영속화된다.
   "Always allow"는 세션/프로젝트별로 답할 수 있다.
4. **격리(Containment)**: 핫 로드된 확장은 동일한 인프로세스 에러 격리 계약
   (3.9) 아래에서 실행된다; 망가진 것은 언로드되고 이벤트로 보고되며, 결코
   크래시가 아니다.

---

## 8. 기본 웹 UI (`web-ui` 패키지)

- 레퍼런스 클라이언트는 **웹 UI이며, 그 자체가 확장**이다; 커뮤니티 UI는 대안
  확장으로 기대된다. v1에 CLI 클라이언트는 없다(`hena` 바이너리는 부팅/제공만
  한다); `curl` + 문서가 스크립팅을 담당한다.
- 스택: **React + Vite + Tailwind CSS + shadcn/ui, 라우팅은 TanStack Router**.
  스크래치 레포에서 `bunx --bun shadcn@latest init --template vite`로 한 번
  스캐폴딩하고(TanStack Router는 수동으로 추가 — CLI에 TanStack Router
  템플릿이 없다), 모노레포로 임포트한다. 선택한 디자인 프리셋은 불투명한
  프리셋 코드가 아니라 해석된 설정(`shadcn preset --json`)으로 커밋된다.
- 컴포넌트는 작은 모듈로 분할된다 — **150줄 파일 상한은 UI 코드에도 적용된다**.
- v1 기능: 세션 목록/생성/재개, 스트림된 트랜스크립트 렌더링(델타, 실시간
  업데이트가 있는 도구 호출), 프롬프트/스티어/후속 입력, ask 다이얼로그(승인),
  중단, 설정/확장 검사.
- 테스트: vitest 단위(이벤트→뷰 모델 리듀서, 컴포넌트), 통합, 그리고
  `provider-script`를 실행하는 실제 서버에 대한 e2e(Playwright).

---

## 9. 모노레포 레이아웃

```
hena/
├── docs/en/                      # canonical docs (English only for now;
│   ├── spec.md                   #  /en/ namespace reserved for future locales;
│   ├── architecture.md           #  written agent-readable: stable headings,
│   ├── extension-api.md          #  one concern per file, compiling examples)
│   └── protocol.md
├── packages/
│   ├── core/                     # @hena-dev/core      — the kernel (§3)
│   ├── extensions/               # @hena-dev/extensions — subpath per extension (§5)
│   │   └── src/<name>/           #   each: index.ts + *.test.ts (≤150-line src; tests exempt, §10)
│   ├── client/                   # @hena-dev/client    — typed protocol client
│   ├── web-ui/                   # @hena-dev/web-ui    — default UI extension (§8)
│   └── hena/                     # @hena-dev/hena      — CLI entrypoint: `hena serve`
├── e2e/                          # cross-package e2e suites (server+UI+script provider)
├── flake.nix                     # nix devshell + CI toolchain (bun, tsgo, playwright)
├── biome.jsonc
└── package.json                  # bun workspaces
```

- **버전 관리/릴리스:** 모든 패키지에 걸친 록스텝(lockstep) 버전(Effect/pi
  스타일), changesets, CI로부터의 npm provenance. 1.0 이전: 마이너에서 호환성
  파괴(breaking) 허용, **단 이벤트 스키마 변경은 항상 마이그레이션과 함께
  출하**(3.12).
- 설정 디렉터리 `~/.config/hena/`, 데이터 디렉터리 `~/.local/share/hena/`, 환경
  접두사 `HENA_`. Windows는 v1 대상이 아니다(Bun 전용, XDG 경로; WSL은
  동작한다).

---

## 10. 엔지니어링 표준

- **툴체인:** Bun(워크스페이스, 런타임); 테스트 러너는 vitest — 명시적으로
  `bun test`가 아님 — Bun 런타임 위에서 실행; 타입 체크용
  `tsgo`(`@typescript/native-preview@latest`), Biome v2, CI의 knip, 개발 셸과
  CI를 위한 Nix flake.
- **Biome v2** — 다음 모두를 **error**로 설정:
  - `complexity/noExcessiveLinesPerFunction`
  - `nursery/noExcessiveLinesPerFile` (**150줄**; Biome ≥ 2.3.12 필요)
  - `complexity/noExcessiveCognitiveComplexity`
  - `suspicious/noExplicitAny`
  - 받아들인 귀결: 코드베이스는 단일 관심사를 가진 많은 작은 파일들이며;
    150줄 상한은 장애물이 아니라 설계 도구이다.
- **예외 정책(좁고, 문서화됨):**
  - 생성된 파일(models.dev 스냅샷, 스키마 파생 클라이언트, 스캐폴드):
    lint 상한과 커버리지에서 제외, 각 제외는 설정에 주석과 함께 나열된다.
  - 테스트 파일: 150줄 파일 상한과 함수 크기 상한에서 면제; 그 외 모든
    규칙은 적용된다.
  - 소스 파일: 면제 없음; 연결된 이슈 없이는 인라인 `biome-ignore` 없음.
- **커버리지: 100% 라인/브랜치/함수/구문, CI에서 패키지별로 강제**(vitest
  커버리지 임계값, **istanbul 프로바이더** — v8 프로바이더는 Bun이 구현하지
  않는 `node:inspector`를 필요로 한다). 라이브 모델 테스트는 환경으로 게이팅되고
  게이트에서 제외된다. `web-ui` 예외: 컴포넌트는 Playwright e2e로 검증되며
  (수치 게이트 밖); 100% 게이트는 로직 모듈(이벤트→뷰 모델 리듀서, 프로토콜
  글루)에 적용된다.
- **CI의 knip**: 사용되지 않는 파일/export/의존성 없음 — 최대 세분화 확장을
  정직하게 유지한다.
- **Effect 사용:** 코어 내부에만 effect-smol(Effect v4 베타); Effect Schema가
  이벤트, 설정, 프로토콜 타입의 단일 진실 공급원이다. 공개 API는 어떤 Effect
  타입도 노출하지 않는다.

### 10.1 테스트 전략 (필수 3계층)

| 계층 | 범위 | 모델 | 비고 |
|---|---|---|---|
| 단위(Unit) | 파일/모듈별 | `provider-script` 또는 순수 가짜 | 훅 계약, 리듀서, 변환 함수, 매처, 스키마 마이그레이션 |
| 통합(Integration) | 인프로세스 실제 런타임 + 실제 확장(sqlite, permissions, compaction, recovery) | `provider-script` | 종단 간 루프 의미론: 스티어링, ask, 중단, 오버플로→압축→계속, 핫 리로드 |
| e2e | HTTP/SSE 위의 실제 `hena serve`; Playwright를 통한 웹 UI | `provider-script` | 프로토콜 계약, 클라이언트 생성, UI 플로우; 그리고 환경으로 게이팅된 라이브 모델 스모크 스위트(커버리지에서 제외) |

스크립트 프로바이더는 테스트 전용이 아니라 **일급 제품 기능**이다: 다운스트림
확장 작성자가 자신의 확장을 테스트하는 데 사용한다.

---

## 11. 결정된 기본값 (인터뷰에서, 요약)

| 주제 | 결정 |
|---|---|
| 정체성 | 헤드리스 런타임/서버 우선 |
| 루프 상태 | 인메모리 리듀서 + 이벤트 스트림; 영속화가 구독 |
| 턴 실행 | 자체 루프; 턴당 `streamText` 싱글스텝 |
| Effect 경계 | Effect 코어; Promise 확장 API |
| 코어 내용 | §3의 목록: 루프, 이벤트, 트랜스크립트, 디스패치, 큐, ask, 훅, 레지스트리, 설정 — 그 외에는 없음 |
| 확장 API | 명령형 ExtensionAPI(pi 스타일); 포트/레지스트리/훅 의미론 |
| 격리 | 인프로세스, 에러 격리; 샌드박스 없음(대신 컨테이너화) |
| 훅 디스패치 | 타임아웃이 있는 순서 변환; 동시 관찰자 |
| 자기 개선 | self-dev 확장; 핫 리로드; 테스트 통과 + 활성화 전 질문 |
| 프로토콜 | 자체 HTTP+SSE, 스키마 파생; 로컬호스트, 토큰 인증 없음 기본, origin 검증 |
| 트랜스크립트 | 자체 최소 이벤트 소싱 포맷; AI SDK로의 단일 변환 |
| 실행 중 | 코어의 스티어링 + 후속 큐 |
| 영속화 기본값 | SQLite(`bun:sqlite`) 이벤트 로그 + 프로젝션 |
| 압축 | 코어: 회계+이벤트+교체 연산+continue; 확장: 정책 |
| 승인 | 코어 ask/reply 일시 중단 프리미티브; 확장: 정책 |
| 세분화 | 도구/기능당 하나의 확장; 서브패스 export, 적은 패키지 |
| 기본 도구 | read/write/edit/bash; 간결한 100줄 미만 프롬프트; AGENTS.md |
| 서브에이전트 | 오직 공개 API의 퍼스트파티 확장; 재귀 비활성 |
| 스킬 / MCP | 스킬 퍼스트파티(Anthropic 명세); MCP 확장 post-v1 |
| 모델 | models.dev 카탈로그 + 번들 프로바이더; 런타임 설치 없음 |
| 프로바이더 quirk | AI SDK v7 + 훅 탈출구 신뢰; 변환 계층 없음 |
| 재시도 | 루프 바깥: 에러 이벤트의 recovery 확장 |
| 도구 스키마 | Standard Schema 또는 원시 JSON Schema |
| 런타임 | Bun 전용 |
| 설정 | JSONC, Effect Schema 검증, 5단계 캐스케이드, 신뢰 프롬프트 |
| 테스트 | 모든 계층에 걸친 스크립트 프로바이더 확장 |
| 커버리지/lint | 패키지별 100%; 좁고 문서화된 예외 |
| 릴리스 | 록스텝 + changesets; MIT |
| 이벤트 | 1일차부터 버전 지정 엔벨로프 + 마이그레이션 |
| 관측성 | 코어의 Effect 스팬; OTel 내보내기 확장 |
| 레퍼런스 클라이언트 | 기본 웹 UI 확장(React/Vite/Tailwind/shadcn/TanStack Router) |
| 용어 | 어디서나 "extension"(설정 키 `extensions`) |
| 이름/스코프/문서 | hena; `@hena-dev/*`; `docs/en/` 아래 영어 전용 문서 |

---

## 12. 위험 요소와 주시 항목

1. **두 개의 베타 기반.** Effect v4(effect-smol)와 AI SDK v7 둘 다 잦은 변경이
   있다; 통합 버전 Effect 릴리스와 AI SDK 카나리는 매주 깨질 수 있다. 완화:
   정확히 핀(pin) 고정, 신중하게 업그레이드, AI SDK 타입을 프로바이더 확장 +
   하나의 변환 함수에 가두고, Effect를 코어에 가둔다. AI SDK v7은 현재 카나리
   전용이다: 검증된 카나리를 핀 고정하고; 안정판 v7이 M0을 넘겨 늦어지면 동일한
   솔기 뒤에서 v6 안정판으로 출하한다.
2. **Biome `nursery/noExcessiveLinesPerFile`**는 nursery 규칙이다; 의미론이
   바뀔 수 있다. 완화: 150줄 상한을 규칙의 운명과 무관하게 프로젝트 법으로
   취급한다.
3. **100% 브랜치 커버리지**가 에러/중단 경로에서 가장 비싼 부분이다 — 비용을
   감안함; 스크립트 프로바이더는 1일차부터 에러/중단/오버플로 주입을 지원해야
   하며 그렇지 않으면 커버리지가 정체된다.
4. **bash를 실행하는 무인증 로컬호스트 서버**는 실제 공격 표면이다. 1일차부터
   의무적인 `Origin`/`Host` 검증(CSRF/DNS 리바인딩); 크게 문서화됨; 토큰 인증
   사용 가능; 1.0 전에 기본값 재검토.
5. **캐시 무효화 임포트를 통한 핫 리로드**는 설계상 모듈 인스턴스를 누수시킨다
   (옛 모듈은 프로세스 재시작 전까지 메모리에 남는다). v1에 허용 가능;
   문서화한다.
6. **최대 확장 세분화**는 레지스트리/설정 난립의 위험이 있다 — 서브패스
   패키징과 knip으로 완화되지만, 약 20개의 확장을 설정하는 UX에는 주의가
   필요하다(좋은 기본값, 나중에 프로파일).
7. **인프로세스 자기 수정**은 여전히 프로세스를 멈추게(wedge) 할 수 있다(훅의
   무한 루프는 오직 타임아웃으로만 제한된다). 에이전트가 작성한 확장을 위한
   워커 계층 격리가 알려진 가능한 강화책이며, 의도적으로 미뤄졌다.
8. **Bun 위의 vitest**는 공식적으로 지원되는 조합이 아니며,
   `@vitest/coverage-v8`은 `node:inspector`(Bun에 미구현)를 필요로 한다 —
   istanbul 프로바이더를 쓰는 이유다. 완화: vitest를 핀 고정하고, 러너
   업그레이드를 위한 CI 카나리 잡을 유지하며; 막히면 스위트를 분할한다(런타임
   비의존 패키지는 Node, Bun API 패키지는 Bun).

## 13. 마일스톤

- **M0 — 커널:** 코어 패키지(루프, 이벤트, 트랜스크립트, 디스패처, 레지스트리,
  설정, ask), provider + provider-script + server 확장, 100% 게이트 통과,
  `hena serve`가 SSE를 통해 스크립트 세션을 스트림한다.
- **M1 — 사용 가능한 에이전트:** read/write/edit/bash, system-prompt, skills,
  persistence-sqlite, permissions, recovery, compaction; 세션이 재시작에서
  살아남는다.
- **M2 — 제품 표면:** 스키마 버전 관리 뒤에 고정된 서버 프로토콜,
  `@hena-dev/client` 생성, 웹 UI 확장, Playwright e2e.
- **M3 — 차별화 요소:** self-dev(스캐폴드/테스트/핫 리로드/승인), subagents,
  telemetry; 데모로 병합된 첫 에이전트 작성 확장.
- **Post-v1:** MCP 확장, ACP 브리지, 인증 강화, 워커 계층 격리 옵션, 추가
  영속화 포트.
