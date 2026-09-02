import { useEffect, useState } from 'react'
import { VscChevronLeft, VscChevronRight, VscFilter } from 'react-icons/vsc'
import type { ObjectPreviewRequest, PagedQueryResult, PreviewFilter, QueryResult } from '../types.ts'
import { useT } from './i18n.tsx'
import css from './SqlWorkbench.module.css'

interface ResultGridProps {
  result: QueryResult | PagedQueryResult | null
  onPreviewChange?(request: ObjectPreviewRequest): void
}

function isPaged(result: QueryResult): result is PagedQueryResult {
  return 'page' in result && 'object' in result
}

export function ResultGrid({ result, onPreviewChange }: ResultGridProps) {
  const t = useT()
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  useEffect(() => { setFilterValues({}) }, [result !== null && isPaged(result) ? result.object.name : null])
  if (result === null) return <div className={css.empty}>{t('result.empty')}</div>
  const paged = isPaged(result) ? result : null
  const change = (request: ObjectPreviewRequest): void => { onPreviewChange?.(request) }
  const applyFilters = (): void => {
    if (paged === null) return
    const filters: PreviewFilter[] = Object.entries(filterValues).filter(([, value]) => value !== '').map(([column, value]) => ({ column, operator: 'contains', value }))
    change({ object: paged.object, page: 1, pageSize: paged.pageSize, sort: paged.sort, filters })
  }
  const sort = (column: string): void => {
    if (paged === null) return
    const direction = paged.sort?.column === column && paged.sort.direction === 'asc' ? 'desc' : 'asc'
    change({ object: paged.object, page: 1, pageSize: paged.pageSize, sort: { column, direction }, filters: paged.filters })
  }
  const rowOffset = paged === null ? 0 : (paged.page - 1) * paged.pageSize
  return <div className={css.resultArea} data-sql-result-grid>
    <div className={css.resultScroll}>
      <table className={css.resultTable}>
        <thead>
          <tr><th className={css.rowNumber}>#</th>{result.columns.map(column => <th key={column}>{paged === null ? column : <button className={css.columnSort} onClick={() => { sort(column) }}>{column}<span>{paged.sort?.column === column ? paged.sort.direction === 'asc' ? '↑' : '↓' : ''}</span></button>}</th>)}</tr>
          {paged !== null && <tr className={css.filterRow}><th><button className={css.iconButton} title={t('result.applyFilters')} onClick={applyFilters}><VscFilter /></button></th>{result.columns.map(column => <th key={column}><input value={filterValues[column] ?? ''} placeholder={t('result.filter')} onChange={event => { setFilterValues(values => ({ ...values, [column]: event.target.value })) }} onKeyDown={event => { if (event.key === 'Enter') applyFilters() }} /></th>)}</tr>}
        </thead>
        <tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>
          <td className={css.rowNumber}>{rowOffset + rowIndex + 1}</td>
          {row.map((cell, columnIndex) => <td key={columnIndex} data-null={cell === null}>{cell === null ? 'NULL' : typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <div className={css.resultStatus}>
      <span>{t('result.status', { rows: result.rowCount, duration: result.durationMs })}</span>
      {paged !== null && <div className={css.pagination}>
        <span>{t('result.total', { rows: paged.totalRows })}</span>
        <button className={css.iconButton} title={t('result.previous')} disabled={!paged.hasPrevious} onClick={() => { change({ object: paged.object, page: paged.page - 1, pageSize: paged.pageSize, sort: paged.sort, filters: paged.filters }) }}><VscChevronLeft /></button>
        <span>{t('result.page', { page: paged.page, pages: paged.totalPages })}</span>
        <button className={css.iconButton} title={t('result.next')} disabled={!paged.hasNext} onClick={() => { change({ object: paged.object, page: paged.page + 1, pageSize: paged.pageSize, sort: paged.sort, filters: paged.filters }) }}><VscChevronRight /></button>
        <select value={paged.pageSize} onChange={event => { change({ object: paged.object, page: 1, pageSize: Number(event.target.value), sort: paged.sort, filters: paged.filters }) }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option></select>
      </div>}
    </div>
  </div>
}
