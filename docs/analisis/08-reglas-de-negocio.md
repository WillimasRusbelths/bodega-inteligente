# Catálogo de reglas de negocio

## Uso del catálogo

Las reglas `RN` consolidan decisiones ya aprobadas en el análisis y obligaciones de la constitución
1.0.0. Una regla marcada como dependiente no completa la pregunta abierta citada. Este catálogo no
especifica almacenamiento ni autoriza implementación.

## Tenant, identidad y autorización

- **RN-001 — Tenant obligatorio:** toda entidad y operación perteneciente a una bodega debe conservar
  una asociación inequívoca con ese tenant.
- **RN-002 — Autorización autoritativa:** el backend obtiene o valida la bodega autorizada; no confía
  únicamente en un identificador enviado por el cliente.
- **RN-003 — Roles por pertenencia:** los permisos dependen de la relación persona-bodega y una
  persona puede tener roles diferentes en distintas bodegas.
- **RN-004 — Aislamiento:** ninguna persona puede consultar, modificar o eliminar información de una
  bodega sin pertenencia y permiso aplicables.
- **RN-005 — Configuración por bodega:** parámetros comerciales y operativos se asocian al tenant y
  no son constantes globales.
- **RN-006 — Piloto multi-tenant:** validar inicialmente en una bodega no permite una solución
  estructuralmente mono-tenant.

## Productos, presentaciones y lotes

- **RN-007 — Variante diferenciable:** cada marca y presentación comercial debe tratarse como
  producto o variante distinguible.
- **RN-008 — Dimensiones separadas:** unidad de compra, unidad base de inventario, modalidad de venta,
  forma de control y presentación comercial son conceptos diferentes.
- **RN-009 — Código interno:** un producto sin código de barras debe tener un código interno generado
  y poder localizarse por nombre.
- **RN-010 — Lote para vencimiento:** toda fecha de vencimiento pertenece a un lote, no al producto
  de forma global.
- **RN-011 — Cantidad aprovechable:** las recepciones contadas o pesadas registran las unidades o el
  peso aprovechable real.
- **RN-012 — Prohibición de cantidades ficticias:** si una cantidad no fue contada o medida, el
  sistema no inventa peso, volumen, cucharadas ni porciones.
- **RN-013 — Compra y venta distintas:** comprar por caja, costal, jaba, bolsa, atado o lote no obliga
  a vender con esa misma unidad.
- **RN-014 — FEFO:** las salidas usan primero el lote con vencimiento más próximo cuando corresponda;
  cualquier excepción debe aprobarse y auditarse. Depende de PA-026 para el detalle.

## Modalidades de venta

- **RN-015 — Venta por unidad:** descuenta unidades realmente vendidas y admite productos comprados
  en presentaciones mayores.
- **RN-016 — Venta por peso:** registra un peso realmente medido e ingresado manualmente, con
  cantidades decimales.
- **RN-017 — Sin balanza integrada:** el MVP no obtiene automáticamente el peso desde una balanza.
- **RN-018 — Venta por importe:** registra producto e importe monetario sin exigir una cantidad
  física cuando la porción fue determinada visualmente.
- **RN-019 — Importe no es descuento:** una venta por importe no se clasifica como descuento.
- **RN-020 — Importe rápido o libre:** la venta por importe admite opciones rápidas o un importe
  personalizado. Los valores rápidos dependen de PA-044.
- **RN-021 — Ticket fiel:** el ticket de una venta por importe muestra producto e importe y no una
  cantidad física ficticia. Su contenido final depende de PA-052.
- **RN-022 — Doble modalidad:** un producto puede venderse por peso y unidad; la equivalencia por lote
  es estimada, corregible y nunca se presenta como medición exacta. Depende de PA-049.

## Inventario aproximado, ajustes y cierres

- **RN-023 — Estado aproximado:** recipientes, bolsas y atados no medidos se controlan mediante un
  estado cualitativo, no mediante existencias físicas inventadas. Los estados dependen de PA-045.
- **RN-024 — Ingreso exacto:** cada importe vendido y el ingreso acumulado de un lote son valores
  exactos aunque su disponibilidad sea aproximada.
- **RN-025 — Margen estimado:** el margen de un lote no medido permanece identificado como estimado
  mientras el lote está abierto.
- **RN-026 — Margen definitivo:** al agotar, descartar o cerrar un lote no medido, el margen bruto se
  determina con sus ingresos acumulados, costo atribuible y costos adicionales registrados.
- **RN-027 — Cierre controlado:** cerrar o descartar un lote requiere reglas y permisos aprobados en
  PA-046.
- **RN-028 — Ajuste trazable:** toda corrección, merma, pérdida o deterioro conserva lote, usuario,
  motivo y auditoría aplicables. PA-027 y PA-051 mantienen los detalles pendientes.
- **RN-029 — Conservación:** ventas, lotes, movimientos y auditorías no se eliminan físicamente por
  una operación ordinaria.

