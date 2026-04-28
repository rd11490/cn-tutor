import Anthropic from "@anthropic-ai/sdk";
import type { SessionData } from "./session.js";
import { TOOLS, executeTool } from "../tools/index.js";
import { buildSystemPrompt } from "./system-prompt.js";

export interface RunTurnOptions {
  systemPrompt?: string;
  tools?: Anthropic.Tool[];
  model?: string;
}

let _client: Anthropic | null = null;
const client = () => (_client ??= new Anthropic());

export type SSEEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_done"; name: string; result: unknown }
  | { type: "done" }
  | { type: "error"; message: string };

// The date injected as a non-cached suffix so the stable vocab context stays cached.
function dateSuffix(): string {
  return `\n\n[Context: today is ${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}]`;
}

export async function runTurn(
  session: SessionData,
  userMessage: string,
  onEvent: (event: SSEEvent) => void,
  options: RunTurnOptions = {}
): Promise<void> {
  session.messages.push({ role: "user", content: userMessage });

  const systemPrompt = options.systemPrompt ?? buildSystemPrompt();
  const tools = options.tools ?? TOOLS;
  const model = options.model ?? "claude-haiku-4-5-20251001";

  try {
    // Tool loop: keep going until Claude stops calling tools.
    while (true) {
      const stream = client().messages.stream({
        model,
        max_tokens: 8192,
        system: [
          { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
          { type: "text", text: dateSuffix() },
        ],
        tools,
        messages: session.messages,
      });

      // Forward text deltas to the client as they arrive.
      stream.on("text", (text) => onEvent({ type: "text", text }));

      const response = await stream.finalMessage();

      // Persist the full response (including any tool_use blocks) to history.
      session.messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use") {
        onEvent({ type: "done" });
        break;
      }

      // Execute every tool call, collect results.
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        onEvent({ type: "tool_start", name: block.name });
        const result = await executeTool(
          session,
          block.name,
          block.input as Record<string, unknown>
        );
        onEvent({ type: "tool_done", name: block.name, result });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content:
            typeof result === "string" ? result : JSON.stringify(result),
        });
      }

      // Feed results back and loop.
      session.messages.push({ role: "user", content: toolResults });
    }
  } catch (err) {
    onEvent({ type: "error", message: String(err) });
  }
}
