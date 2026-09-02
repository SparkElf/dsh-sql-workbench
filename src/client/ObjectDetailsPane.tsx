import { VscComment, VscEye, VscTable } from 'react-icons/vsc'
import type { CatalogDatabase, CatalogObject, ConnectionConfig, ObjectDetails } from '../types.ts'
import { driverCapabilities } from '../dialects.ts'
import { useT } from './i18n.tsx'
import css from './SqlWorkbench.module.css'

export interface ObjectDetailsPaneProps {
  connection: ConnectionConfig | null
  database: CatalogDatabase | null
  object: CatalogObject | null
  details: ObjectDetails | null
  onPreview(object: CatalogObject): void
  onSend(object: CatalogObject): void
}

export function ObjectDetailsPane({ connection, database, object, details, onPreview, onSend }: ObjectDetailsPaneProps) {
  const t = useT()
  if (connection === null) return <div className={css.workspaceEmpty}>{t('tree.selectConnection')}</div>
  const capabilities = driverCapabilities(connection.kind)
  if (object === null) {
    const schemaCount = database?.schemas.length ?? 0
    const objects = database?.schemas.flatMap(schema => schema.objects) ?? []
    return <section className={css.detailsPane} data-sql-database-details>
      <header className={css.detailsHeader}><VscTable size={18} /><div><h2>{database?.name ?? connection.name}</h2><span>{capabilities.label} · {connection.versionHint || capabilities.versionRange}</span></div></header>
      <dl className={css.detailsGrid}>
        <div><dt>{t('details.connection')}</dt><dd>{connection.name}</dd></div>
        {'host' in connection && <div><dt>{t('field.host')}</dt><dd>{connection.host}:{connection.port}</dd></div>}
        <div><dt>{t('details.schemas')}</dt><dd>{schemaCount}</dd></div>
        <div><dt>{t('details.objects')}</dt><dd>{objects.length}</dd></div>
        <div><dt>{t('details.tables')}</dt><dd>{objects.filter(item => item.kind === 'table').length}</dd></div>
        <div><dt>{t('details.views')}</dt><dd>{objects.filter(item => item.kind === 'view').length}</dd></div>
      </dl>
    </section>
  }
  const value = details?.object ?? object
  return <section className={css.detailsPane} data-sql-object-details>
    <header className={css.detailsHeader}>{value.kind === 'table' ? <VscTable size={18} /> : <VscEye size={18} />}<div><h2>{value.name}</h2><span>{details?.qualifiedName ?? value.name} · {value.kind}</span></div><span className={css.toolbarSpacer} /><button className={css.commandButton} onClick={() => { onPreview(value) }}><VscEye />{t('menu.preview')}</button><button className={css.commandButton} onClick={() => { onSend(value) }}><VscComment />{t('menu.add')}</button></header>
    <dl className={css.detailsGrid}>
      <div><dt>{t('details.database')}</dt><dd>{value.database}</dd></div>
      <div><dt>{t('details.schema')}</dt><dd>{value.schema ?? '-'}</dd></div>
      <div><dt>{t('details.columns')}</dt><dd>{value.columns.length}</dd></div>
      <div><dt>{t('details.rows')}</dt><dd>{value.estimatedRows ?? '-'}</dd></div>
      <div><dt>{t('details.engine')}</dt><dd>{value.engine ?? '-'}</dd></div>
      <div><dt>{t('details.owner')}</dt><dd>{value.owner ?? '-'}</dd></div>
    </dl>
    {details !== null && details.indexes.length > 0 && <>
      <div className={css.detailsSectionTitle}>{t('details.indexes')}</div>
      <div className={css.resultScroll}><table className={css.resultTable}><thead><tr><th>{t('details.name')}</th><th>{t('details.columns')}</th><th>{t('details.type')}</th><th>{t('details.unique')}</th><th>{t('details.primary')}</th></tr></thead><tbody>{details.indexes.map(index => <tr key={index.name}><td>{index.name}</td><td>{index.columns.join(', ')}</td><td>{index.type ?? '-'}</td><td>{index.unique ? t('details.yes') : t('details.no')}</td><td>{index.primary ? t('details.yes') : t('details.no')}</td></tr>)}</tbody></table></div>
    </>}
    <div className={css.detailsSectionTitle}>{t('details.columns')}</div>
    <div className={css.resultScroll}><table className={css.resultTable}><thead><tr><th>#</th><th>{t('details.name')}</th><th>{t('details.type')}</th><th>{t('details.nullable')}</th><th>{t('details.default')}</th></tr></thead><tbody>{value.columns.map(column => <tr key={column.name}><td>{column.ordinal}</td><td>{column.name}</td><td>{column.dataType}</td><td>{column.nullable ? t('details.yes') : t('details.no')}</td><td>{column.defaultValue ?? 'NULL'}</td></tr>)}</tbody></table></div>
    {value.definition !== null && <><div className={css.detailsSectionTitle}>{t('details.definition')}</div><pre className={css.definition}>{value.definition}</pre></>}
  </section>
}
