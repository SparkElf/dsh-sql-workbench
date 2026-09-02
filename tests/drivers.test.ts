import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { loadCatalog, loadObjectDetails, previewObjectPage } from '../src/drivers.ts'
import type { SqliteConnection } from '../src/types.ts'

test('SQLite adapter returns product metadata, indexes, and paged filtered rows', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-sql-driver-'))
  const file = join(directory, 'catalog.sqlite')
  const database = new DatabaseSync(file)
  database.exec('CREATE TABLE orders (id INTEGER PRIMARY KEY, customer TEXT NOT NULL); CREATE INDEX orders_customer_idx ON orders(customer); CREATE VIEW order_names AS SELECT customer FROM orders;')
  const insert = database.prepare('INSERT INTO orders (id, customer) VALUES (?, ?)')
  for (let id = 1; id <= 35; id++) insert.run(id, id % 5 === 0 ? 'Acme ' + id : 'Other ' + id)
  database.close()

  const connection: SqliteConnection = { id: 'sqlite-test', name: 'SQLite', kind: 'sqlite', file }
  const catalog = await loadCatalog(connection)
  assert.equal(catalog.capabilities?.kind, 'sqlite')
  assert.equal(catalog.databases[0]?.product, 'SQLite')
  assert.match(catalog.databases[0]?.version ?? '', /^3[.]/)
  const objects = catalog.databases.flatMap(item => item.schemas).flatMap(schema => schema.objects)
  const table = objects.find(object => object.name === 'orders')
  assert.ok(table !== undefined)
  assert.equal(objects.some(object => object.name === 'order_names' && object.kind === 'view'), true)

  const details = await loadObjectDetails(connection, table)
  assert.equal(details.indexes.some(index => index.name === 'orders_customer_idx' && index.columns[0] === 'customer'), true)

  const preview = await previewObjectPage(connection, { object: table, page: 2, pageSize: 10, sort: { column: 'id', direction: 'desc' }, filters: [{ column: 'customer', operator: 'contains', value: 'Other' }] })
  assert.equal(preview.totalRows, 28)
  assert.equal(preview.page, 2)
  assert.equal(preview.rows.length, 10)
  assert.equal(preview.rows[0]?.[0], 22)
})
