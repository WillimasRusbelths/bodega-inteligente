-- Stock por categoria
SELECT
  c.category_name,
  SUM(s.available_quantity) AS stock_disponible,
  SUM(s.inventory_valuation) AS valorizacion
FROM dw.fact_stock_snapshot s
LEFT JOIN dw.dim_product p
  ON p.product_id = s.product_id
  AND p.tenant_id = s.tenant_id
LEFT JOIN dw.dim_category c
  ON c.category_id = p.category_id
  AND c.tenant_id = p.tenant_id
GROUP BY c.category_name
ORDER BY c.category_name;

-- Productos con stock bajo
SELECT
  p.product_name,
  s.available_quantity,
  s.minimum_stock,
  s.stock_state
FROM dw.fact_stock_snapshot s
JOIN dw.dim_product p
  ON p.product_id = s.product_id
  AND p.tenant_id = s.tenant_id
WHERE s.stock_state = 'LOW_STOCK'
ORDER BY p.product_name;

-- Productos proximos a vencer
SELECT
  p.product_name,
  r.lot_id,
  d.full_date AS expiration_date,
  r.available_quantity,
  r.days_to_expire
FROM dw.fact_expiration_risk r
JOIN dw.dim_product p
  ON p.product_id = r.product_id
  AND p.tenant_id = r.tenant_id
JOIN dw.dim_date d
  ON d.date_key = r.expiration_date_key
WHERE r.expiration_state = 'EXPIRING_SOON'
ORDER BY d.full_date, p.product_name;

-- Productos vencidos
SELECT
  p.product_name,
  r.lot_id,
  d.full_date AS expiration_date,
  r.available_quantity
FROM dw.fact_expiration_risk r
JOIN dw.dim_product p
  ON p.product_id = r.product_id
  AND p.tenant_id = r.tenant_id
JOIN dw.dim_date d
  ON d.date_key = r.expiration_date_key
WHERE r.expiration_state = 'EXPIRED'
ORDER BY d.full_date, p.product_name;

-- Movimientos por tipo
SELECT
  movement_type,
  COUNT(*) AS movimientos,
  SUM(quantity) AS cantidad
FROM dw.fact_inventory_movement
GROUP BY movement_type
ORDER BY movement_type;

-- Movimientos por mes
SELECT
  d.year,
  d.month,
  d.month_name,
  m.movement_type,
  COUNT(*) AS movimientos,
  SUM(m.quantity) AS cantidad
FROM dw.fact_inventory_movement m
JOIN dw.dim_date d
  ON d.date_key = m.date_key
GROUP BY d.year, d.month, d.month_name, m.movement_type
ORDER BY d.year, d.month, m.movement_type;

-- Alertas por tipo y estado
SELECT
  alert_type,
  alert_status,
  COUNT(*) AS alertas
FROM dw.fact_inventory_alert
GROUP BY alert_type, alert_status
ORDER BY alert_type, alert_status;

-- Valorizacion de inventario
SELECT
  t.tenant_name,
  SUM(s.inventory_valuation) AS valorizacion_inventario
FROM dw.fact_stock_snapshot s
JOIN dw.dim_tenant t
  ON t.tenant_id = s.tenant_id
GROUP BY t.tenant_name
ORDER BY t.tenant_name;

-- Riesgo de perdida por vencimiento
SELECT
  p.product_name,
  r.expiration_state,
  SUM(r.available_quantity) AS unidades_en_riesgo,
  SUM(r.estimated_loss) AS perdida_estimada
FROM dw.fact_expiration_risk r
JOIN dw.dim_product p
  ON p.product_id = r.product_id
  AND p.tenant_id = r.tenant_id
WHERE r.expiration_state IN ('EXPIRING_SOON', 'EXPIRED')
GROUP BY p.product_name, r.expiration_state
ORDER BY r.expiration_state, perdida_estimada DESC;
