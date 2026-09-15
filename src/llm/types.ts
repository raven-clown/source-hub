export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolSpec {
  name: string;
  description: string;
  schema: JsonSchema;
}

export interface LlmProvider {
  /** Forces exactly one tool call; returns its parsed arguments. */
  extractStructured(opts: { system: string; userContent: string; tool: ToolSpec }): Promise<Record<string, unknown>>;

  /** Multi-turn tool loop until the model returns plain text. */
  runAgentLoop(opts: {
    system: string;
    userMessage: string;
    tool: ToolSpec;
    runTool: (input: Record<string, unknown>) => Promise<unknown>;
    maxTurns?: number;
  }): Promise<string>;
}