## Transformaciones básicas

- **RN-030 — Origen identificable:** una transformación referencia producto y lote de origen.
- **RN-031 — Consumo real:** la cantidad consumida debe ser contada o medida; no se deduce de una
  expectativa de rendimiento.
- **RN-032 — Costo atribuido:** el costo consumido se traslada al producto preparado resultante.
- **RN-033 — Responsabilidad:** la transformación registra fecha y usuario responsable.
- **RN-034 — Lote resultante:** el producto preparado genera un lote vinculado con su origen.
- **RN-035 — Costos adicionales:** solo se agregan costos adicionales reales y autorizados; su
  tratamiento final depende de PA-048.
- **RN-036 — Límite funcional:** la transformación básica no constituye producción industrial.

## Ventas, transacciones y auditoría

- **RN-037 — Atomicidad de venta:** venta, detalles y movimientos indispensables se confirman o se
  revierten como una unidad.
- **RN-038 — Fallo de inventario:** si no puede descontarse el inventario requerido, la venta no se
  completa parcialmente.
- **RN-039 — Auditoría obligatoria:** ventas, movimientos, cambios de precio, anulaciones, descuentos
  y cambios relevantes producen auditoría inmutable.
- **RN-040 — Contenido de auditoría:** la auditoría incluye usuario, fecha y hora, operación y valores
  anterior y nuevo cuando corresponda; dispositivo o sesión cuando sea técnicamente posible.
- **RN-041 — Anulación histórica:** una anulación conserva la venta original y registra sus efectos
  compensatorios o reversión autorizada. Los detalles dependen de PA-014.

## Clientes y privacidad

- **RN-042 — Cliente identificado:** código interno y fecha de registro son generados por el sistema;
  nombre completo y teléfono son obligatorios.
- **RN-043 — Datos no recopilados:** durante el MVP no se recopilan DNI, dirección domiciliaria,
  fecha de nacimiento ni correo electrónico.
- **RN-044 — Consentimiento separado:** promociones y comunicaciones requieren un registro explícito,
  independiente y auditable. La redacción legal permanece en PA-007.
- **RN-045 — Cliente general:** una venta puede registrarse sin identificación individual mediante
  «Cliente general».
- **RN-046 — Exclusión analítica:** ventas de «Cliente general» no participan en rankings,
  fidelización ni análisis individual.
- **RN-047 — Minimización y tenant:** los datos personales se limitan por finalidad y permanecen
  aislados dentro de la bodega que mantiene la relación.

## Inteligencia y evolución

- **RN-048 — OCR confirmado:** una fecha leída mediante OCR debe mostrarse y ser confirmada o
  corregida antes de persistirse.
- **RN-049 — Recomendaciones explicables:** promociones, precios y reposición del MVP usan reglas
  determinísticas y explicables.
- **RN-050 — Sin modelo propio:** el MVP no incluye un modelo predictivo propio entrenado con ventas.
- **RN-051 — Datos futuros autorizados:** cualquier entrenamiento posterior requiere privacidad,
  autorización y aislamiento multi-tenant, además de resolver PA-033.
- **RN-052 — Consumidores fuera del MVP:** descubrimiento de bodegas, catálogo público, cuenta global
  de consumidor, recetas, pedidos y personalización permanecen fuera del MVP conforme a PA-034 a
  PA-042.

## Business Intelligence

- **RN-053 — Separación OLTP/OLAP:** staging, Data Warehouse, DataMarts y Power BI operan separados del
  sistema transaccional; ninguna carga o consulta analítica modifica directamente PostgreSQL operacional.
- **RN-054 — Tenant analítico obligatorio:** todo registro analítico conserva la bodega correspondiente
  y ninguna consulta, dimensión, hecho, cuarentena o ejecución puede mezclar datos visibles de tenants.
- **RN-055 — Dimensiones conformadas:** DataMarts de Ventas e Inventario comparten definiciones
  compatibles de Tiempo, Bodega, Producto y Lote, además de las dimensiones aprobadas como conformadas.
- **RN-056 — Linaje de fuente:** todo hecho cargado debe poder rastrearse hasta tenant, entidad o evento
  operacional, ejecución ETL y reglas de transformación aplicadas.
- **RN-057 — Calidad antes de publicación:** un registro inválido se rechaza o pone en cuarentena con
  motivo trazable; no se corrige silenciosamente ni se publica como válido.
- **RN-058 — Power BI de solo lectura:** Power BI consume el entorno analítico autorizado y no crea,
  modifica, anula ni corrige ventas, inventario u otros datos operacionales.
- **RN-059 — Definición única de métricas:** cada indicador tiene una definición, fórmula, grano,
  fuente, versión, frecuencia y criterio de interpretación únicos para el alcance publicado.
- **RN-060 — Estado del margen:** todo margen de lote vendido por importe se identifica como estimado
  mientras el lote está abierto y como definitivo solo después de su cierre autorizado.
