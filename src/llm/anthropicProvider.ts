import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, ToolSpec } from "./types.js";

function toAnthropicTool(tool: ToolSpec): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties: tool.schema.properties,
      required: tool.schema.required ?? [],
    },
  };
}

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
  }

  async extractStructured(opts: {
    system: string;
    userContent: string;
    tool: ToolSpec;
  }): Promise<Record<string, unknown>> {
    const anthropicTool = toAnthropicTool(opts.tool);
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: opts.system,
      tools: [anthropicTool],
      tool_choice: { type: "tool", name: anthropicTool.name },
      messages: [{ role: "user", content: opts.userContent }],
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) throw new Error("extraction model did not return a tool_use block");
    return toolUse.input as Record<string, unknown>;
  }

  async runAgentLoop(opts: {
    system: string;
    userMessage: string;
    tool: ToolSpec;
    runTool: (input: Record<string, unknown>) => Promise<unknown>;
    maxTurns?: number;
  }): Promise<string> {
    const anthropicTool = toAnthropicTool(opts.tool);
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.userMessage }];

    for (let turn = 0; turn < (opts.maxTurns ?? 4); turn++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: opts.system,
        tools: [anthropicTool],
        messages,
      });

      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUses.length === 0) {
        const text = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
        return text?.text ?? "";
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const result = await opts.runTool(toolUse.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
      }
      messages.push({ role: "user", content: toolResults });
    }

    return "Could not resolve an answer within the tool-call budget.";
  }
}
