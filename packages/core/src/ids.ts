let sessionCounter = 1;

export function nextSessionId(): string {
  const value = sessionCounter;
  sessionCounter += 1;
  return `session_${value}`;
}
