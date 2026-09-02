import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPreviewSql, driverCapabilities, qualifiedObjectName } from '../src/dialects.ts'
import type { CatalogObject } from '../src/types.ts'

const object: CatalogObject = { kind: 'table', database: 'sales', schema: 'public', name: 'orders', definition: null, columns: [
  { name: 'id', dataType: 'integer', nullable: false, defaultValue: null, ordinal: 1 },
  { name: 'customer', dataType: 'text', nullable: true, defaultValue: null, ordinal: 2 },
] }

test('declares product-aware common version capabilities', () => {
  assert.equal(driverCapabilities('doris').defaultPort, 9030)
  assert.match(driverCapabilities('oracle').versionRange, /23ai/)
  assert.equal(driverCapabilities('mariadb').protocol, 'mysql')
})

test('quotes qualified identifiers per dialect', () => {
  assert.equal(qualifiedObjectName('postgres', object), '"public"."orders"')
  assert.equal(qualifiedObjectName('mysql', object), '`sales`.`orders`')
  assert.equal(qualifiedObjectName('oracle', object), '"public"."orders"')
})

test('builds parameterized postgres preview filters and pagination', () => {
  const plan = buildPreviewSql('postgres', { object, page: 2, pageSize: 25, sort: { column: 'id', direction: 'desc' }, filters: [{ column: 'customer', operator: 'contains', value: 'Acme' }] })
  assert.equal(plan.countSql, 'SELECT COUNT(*) AS "__dsh_total" FROM "public"."orders" WHERE "customer" LIKE $1')
  assert.equal(plan.dataSql, 'SELECT * FROM "public"."orders" WHERE "customer" LIKE $1 ORDER BY "id" DESC LIMIT $2 OFFSET $3')
  assert.deepEqual(plan.dataParams, ['%Acme%', 25, 25])
})

test('builds Oracle OFFSET FETCH and rejects unknown columns', () => {
  const plan = buildPreviewSql('oracle', { object, page: 3, pageSize: 50, filters: [] })
  assert.match(plan.dataSql, /OFFSET :p1 ROWS FETCH NEXT :p2 ROWS ONLY$/)
  assert.deepEqual(plan.dataParams, [100, 50])
  assert.throws(() => buildPreviewSql('mysql', { object, page: 1, pageSize: 50, sort: { column: 'missing', direction: 'asc' } }), /Unknown preview column/)
})
