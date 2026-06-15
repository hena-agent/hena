# Testing Patterns

## Testing Framework Selection

Use `it.effect` for tests that return Effects.

```typescript
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"

it.effect("should work with Effects", () =>
  Effect.gen(function*() {
    const result = yield* someEffect
    assert.strictEqual(result, expectedValue)
  }))
```

Use regular `it` for pure synchronous TypeScript functions.

```typescript
import { assert, describe, it } from "@effect/vitest"

it("should work with pure functions", () => {
  const result = pureFunction(input)
  assert.strictEqual(result, expectedValue)
})
```

## Testing Rules

- Never use `Effect.runSync` in tests
- Never use `expect` from Vitest; use `assert` methods instead
- Always use `TestClock` for time-dependent operations
- Group related tests using `describe`
