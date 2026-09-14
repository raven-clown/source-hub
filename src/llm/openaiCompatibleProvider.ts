import OpenAI from "openai";
import type { LlmProvider, ToolSpec } from "./types.js";

function toOpenAiTool(tool: ToolSpec): OpenAI.Chat.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.schema.properties,
        required: tool.schema.required ?? [],
      },
    },
  };
}

/** Works with any server implementing the OpenAI chat-completions API: Ollama, vLLM, LM Studio, OpenRouter, Together, Groq, DeepInfra, etc. */
export class OpenAiCompatibleProvider implements LlmProvider {
  private client: OpenAI;
  private model: string;

  constructor(opts: { apiKey: string; baseURL: string; model: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
    this.model = opts.model;
  }

  async extractStructured(opts: {
    system: string;
    userContent: string;
    tool: ToolSpec;
  }): Promise<Record<string, unknown>> {
    const openAiTool = toOpenAiTool(opts.tool);
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.userContent },
      ],
      tools: [openAiTool],
      tool_choice: { type: "function", function: { name: opts.tool.name } },
    });

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      throw new Error("extraction model did not return a tool call");
    }
    return JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  }

  async runAgentLoop(opts: {
    system: string;
    userMessage: string;
    tool: ToolSpec;
    runTool: (input: Record<string, unknown>) => Promise<unknown>;
    maxTurns?: number;
  }): Promise<string> {
    const openAiTool = toOpenAiTool(opts.tool);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: opts.system },
      { role: "user", content: opts.userMessage },
    ];

    for (let turn = 0; turn < (opts.maxTurns ?? 4); turn++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: [openAiTool],
      });

      const message = response.choices[0]?.message;
      const toolCalls = message?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        return message?.content ?? "";
      }

      messages.push({ role: "assistant", content: message.content, tool_calls: toolCalls });

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const result = await opts.runTool(input);
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
    }

    return "Could not resolve an answer within the tool-call budget.";
  }
}
