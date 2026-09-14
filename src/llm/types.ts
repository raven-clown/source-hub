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
  /** Force the model to call exactly one tool and return its parsed arguments. */
  extractStructured(opts: { system: string; userContent: string; tool: ToolSpec }): Promise<Record<string, unknown>>;

  /** Run a short agent loop: the model may call `tool` repeatedly (executed via `runTool`) before giving a final text answer. */
  runAgentLoop(opts: {
    system: string;
    userMessage: string;
    tool: ToolSpec;
    runTool: (input: Record<string, unknown>) => Promise<unknown>;
    maxTurns?: number;
  }): Promise<string>;
}
