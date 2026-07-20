-- Inventory DataMart for BodegIA.
-- Analytical schema only: no OLTP tables are modified.

CREATE SCHEMA IF NOT EXISTS dw;

CREATE OR REPLACE VIEW dw.dim_tenant AS
SELECT
  t.id::text AS tenant_key,
  t.id AS tenant_id,
  t.name AS tenant_name
FROM "Tenant" t;

CREATE OR REPLACE VIEW dw.dim_category AS
SELECT
  c.id::text AS category_key,
  c.id AS category_id,
  c."tenantId" AS tenant_id,
  c.name AS category_name,
  c.status::text AS status
FROM "ProductCategory" c;

CREATE OR REPLACE VIEW dw.dim_unit AS
SELECT
  u.id::text AS unit_key,
  u.id AS unit_id,
  u."tenantId" AS tenant_id,
  u.code AS unit_code,
  u.name AS unit_name,
  u."quantityScale" AS quantity_scale
FROM "UnitOfMeasure" u;

CREATE OR REPLACE VIEW dw.dim_product AS
SELECT
  p.id::text AS product_key,
  p.id AS product_id,
  p."tenantId" AS tenant_id,
  p.name AS product_name,
  p.sku,
  p.barcode,
  p."categoryId" AS category_id,
  p."unitOfMeasureId" AS unit_id,
  p."minimumStock" AS minimum_stock,
  p."expiryAlertDays" AS expiry_alert_days,
  p.status::text AS status
FROM "Product" p;

CREATE OR REPLACE VIEW dw.dim_date AS
WITH source_dates AS (
  SELECT im."createdAt"::date AS full_date
  FROM "InventoryMovement" im
  UNION
  SELECT l."expiresAt"::date AS full_date
  FROM "Lot" l
  UNION
  SELECT ia."triggeredAt"::date AS full_date
  FROM "InventoryAlert" ia
  UNION
  SELECT CURRENT_DATE AS full_date
)
SELECT
  to_char(full_date, 'YYYYMMDD')::integer AS date_key,
  full_date,
  EXTRACT(YEAR FROM full_date)::integer AS year,
  EXTRACT(QUARTER FROM full_date)::integer AS quarter,
  EXTRACT(MONTH FROM full_date)::integer AS month,
  trim(to_char(full_date, 'Month')) AS month_name,
  EXTRACT(DAY FROM full_date)::integer AS day,
  EXTRACT(ISODOW FROM full_date)::integer AS day_of_week
FROM source_dates
WHERE full_date IS NOT NULL;

CREATE OR REPLACE VIEW dw.fact_inventory_movement AS
SELECT
  im.id::text AS movement_key,
  im.id AS movement_id,
  im."tenantId" AS tenant_id,
  im."productId" AS product_id,
  im."lotId" AS lot_id,
  to_char(im."createdAt"::date, 'YYYYMMDD')::integer AS date_key,
  im.type::text AS movement_type,
  im.quantity,
  im."quantityDelta" AS quantity_delta,
  im."balanceBefore" AS balance_before,
  im."balanceAfter" AS balance_after
FROM "InventoryMovement" im;

CREATE OR REPLACE VIEW dw.fact_stock_snapshot AS
SELECT
  b."tenantId" AS tenant_id,
  b."productId" AS product_id,
  b."lotId" AS lot_id,
  to_char(CURRENT_DATE, 'YYYYMMDD')::integer AS date_key,
  b."availableQuantity" AS available_quantity,
  p."minimumStock" AS minimum_stock,
  CASE
    WHEN b."availableQuantity" <= 0 THEN 'OUT_OF_STOCK'
    WHEN b."availableQuantity" < p."minimumStock" THEN 'LOW_STOCK'
    ELSE 'IN_STOCK'
  END AS stock_state,
  (b."availableQuantity" * l."unitCost") AS inventory_valuation
FROM "InventoryBalance" b
JOIN "Product" p
  ON p."tenantId" = b."tenantId"
  AND p.id = b."productId"
JOIN "Lot" l
  ON l."tenantId" = b."tenantId"
  AND l."productId" = b."productId"
  AND l.id = b."lotId";

CREATE OR REPLACE VIEW dw.fact_expiration_risk AS
SELECT
  l."tenantId" AS tenant_id,
  l."productId" AS product_id,
  l.id AS lot_id,
  to_char(l."expiresAt"::date, 'YYYYMMDD')::integer AS expiration_date_key,
  l."availableQuantity" AS available_quantity,
  (l."expiresAt"::date - CURRENT_DATE)::integer AS days_to_expire,
  CASE
    WHEN l."expiresAt"::date < CURRENT_DATE THEN 'EXPIRED'
    WHEN l."expiresAt"::date <= CURRENT_DATE + (p."expiryAlertDays" * INTERVAL '1 day') THEN 'EXPIRING_SOON'
    ELSE 'OK'
  END AS expiration_state,
  (l."availableQuantity" * l."unitCost") AS estimated_loss
FROM "Lot" l
JOIN "Product" p
  ON p."tenantId" = l."tenantId"
  AND p.id = l."productId"
WHERE l."availableQuantity" > 0;

CREATE OR REPLACE VIEW dw.fact_inventory_alert AS
SELECT
  ia.id::text AS alert_key,
  ia.id AS alert_id,
  ia."tenantId" AS tenant_id,
  ia."productId" AS product_id,
  ia."lotId" AS lot_id,
  to_char(ia."triggeredAt"::date, 'YYYYMMDD')::integer AS date_key,
  ia.type::text AS alert_type,
  ia.status::text AS alert_status,
  ia."observedValue" AS observed_value,
  ia."thresholdValue" AS threshold_value
FROM "InventoryAlert" ia;
