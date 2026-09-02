import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import {
  VscAdd,
  VscClose,
  VscComment,
  VscDatabase,
  VscEdit,
  VscFile,
  VscFolderOpened,
  VscPlay,
  VscRefresh,
  VscSave,
  VscSearch,
  VscTable,
  VscTrash,
} from 'react-icons/vsc'
import { qualifiedObjectName } from '../dialects.ts'
import type {
  CatalogDatabase,
  CatalogObject,
  CatalogSnapshot,
  ConnectionConfig,
  ObjectPreviewRequest,
  QueryDraft,
  SavedQuery,
  WorkbenchState,
} from '../types.ts'
import { sqlApi, subscribeSqlState } from './api.ts'
import { CodeEditor } from './CodeEditor.tsx'
import { ConnectionDialog } from './ConnectionDialog.tsx'
import { ConnectionPicker } from './ConnectionPicker.tsx'
import { useT } from './i18n.tsx'
import { ObjectDetailsPane } from './ObjectDetailsPane.tsx'
import { ObjectTree, type ObjectContextTarget } from './ObjectTree.tsx'
import { ResultGrid } from './ResultGrid.tsx'
import { createWorkbenchStore, useWorkbench, WorkbenchStoreContext } from './store.ts'
import css from './SqlWorkbench.module.css'

interface ConversationInput {
  state: { getSnapshot(): { draft: string } }
  setDraft(text: string): void
}

interface ConversationService {
  input: { for(scope: Context): ConversationInput }
}

interface ClientContext extends Context {
  sessions: { scope(sessionId: string): Context | undefined }
}

interface MenuState {
  x: number
  y: number
  target:
    | ObjectContextTarget
    | { kind: 'draft'; draft: QueryDraft }
    | { kind: 'saved'; query: SavedQuery }
}

export interface SqlWorkbenchProps {
  ctx: Context
  sessionId: string
  visible: boolean
}

function qualifiedName(connection: ConnectionConfig, object: CatalogObject): string {
  return qualifiedObjectName(connection.kind, object)
}

function ContextMenu({ menu, onClose, children }: { menu: MenuState; onClose(): void; children: React.ReactNode }) {
  useEffect(() => {
    const close = (): void => { onClose() }
    document.addEventListener('pointerdown', close)
    return () => { document.removeEventListener('pointerdown', close) }
  }, [onClose])
  const left = Math.min(menu.x, window.innerWidth - 184)
  const top = Math.min(menu.y, window.innerHeight - 148)
  return <div className={css.contextMenu} style={{ left, top }} onPointerDown={event => { event.stopPropagation() }}>
    {children}
  </div>
}

