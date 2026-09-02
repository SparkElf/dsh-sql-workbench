import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { SqlContext } from './context.ts'
import type { SqlWorkbenchRuntime } from './runtime.ts'
import type { JsonValue } from './types.ts'

function sessionIdOf(exec: ToolRunContext): string {
  const agent = exec.agent as Agent | undefined
  if (agent === undefined) throw new Error('SQL tools require an initiating agent')
  return agent.session.id
}

function renderJson(_args: unknown, value: unknown): ContentBlock[] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const openObjectSchema = { type: 'object', additionalProperties: true } as const

function jsonObject<T>(promise: Promise<T>): Promise<Record<string, JsonValue>> {
  return promise as unknown as Promise<Record<string, JsonValue>>
}

function jsonArray<T>(promise: Promise<T[]>): Promise<Array<Record<string, JsonValue>>> {
  return promise as unknown as Promise<Array<Record<string, JsonValue>>>
}

/** 注册 AI 与当前查询、数据源目录和查询执行联动的模型工具。 */
export function registerSqlTools(ctx: SqlContext, runtime: SqlWorkbenchRuntime): () => void {
  const disposers: Array<() => void> = []
  const register = (tool: ReturnType<typeof defineTool>): void => { disposers.push(ctx.tools.register(tool)) }

  register(defineTool({
    name: 'sql_list_connections',
    description: 'List SQL data sources configured in the SQL workbench. Returns non-secret connection metadata; passwords are never exposed.',
    parameters: {},
    output: { schema: { type: 'array', items: openObjectSchema }, render: renderJson },
    execute: () => jsonArray(runtime.store.listConnections()),
  }))

  register(defineTool({
    name: 'sql_list_catalog',
    description: 'Read databases, schemas, tables, views, columns, types, defaults, and definitions from one configured SQL data source.',
    parameters: {
      connection_id: { type: 'string', required: true, description: 'Connection id from sql_list_connections.' },
    },
    output: { schema: openObjectSchema, render: renderJson },
    execute: (args: { connection_id: string }) => jsonObject(runtime.catalog(args.connection_id)),
  }))

  register(defineTool({
    name: 'sql_get_current_query',
    description: 'Read the current SQL draft for this conversation. This is the default query that subsequent SQL editing requests must continue modifying.',
    parameters: {},
    output: { schema: openObjectSchema, render: renderJson },
    execute: (_args, exec) => jsonObject(runtime.current(sessionIdOf(exec))),
  }))

  register(defineTool({
    name: 'sql_create_query',
    description: 'Create a new unsaved SQL draft and make it the current query for this conversation. Use this when the user asks to generate a query and no current draft exists, or explicitly asks for another/new query.',
    parameters: {
      connection_id: { type: 'string', required: true, description: 'Data source connection id.' },
      name: { type: 'string', required: true, description: 'Short query tab name.' },
      sql: { type: 'string', required: true, description: 'Complete SQL draft text.' },
    },
    output: { schema: openObjectSchema, render: renderJson },
    execute: (args: { connection_id: string; name: string; sql: string }, exec) =>
      jsonObject(runtime.createDraft(sessionIdOf(exec), args.connection_id, args.name, args.sql)),
  }))

  register(defineTool({
    name: 'sql_update_current_query',
    description: 'Replace the current SQL draft for this conversation. This is the default action for every follow-up request that changes, refines, fixes, or extends the previously generated query. It never saves the query.',
    parameters: {
      sql: { type: 'string', required: true, description: 'Complete replacement SQL text.' },
      name: { type: 'string', description: 'New query tab name when the user also asks to rename it.' },
    },
    output: { schema: openObjectSchema, render: renderJson },
    execute: (args: { sql: string; name?: string }, exec) =>
      jsonObject(runtime.updateCurrent(sessionIdOf(exec), args.sql, args.name)),
  }))

  register(defineTool({
    name: 'sql_run_query',
    description: 'Execute SQL against a configured data source and return every result row. When sql or connection_id is omitted, use the current query draft and its data source.',
    parameters: {
      connection_id: { type: 'string', description: 'Connection id. Omit to use the current query data source.' },
      sql: { type: 'string', description: 'SQL text. Omit to execute the current query draft.' },
    },
    output: { schema: openObjectSchema, render: renderJson },
    execute: (args: { connection_id?: string; sql?: string }, exec) =>
      jsonObject(runtime.runCurrent(sessionIdOf(exec), args.sql, args.connection_id)),
  }))

  return () => { for (const dispose of disposers) dispose() }
}
