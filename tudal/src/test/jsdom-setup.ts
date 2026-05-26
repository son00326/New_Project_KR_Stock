// PR4 Step 1.0.2 (B4 fix omxy R1): jsdom env에서 @testing-library/jest-dom matchers 등록
import '@testing-library/jest-dom/vitest';

// PR4 Step 1.3 보강: 다중 render 누적 차단 — @testing-library/react는 자동 cleanup 없음.
// 각 test 사이에 DOM 청소해야 screen.getByRole 중복 catch 차단 (button-test 3 fail catch).
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
});
