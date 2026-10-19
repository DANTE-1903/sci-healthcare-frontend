import assert from 'node:assert/strict';
import test from 'node:test';

import { quoteXlmForUsdc } from '../src/lib/stellar';

test('quoteXlmForUsdc returns a slippage-limited max spend', async () => {
  const quote = await quoteXlmForUsdc(10_000_000n);
  assert.ok(quote.xlmCost > 0n);
  assert.ok(quote.maxXlm >= quote.xlmCost);
  assert.equal(quote.slippageBps, 100);
});