function SqlWorkbenchBody({ ctx, sessionId, visible }: SqlWorkbenchProps) {
  const t = useT()
  const server = useWorkbench(state => state.server)
  const catalog = useWorkbench(state => state.catalog)
  const selectedConnectionId = useWorkbench(state => state.selectedConnectionId)
  const selectedDatabase = useWorkbench(state => state.selectedDatabase)
  const selectedObject = useWorkbench(state => state.selectedObject)
  const mainMode = useWorkbench(state => state.mainMode)
  const explorerMode = useWorkbench(state => state.explorerMode)
  const loading = useWorkbench(state => state.loading)
  const error = useWorkbench(state => state.error)
  const adoptServer = useWorkbench(state => state.adoptServer)
  const setCatalog = useWorkbench(state => state.setCatalog)
  const selectConnection = useWorkbench(state => state.selectConnection)
  const selectDatabase = useWorkbench(state => state.selectDatabase)
  const selectObject = useWorkbench(state => state.selectObject)
  const setMainMode = useWorkbench(state => state.setMainMode)
  const setExplorerMode = useWorkbench(state => state.setExplorerMode)
  const setLoading = useWorkbench(state => state.setLoading)
  const setError = useWorkbench(state => state.setError)
  const updateDraftLocal = useWorkbench(state => state.updateDraftLocal)
  const [search, setSearch] = useState('')
  const [connectionDialog, setConnectionDialog] = useState<ConnectionConfig | null | undefined>(undefined)
  const [saveDialog, setSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const editorSql = useRef('')

  const current = server?.drafts.find(draft => draft.id === server.currentDraftId) ?? null
  const selectedConnection = server?.connections.find(connection => connection.id === selectedConnectionId) ?? null

  const perform = useCallback(async <T,>(label: string, action: () => Promise<T>): Promise<T | undefined> => {
    setLoading(label)
    setError(null)
    try {
      return await action()
    } catch (failure) {
      console.error('[dsh-sql-workbench] ' + label + ' failed', failure)
      setError(failure instanceof Error ? failure.message : String(failure))
      return undefined
    } finally {
      setLoading(null)
    }
  }, [setError, setLoading])

  useEffect(() => {
    if (!visible) return
    void perform(t('status.load'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('state', { sessionId }))
    })
    return subscribeSqlState(sessionId, adoptServer, failure => {
      console.error('[dsh-sql-workbench] state subscription failed', failure)
      setError(failure.message)
    })
  }, [adoptServer, perform, sessionId, setError, visible])

  useEffect(() => {
    if (!visible || selectedConnectionId === null) return
    void perform(t('status.catalog'), async () => {
      setCatalog(await sqlApi<CatalogSnapshot>('catalog.list', { connectionId: selectedConnectionId }))
    })
  }, [perform, selectedConnectionId, setCatalog, visible])

  useEffect(() => { editorSql.current = current?.sql ?? '' }, [current?.id, current?.sql])

  const updateSql = useCallback((sql: string): void => {
    if (current === null) return
    editorSql.current = sql
    updateDraftLocal(current.id, sql)
  }, [current, updateDraftLocal])

  const commitSql = useCallback((sql: string): void => {
    if (current === null) return
    editorSql.current = sql
    void sqlApi<WorkbenchState>('draft.update', { sessionId, draftId: current.id, sql }).catch(failure => {
      console.error('[dsh-sql-workbench] commit query draft failed', failure)
      setError(failure instanceof Error ? failure.message : String(failure))
    })
  }, [current, sessionId, setError])

  const appendToChat = useCallback((reference: unknown): void => {
    const scope = (ctx as ClientContext).sessions.scope(sessionId)
    if (scope === undefined) throw new Error('Conversation scope is unavailable: ' + sessionId)
    const conversation = scope.get('conversation') as ConversationService
    const input = conversation.input.for(scope)
    const draft = input.state.getSnapshot().draft
    const block = '[SQL Workbench Reference]\n' + JSON.stringify(reference, null, 2) + '\n[/SQL Workbench Reference]'
    input.setDraft(draft === '' ? block : draft + '\n\n' + block)
  }, [ctx, sessionId])

  const refreshCatalog = (): void => {
    if (selectedConnectionId === null) return
    void perform(t('status.refresh'), async () => {
      setCatalog(await sqlApi<CatalogSnapshot>('catalog.list', { connectionId: selectedConnectionId }))
    })
  }

  const deleteConnection = (): void => {
    if (selectedConnectionId === null) return
    void perform(t('status.deleteConnection'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('connections.delete', { sessionId, connectionId: selectedConnectionId }))
      setCatalog(null)
    })
  }

  const createDraft = (sql = ''): void => {
    if (selectedConnectionId === null || server === null) return
    const count = server.drafts.length + 1
    void perform(t('status.createQuery'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('draft.create', {
        sessionId,
        connectionId: selectedConnectionId,
        name: t('query.untitled', { count }),
        sql,
      }))
      setMainMode('query')
    })
  }

  const closeDraft = (draft: QueryDraft): void => {
    void perform(t('status.closeQuery'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('draft.delete', { sessionId, draftId: draft.id }))
    })
  }

  const setCurrent = (draft: QueryDraft): void => {
    void perform(t('status.switchQuery'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('draft.current', { sessionId, draftId: draft.id }))
      selectConnection(draft.connectionId)
      setMainMode('query')
    })
  }

  const openSaved = (query: SavedQuery): void => {
    void perform(t('status.openQuery'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('saved.open', { sessionId, savedQueryId: query.id }))
      selectConnection(query.connectionId)
      setMainMode('query')
    })
  }

  const runCurrent = (): void => {
    if (current === null) return
    void perform(t('status.runQuery'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('query.run', {
        sessionId,
        connectionId: current.connectionId,
        draftId: current.id,
        sql: editorSql.current,
      }))
      setMainMode('results')
    })
  }

  const showObjectDetails = (object: CatalogObject): void => {
    if (selectedConnectionId === null) return
    selectObject(object)
    setMainMode('objects')
    void perform(t('status.catalog'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('object.details', { sessionId, connectionId: selectedConnectionId, object }))
    })
  }

  const updatePreview = (request: ObjectPreviewRequest): void => {
    if (selectedConnectionId === null) return
    void perform(t('status.preview'), async () => {
      adoptServer(await sqlApi<WorkbenchState>('object.preview', { sessionId, connectionId: selectedConnectionId, request }))
      setMainMode('results')
    })
  }

  const previewObject = (object: CatalogObject): void => {
    updatePreview({ object, page: 1, pageSize: 50, filters: [], sort: null })
  }

  const saveCurrent = (): void => {
    if (current === null) return
    setSaveName(current.name)
    setSaveDialog(true)
  }

  const submitSave = (): void => {
    void perform(t('status.saveQuery'), async () => {
      if (current === null) return
      adoptServer(await sqlApi<WorkbenchState>('draft.save', {
        sessionId,
        draftId: current.id,
        sql: editorSql.current,
        name: saveName,
      }))
      setSaveDialog(false)
    })
  }

  const saveConnection = async (connection: ConnectionConfig): Promise<void> => {
    const next = await sqlApi<WorkbenchState>('connections.save', { sessionId, connection })
    adoptServer(next)
    const saved = connection.id === ''
      ? next.connections[next.connections.length - 1]
      : next.connections.find(item => item.id === connection.id)
    if (saved !== undefined) selectConnection(saved.id)
  }

  const testConnection = async (connection: ConnectionConfig): Promise<void> => {
    await sqlApi('connections.test', { connection })
  }

  const referenceConnection = selectedConnection
  const addObjectReference = (object: CatalogObject): void => {
    appendToChat({ type: object.kind, connection: referenceConnection, object })
  }
  const addDatabaseReference = (database: CatalogDatabase): void => {
    appendToChat({ type: 'database', connection: referenceConnection, database })
  }
  const addDraftReference = (draft: QueryDraft): void => {
    const connection = server?.connections.find(item => item.id === draft.connectionId)
    appendToChat({ type: 'query-draft', connection, query: draft })
  }
  const addSavedReference = (query: SavedQuery): void => {
    const connection = server?.connections.find(item => item.id === query.connectionId)
    appendToChat({ type: 'saved-query', connection, query })
  }

  const objectSql = (object: CatalogObject): string => 'SELECT * FROM ' + qualifiedName(selectedConnection as ConnectionConfig, object) + ';'
  const menuTarget = menu?.target ?? null

  return <div className={css.root} data-dsh-sql-workbench data-mode={mainMode}>
    <div className={css.topbar}>
      <VscDatabase size={16} />
      <ConnectionPicker
        connections={server?.connections ?? []}
        selectedId={selectedConnectionId}
        onSelect={selectConnection}
      />
      <button className={css.iconButton} title={t('connection.new')} onClick={() => { setConnectionDialog(null) }}><VscAdd /></button>
      <button className={css.iconButton} title={t('connection.edit')} disabled={selectedConnection === null} onClick={() => { setConnectionDialog(selectedConnection) }}><VscEdit /></button>
      <button className={css.iconButton} title={t('connection.delete')} disabled={selectedConnection === null} onClick={deleteConnection}><VscTrash /></button>
      <button className={css.iconButton} title={t('connection.refresh')} disabled={selectedConnection === null} onClick={refreshCatalog}><VscRefresh /></button>
    </div>

    <div className={css.modebar}>
      <button data-active={mainMode === 'objects'} onClick={() => { setMainMode('objects') }}>{t('mode.objects')}</button>
      <button data-active={mainMode === 'query'} onClick={() => { setMainMode('query') }}>{t('mode.query')}</button>
      <button data-active={mainMode === 'results'} onClick={() => { setMainMode('results') }}>{t('mode.results')}</button>
    </div>

    {error !== null && <div className={css.errorBar}>{error}</div>}
    {loading !== null && <div className={css.loadingBar}>{loading}</div>}

    <div className={css.body}>
      <aside className={css.explorer}>
        <div className={css.explorerTabs} data-sql-explorer-tabs>
          <button data-active={explorerMode === 'objects'} onClick={() => { setExplorerMode('objects') }}>{t('mode.objects')}</button>
          <button data-active={explorerMode === 'queries'} onClick={() => { setExplorerMode('queries') }}>{t('mode.query')}</button>
          <button className={css.iconButton} title={t('query.new')} onClick={() => { createDraft() }}><VscAdd /></button>
        </div>
        {explorerMode === 'objects' ? <>
          <label className={css.searchBox}><VscSearch size={14} /><input value={search} onChange={event => { setSearch(event.target.value) }} placeholder={t('search.objects')} /></label>
          <ObjectTree
            catalog={catalog}
            search={search}
            selectedDatabase={selectedDatabase}
            selected={selectedObject}
            onSelectDatabase={database => { selectDatabase(database); setMainMode('objects') }}
            onSelect={showObjectDetails}
            onPreview={previewObject}
            onContextMenu={(event, target) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, target }) }}
          />
        </> : <div className={css.queryList}>
          <div className={css.groupLabel}>{t('group.drafts')}</div>
          {server?.drafts.map(draft => <button
            key={draft.id}
            className={css.queryRow}
            data-current={draft.id === server.currentDraftId}
            onClick={() => { setCurrent(draft) }}
            onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, target: { kind: 'draft', draft } }) }}
          >
            <VscFile size={15} />
            <span>{draft.name}</span>
            {draft.dirty && <span className={css.dirtyDot} />}
          </button>)}
          <div className={css.groupLabel}>{t('group.saved')}</div>
          {server?.savedQueries.map(query => <button
            key={query.id}
            className={css.queryRow}
            onDoubleClick={() => { openSaved(query) }}
            onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, target: { kind: 'saved', query } }) }}
          >
            <VscFolderOpened size={15} /><span>{query.name}</span>
          </button>)}
        </div>}
      </aside>

      <main className={css.workspace}>
        {mainMode === 'objects' ? <ObjectDetailsPane
          connection={selectedConnection}
          database={selectedDatabase}
          object={selectedObject}
          details={server?.objectDetails ?? null}
          onPreview={previewObject}
          onSend={addObjectReference}
        /> : <>
          <div className={css.queryTabs}>
            {server?.drafts.map(draft => <div key={draft.id} className={css.queryTab} data-active={draft.id === server.currentDraftId}>
              <button className={css.queryTabMain} onClick={() => { setCurrent(draft) }}>
                <span>{draft.name}</span>
                {draft.dirty && <span className={css.dirtyDot} />}
              </button>
              <button className={css.queryTabClose} title={t('query.close')} onClick={() => { closeDraft(draft) }}><VscClose /></button>
            </div>)}
            <button className={css.iconButton} title={t('query.new')} onClick={() => { createDraft() }}><VscAdd /></button>
          </div>
          {mainMode === 'results' ? <section className={css.resultsPane}>
            <div className={css.resultTabs}><button data-active>{t('mode.results')}</button><button>{t('mode.messages')}</button></div>
            <ResultGrid result={server?.preview ?? server?.result ?? null} onPreviewChange={updatePreview} />
          </section> : current === null || selectedConnection === null ? <div className={css.workspaceEmpty}>
            <VscDatabase size={28} />
            <button className={css.primaryButton} disabled={selectedConnectionId === null} onClick={() => { createDraft() }}>{t('query.new')}</button>
          </div> : <>
            <div className={css.queryToolbar}>
              <button className={css.commandButton} title={t('query.run')} onClick={runCurrent}><VscPlay />{t('query.run.short')}</button>
              <button className={css.iconButton} title={t('query.save')} onClick={saveCurrent}><VscSave /></button>
              <button className={css.commandButton} title={t('query.addCurrent')} onClick={() => { addDraftReference(current) }}><VscComment />{t('menu.add')}</button>
              <span className={css.toolbarSpacer} />
              <span className={css.connectionMeta}>{selectedConnection.kind}</span>
            </div>
            <section className={css.editorPane}>
              <CodeEditor value={current.sql} kind={selectedConnection.kind} onChange={updateSql} onCommit={commitSql} />
            </section>
            <section className={css.resultsPane}>
              <div className={css.resultTabs}><button data-active>{t('mode.results')}</button><button>{t('mode.messages')}</button></div>
              <ResultGrid result={server?.preview ?? server?.result ?? null} onPreviewChange={updatePreview} />
            </section>
          </>}
        </>}
      </main>
    </div>

    {connectionDialog !== undefined && <ConnectionDialog
      connection={connectionDialog}
      onClose={() => { setConnectionDialog(undefined) }}
      onSave={saveConnection}
      onTest={testConnection}
    />}

    {saveDialog && <div className={css.dialogBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setSaveDialog(false) }}>
      <div className={css.dialog} role="dialog" aria-label={t('query.save')}>
        <div className={css.dialogTitle}>{t('query.save')}</div>
        <label className={css.field}><span>{t('query.name')}</span><input value={saveName} onChange={event => { setSaveName(event.target.value) }} /></label>
        <div className={css.dialogActions}><button onClick={() => { setSaveDialog(false) }}>{t('action.cancel')}</button><button className={css.primaryButton} onClick={submitSave}>{t('action.save')}</button></div>
      </div>
    </div>}

    {menu !== null && menuTarget !== null && <ContextMenu menu={menu} onClose={() => { setMenu(null) }}>
      {menuTarget.kind === 'database' && <button onClick={() => { addDatabaseReference(menuTarget.database); setMenu(null) }}><VscComment />{t('menu.addDatabase')}</button>}
      {menuTarget.kind === 'object' && <>
        <button onClick={() => { previewObject(menuTarget.object); setMenu(null) }}><VscTable />{t('menu.preview')}</button>
        <button onClick={() => { createDraft(objectSql(menuTarget.object)); setMenu(null) }}><VscAdd />{t('query.new')}</button>
        <button onClick={() => { addObjectReference(menuTarget.object); setMenu(null) }}><VscComment />{t('menu.add')}</button>
        <button onClick={() => { void perform(t('status.copyName'), async () => { await navigator.clipboard.writeText(qualifiedName(selectedConnection as ConnectionConfig, menuTarget.object)) }); setMenu(null) }}><VscFile />{t('menu.copyName')}</button>
      </>}
      {menuTarget.kind === 'draft' && <>
        <button onClick={() => { setCurrent(menuTarget.draft); setMenu(null) }}><VscEdit />{t('query.current')}</button>
        <button onClick={() => { addDraftReference(menuTarget.draft); setMenu(null) }}><VscComment />{t('query.add')}</button>
        <button onClick={() => { setCurrent(menuTarget.draft); setSaveName(menuTarget.draft.name); setSaveDialog(true); setMenu(null) }}><VscSave />{t('query.save')}</button>
        <button onClick={() => { closeDraft(menuTarget.draft); setMenu(null) }}><VscClose />{t('query.close')}</button>
      </>}
      {menuTarget.kind === 'saved' && <>
        <button onClick={() => { openSaved(menuTarget.query); setMenu(null) }}><VscEdit />{t('query.openCopy')}</button>
        <button onClick={() => { addSavedReference(menuTarget.query); setMenu(null) }}><VscComment />{t('query.add')}</button>
        <button onClick={() => { void perform(t('status.deleteQuery'), async () => { adoptServer(await sqlApi<WorkbenchState>('saved.delete', { sessionId, savedQueryId: menuTarget.query.id })) }); setMenu(null) }}><VscTrash />{t('menu.delete')}</button>
      </>}
    </ContextMenu>}
  </div>
}

export function SqlWorkbench(props: SqlWorkbenchProps) {
  const store = useMemo(() => createWorkbenchStore(), [props.sessionId])
  return <WorkbenchStoreContext.Provider value={store}><SqlWorkbenchBody {...props} /></WorkbenchStoreContext.Provider>
}
