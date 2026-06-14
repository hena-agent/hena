import type { Extension, ExtensionAPI } from "../extension";
import type { ProviderChunk, ProviderRequest } from "../provider";
import { chunkStream } from "./streams";

export function promptSizedProvider(): Extension {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: (request: ProviderRequest) =>
        chunkStream(sizedChunks(promptContent(request))),
    });
  };
}

function sizedChunks(prompt: string): readonly ProviderChunk[] {
  const count = prompt === "flood" ? 300 : 1;
  const chunks: ProviderChunk[] = [];
  for (let index = 0; index < count; index += 1) {
    chunks.push({ text: `delta ${index}`, type: "text_delta" });
  }
  chunks.push({ stopReason: "completed", type: "finish" });
  return chunks;
}

function promptContent(request: ProviderRequest): string {
  const message = request.messages.at(-1);
  if (message?.role === "user") {
    return message.content;
  }
  return "";
}
