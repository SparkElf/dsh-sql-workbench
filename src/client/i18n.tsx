import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'

const zh = {
  'tab.database': '数据库',
  'connection.label': '数据库连接',
  'connection.none': '选择连接',
  'connection.new': '新建连接',
  'connection.edit': '编辑连接',
  'connection.delete': '删除连接',
  'connection.refresh': '刷新对象',
  'mode.objects': '对象',
  'mode.query': '查询',
  'mode.results': '结果',
  'mode.messages': '消息',
  'search.objects': '搜索对象',
  'group.drafts': '未保存与工作副本',
  'group.saved': '已保存查询',
  'query.new': '新建查询',
  'query.untitled': '未保存查询 {count}',
  'query.run': '执行查询',
  'query.run.short': '执行',
  'query.save': '保存查询',
  'query.addCurrent': '添加当前查询到对话',
  'query.add': '添加查询到对话',
  'query.current': '设为当前查询',
  'query.openCopy': '打开工作副本',
  'query.close': '关闭查询',
  'query.name': '查询名称',
  'result.empty': '还没有查询结果',
  'result.status': '{rows} 行 · {duration} ms',
  'result.total': '共 {rows} 行',
  'result.page': '第 {page} / {pages} 页',
  'result.previous': '上一页',
  'result.next': '下一页',
  'result.filter': '筛选',
  'result.applyFilters': '应用筛选',
  'tree.selectConnection': '选择连接以读取对象',
  'details.connection': '连接',
  'details.schemas': 'Schema',
  'details.objects': '对象',
  'details.tables': '表',
  'details.views': '视图',
  'details.database': '数据库',
  'details.schema': 'Schema',
  'details.columns': '列',
  'details.rows': '估算行数',
  'details.engine': '引擎',
  'details.owner': '所有者',
  'details.name': '名称',
  'details.type': '数据类型',
  'details.nullable': '可空',
  'details.default': '默认值',
  'details.yes': '是',
  'details.no': '否',
  'details.definition': '定义',
  'details.indexes': '索引',
  'details.unique': '唯一',
  'details.primary': '主键',
  'dialog.connection': '数据库连接',
  'dialog.connection.new': '新建连接',
  'dialog.connection.edit': '编辑连接',
  'field.name': '名称',
  'field.type': '类型',
  'field.file': '数据库文件',
  'field.host': '主机',
  'field.port': '端口',
  'field.database': '数据库 / Schema',
  'field.serviceName': 'Service name',
  'field.user': '用户',
  'field.password': '密码',
  'action.cancel': '取消',
  'action.save': '保存',
  'action.test': '测试连接',
  'status.testing': '正在测试连接',
  'status.saving': '正在保存',
  'status.connected': '连接成功',
  'status.load': '加载工作台',
  'status.catalog': '读取数据库对象',
  'status.refresh': '刷新数据库对象',
  'status.deleteConnection': '删除连接',
  'status.createQuery': '新建查询',
  'status.switchQuery': '切换当前查询',
  'status.openQuery': '打开保存查询',
  'status.runQuery': '执行查询',
  'status.preview': '预览对象数据',
  'status.saveQuery': '保存查询',
  'status.copyName': '复制对象名称',
  'status.closeQuery': '关闭查询',
  'status.deleteQuery': '删除保存查询',
  'menu.addDatabase': '添加数据库到对话',
  'menu.preview': '预览数据',
  'menu.add': '添加到对话',
  'menu.copyName': '复制限定名',
  'menu.delete': '删除',
} as const

