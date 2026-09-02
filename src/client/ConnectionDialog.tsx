import { useState } from 'react'
import { driverCapabilities } from '../dialects.ts'
import type { ConnectionConfig, ConnectionKind } from '../types.ts'
import { useT } from './i18n.tsx'
import css from './SqlWorkbench.module.css'

interface ConnectionForm {
  id: string
  name: string
  kind: ConnectionKind
  file: string
  host: string
  port: number
  user: string
  password: string
  database: string
  serviceName: string
}

function formOf(connection: ConnectionConfig | null): ConnectionForm {
  if (connection === null) {
    return { id: '', name: '', kind: 'sqlite', file: '', host: '127.0.0.1', port: 0, user: '', password: '', database: '', serviceName: '' }
  }
  if (connection.kind === 'sqlite') {
    return { id: connection.id, name: connection.name, kind: connection.kind, file: connection.file, host: '', port: 0, user: '', password: '', database: '', serviceName: '' }
  }
  return {
    id: connection.id,
    name: connection.name,
    kind: connection.kind,
    file: '',
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password ?? '',
    database: connection.database,
    serviceName: connection.kind === 'oracle' ? connection.serviceName : '',
  }
}

function connectionOf(form: ConnectionForm): ConnectionConfig {
  if (form.kind === 'sqlite') return { id: form.id, name: form.name, kind: form.kind, file: form.file }
  const network = { id: form.id, name: form.name, host: form.host, port: form.port, user: form.user, password: form.password, database: form.database }
  if (form.kind === 'oracle') return { ...network, kind: form.kind, serviceName: form.serviceName }
  return { ...network, kind: form.kind }
}

export interface ConnectionDialogProps {
  connection: ConnectionConfig | null
  onClose(): void
  onSave(connection: ConnectionConfig): Promise<void>
  onTest(connection: ConnectionConfig): Promise<void>
}

export function ConnectionDialog({ connection, onClose, onSave, onTest }: ConnectionDialogProps) {
  const t = useT()
  const [form, setForm] = useState(() => formOf(connection))
  const [status, setStatus] = useState<string | null>(null)
  const patch = (value: Partial<ConnectionForm>): void => { setForm(current => ({ ...current, ...value })) }
  const execute = async (action: 'test' | 'save'): Promise<void> => {
    setStatus(action === 'test' ? t('status.testing') : t('status.saving'))
    try {
      if (action === 'test') await onTest(connectionOf(form))
      else await onSave(connectionOf(form))
      setStatus(action === 'test' ? t('status.connected') : null)
      if (action === 'save') onClose()
    } catch (error) {
      console.error('[dsh-sql-workbench] connection action failed', error)
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  return <div className={css.dialogBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className={css.dialog} role="dialog" aria-label={t('dialog.connection')}>
      <div className={css.dialogTitle}>{connection === null ? t('dialog.connection.new') : t('dialog.connection.edit')}</div>
      <label className={css.field}><span>{t('field.name')}</span><input value={form.name} onChange={event => { patch({ name: event.target.value }) }} /></label>
      <label className={css.field}><span>{t('field.type')}</span><select value={form.kind} onChange={event => {
        const kind = event.target.value as ConnectionKind
        patch({ kind, port: driverCapabilities(kind).defaultPort ?? 0 })
      }}><option value="sqlite">SQLite</option><option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option><option value="doris">Apache Doris</option><option value="oracle">Oracle</option></select></label>
      {form.kind === 'sqlite' ? <label className={css.field}><span>{t('field.file')}</span><input value={form.file} onChange={event => { patch({ file: event.target.value }) }} /></label> : <>
        <div className={css.fieldRow}>
          <label className={css.field}><span>{t('field.host')}</span><input value={form.host} onChange={event => { patch({ host: event.target.value }) }} /></label>
          <label className={css.fieldSmall}><span>{t('field.port')}</span><input type="number" value={form.port} onChange={event => { patch({ port: Number(event.target.value) }) }} /></label>
        </div>
        {form.kind === 'oracle' && <label className={css.field}><span>{t('field.serviceName')}</span><input value={form.serviceName} onChange={event => { patch({ serviceName: event.target.value }) }} /></label>}
        <label className={css.field}><span>{t('field.database')}</span><input value={form.database} onChange={event => { patch({ database: event.target.value }) }} /></label>
        <label className={css.field}><span>{t('field.user')}</span><input value={form.user} onChange={event => { patch({ user: event.target.value }) }} /></label>
        <label className={css.field}><span>{t('field.password')}</span><input type="password" value={form.password} onChange={event => { patch({ password: event.target.value }) }} /></label>
      </>}
      {status !== null && <div className={css.dialogStatus}>{status}</div>}
      <div className={css.dialogActions}>
        <button onClick={onClose}>{t('action.cancel')}</button>
        <button onClick={() => { void execute('test') }}>{t('action.test')}</button>
        <button className={css.primaryButton} onClick={() => { void execute('save') }}>{t('action.save')}</button>
      </div>
    </div>
  </div>
}
