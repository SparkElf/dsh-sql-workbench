import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { VscDatabase } from 'react-icons/vsc'
import { I18nProvider, translate } from './i18n.tsx'
import { SqlWorkbench } from './SqlWorkbench.tsx'

const TAB_ID = 'dsh-sql-workbench'
const TAB_KIND = 'sql-workbench'

export const inject = ['slots', 'sidebarRightTabs', 'locale']

/** Register the SQL workbench as an official right-Sidebar page type. */
export function apply(ctx: Context): void {
  const Body = (props: PropsRuntime<'sidebar.right.pane.tab'>) => {
    const { tab } = props.useTabInfo()
    return <I18nProvider ctx={ctx}><SqlWorkbench ctx={ctx} sessionId={props.sessionId} visible={tab.visible} /></I18nProvider>
  }
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    title: () => translate(ctx, 'tab.database'),
    guide: [{ order: 45, title: () => translate(ctx, 'tab.database'), description: () => translate(ctx, 'tab.database'), icon: VscDatabase }],
  }), 'dsh-sql-workbench: right Sidebar type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: TAB_ID },
    Body,
  )), 'dsh-sql-workbench: right Sidebar body')
}
