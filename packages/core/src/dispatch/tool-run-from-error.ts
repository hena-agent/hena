import type { AgentError } from "../common/common";
import { abortedRun } from "./aborted-run";
import type { ToolRun } from "./dispatch";
import { errorRun } from "./error-run";

export const toolRunFromError = (error: AgentError): ToolRun =>
  error.category === "aborted"
    ? abortedRun(error.message)
    : errorRun(error.message);
