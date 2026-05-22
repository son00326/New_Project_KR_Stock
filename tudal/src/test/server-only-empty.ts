// PR1 B16 fix (omxy R5) — Vitest용 server-only stub.
// server-only@0.0.1 default index.js는 즉시 throw → Next server build는 조건부 export로 우회하지만
// Vitest node 환경에서는 직접 import 시 throw. 본 stub으로 alias 처리해 test 실행 가능.
export {};
