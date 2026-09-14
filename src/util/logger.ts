type Fields = Record<string, unknown>;

function write(level: string, event: string, fields?: Fields) {
  console.error(JSON.stringify({ level, event, time: new Date().toISOString(), ...fields }));
}

export const logger = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
