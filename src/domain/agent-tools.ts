export type AgentToolCall={id:string;name:"list_files"|"read_file"|"write_file"|"run_command";arguments:Record<string,unknown>};
export interface AgentToolHost{execute(call:AgentToolCall):Promise<string>;}