const en: Record<keyof typeof zh, string> = {
  'tab.database': 'Database',
  'connection.label': 'Database connection',
  'connection.none': 'Select connection',
  'connection.new': 'New connection',
  'connection.edit': 'Edit connection',
  'connection.delete': 'Delete connection',
  'connection.refresh': 'Refresh objects',
  'mode.objects': 'Objects',
  'mode.query': 'Queries',
  'mode.results': 'Results',
  'mode.messages': 'Messages',
  'search.objects': 'Search objects',
  'group.drafts': 'Drafts and working copies',
  'group.saved': 'Saved queries',
  'query.new': 'New query',
  'query.untitled': 'Untitled query {count}',
  'query.run': 'Run query',
  'query.run.short': 'Run',
  'query.save': 'Save query',
  'query.addCurrent': 'Add current query to chat',
  'query.add': 'Add query to chat',
  'query.current': 'Set as current query',
  'query.openCopy': 'Open working copy',
  'query.close': 'Close query',
  'query.name': 'Query name',
  'result.empty': 'No query results yet',
  'result.status': '{rows} rows · {duration} ms',
  'result.total': '{rows} total rows',
  'result.page': 'Page {page} / {pages}',
  'result.previous': 'Previous page',
  'result.next': 'Next page',
  'result.filter': 'Filter',
  'result.applyFilters': 'Apply filters',
  'tree.selectConnection': 'Select a connection to load objects',
  'details.connection': 'Connection',
  'details.schemas': 'Schemas',
  'details.objects': 'Objects',
  'details.tables': 'Tables',
  'details.views': 'Views',
  'details.database': 'Database',
  'details.schema': 'Schema',
  'details.columns': 'Columns',
  'details.rows': 'Estimated rows',
  'details.engine': 'Engine',
  'details.owner': 'Owner',
  'details.name': 'Name',
  'details.type': 'Data type',
  'details.nullable': 'Nullable',
  'details.default': 'Default',
  'details.yes': 'Yes',
  'details.no': 'No',
  'details.definition': 'Definition',
  'details.indexes': 'Indexes',
  'details.unique': 'Unique',
  'details.primary': 'Primary',
  'dialog.connection': 'Database connection',
  'dialog.connection.new': 'New connection',
  'dialog.connection.edit': 'Edit connection',
  'field.name': 'Name',
  'field.type': 'Type',
  'field.file': 'Database file',
  'field.host': 'Host',
  'field.port': 'Port',
  'field.database': 'Database / schema',
  'field.serviceName': 'Service name',
  'field.user': 'User',
  'field.password': 'Password',
  'action.cancel': 'Cancel',
  'action.save': 'Save',
  'action.test': 'Test connection',
  'status.testing': 'Testing connection',
  'status.saving': 'Saving',
  'status.connected': 'Connected',
  'status.load': 'Loading workbench',
  'status.catalog': 'Loading database objects',
  'status.refresh': 'Refreshing database objects',
  'status.deleteConnection': 'Deleting connection',
  'status.createQuery': 'Creating query',
  'status.switchQuery': 'Switching current query',
  'status.openQuery': 'Opening saved query',
  'status.runQuery': 'Running query',
  'status.preview': 'Previewing object data',
  'status.saveQuery': 'Saving query',
  'status.copyName': 'Copying object name',
  'status.closeQuery': 'Closing query',
  'status.deleteQuery': 'Deleting saved query',
  'menu.addDatabase': 'Add database to chat',
  'menu.preview': 'Preview data',
  'menu.add': 'Add to chat',
  'menu.copyName': 'Copy qualified name',
  'menu.delete': 'Delete',
}

export type TranslationKey = keyof typeof zh
export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

interface LocaleContext extends Context {
  locale: {
    getSnapshot(): { active: string }
    subscribe(listener: () => void): () => void
  }
}

function format(text: string, params?: Record<string, string | number>): string {
  if (params === undefined) return text
  let output = text
  for (const [key, value] of Object.entries(params)) output = output.replaceAll('{' + key + '}', String(value))
  return output
}

export function translate(ctx: Context, key: TranslationKey, params?: Record<string, string | number>): string {
  const active = (ctx as LocaleContext).locale.getSnapshot().active
  return format(active.startsWith('zh') ? zh[key] : en[key], params)
}

const TranslationContext = createContext<Translate | null>(null)

export function I18nProvider({ ctx, children }: { ctx: Context; children: ReactNode }) {
  const locale = (ctx as LocaleContext).locale
  const active = useSyncExternalStore(
    listener => locale.subscribe(listener),
    () => locale.getSnapshot().active,
  )
  const t = useCallback<Translate>((key, params) => format(active.startsWith('zh') ? zh[key] : en[key], params), [active])
  return <TranslationContext.Provider value={t}>{children}</TranslationContext.Provider>
}

export function useT(): Translate {
  const t = useContext(TranslationContext)
  if (t === null) throw new Error('SQL workbench translations are unavailable')
  return t
}
