import type { Context } from '@deepseek-ai/cordis'
import type {} from 'dsh-better-sidebar/client/service'
import type { TabComponentProps } from 'dsh-better-sidebar/client/service'
import { VscDatabase } from 'react-icons/vsc'
import { I18nProvider, translate } from './i18n.tsx'
import { SqlWorkbench } from './SqlWorkbench.tsx'

export const inject = ['betterSidebar', 'locale']

function SqlTab({ ctx, scope, visible }: TabComponentProps) {
  return <I18nProvider ctx={ctx}><SqlWorkbench ctx={ctx} sessionId={scope.sessionId} visible={visible} /></I18nProvider>
}

/** 将 SQL 工作台作为 Better Sidebar 单实例页面注册到新增菜单。 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.betterSidebar.registerTab({
    id: 'dsh-sql-workbench:database',
    title: () => translate(ctx, 'tab.database'),
    icon: size => <VscDatabase size={size} />,
    order: 45,
    single: true,
    component: SqlTab,
  }), 'dsh-sql-workbench: Better Sidebar tab')
}
