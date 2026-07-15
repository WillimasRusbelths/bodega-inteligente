# Visión y requerimientos de Business Intelligence

## Propósito

El componente de Business Intelligence (BI) de BodegIA convertirá el historial operacional autorizado
en información consistente para analizar ventas, rentabilidad, inventario, vencimientos y mermas. BI
complementa al sistema transaccional: no registra ventas ni corrige directamente inventario, lotes,
clientes o auditorías.

## Necesidad analítica

La operación diaria genera datos detallados, pero decidir qué reponer, qué productos rotan, dónde se
produce merma o qué lotes recuperaron su costo exige integrar periodos y procesos. Las consultas
analíticas no deben competir con las transacciones ni crear definiciones diferentes de una misma
métrica. El componente BI separa esa carga, conserva historia y ofrece indicadores trazables.

## Dato, información y conocimiento

- **Dato:** registro elemental sin interpretación aislada, por ejemplo un importe neto de S/ 0.40 en
  una venta por importe o una salida de 0.500 kg registrada manualmente.
- **Información:** datos organizados con contexto, por ejemplo ventas netas por producto y semana o
  mermas valorizadas por categoría. No se inventan cantidades físicas para ventas por importe.
- **Conocimiento:** interpretación que apoya una decisión, por ejemplo revisar la reposición de un
  producto con rotación alta y stock bajo. En el MVP académico se obtiene mediante análisis y reglas
  explicables, no mediante un modelo predictivo propio.

## Transformación digital y BI

BodegIA digitaliza primero procesos operativos trazables: ventas, inventario, lotes, transformaciones,
clientes y auditorías. BI reutiliza ese historial mediante extracción controlada, calidad, integración
y modelado dimensional. La transformación digital no consiste solo en visualizar gráficos: requiere
datos confiables, responsabilidades definidas y decisiones sustentadas sin reemplazar el juicio humano.

## Usuarios de la información

- Propietario administrador: situación general, rentabilidad, riesgos y reposición.
- Propietario vendedor: resultados autorizados de ventas y productos.
- Responsable de inventario: rotación, stock, vencimientos y mermas.
- Investigador o analista BI: calidad, definición y validación de indicadores con datos autorizados.
- Administrador técnico analítico: operación de ETL, Data Warehouse y disponibilidad, sin acceso
  comercial por defecto.

## Decisiones que debe apoyar

- Priorizar productos y lotes para revisión o reposición.
- Identificar productos con mayores ingresos, margen o rotación.
- Detectar stock bajo, agotamientos, vencimientos próximos y mermas.
- Comparar modalidades de venta sin atribuir cantidades inexistentes.
- Evaluar si un lote vendido por importe recuperó su costo y si su margen es estimado o definitivo.
- Revisar tendencias temporales dentro de una misma bodega.

## Requerimientos funcionales BI

- **RF-BI-001:** integrar inicialmente un DataMart de Ventas y uno de Inventario.
- **RF-BI-002:** extraer datos operacionales hacia staging sin escribir en OLTP.
- **RF-BI-003:** ejecutar cargas iniciales e incrementales con trazabilidad de origen.
- **RF-BI-004:** aplicar reglas de calidad y poner en cuarentena registros inválidos.
- **RF-BI-005:** mantener dimensiones conformadas y una matriz bus.
- **RF-BI-006:** conservar tenant en hechos, dimensiones y controles analíticos aplicables.
- **RF-BI-007:** analizar ventas, rentabilidad, inventario, vencimientos y mermas.
- **RF-BI-008:** distinguir margen estimado de margen definitivo.
- **RF-BI-009:** permitir análisis temporal, por producto, categoría, lote, modalidad y bodega autorizada.
- **RF-BI-010:** entregar conjuntos analíticos para dashboards posteriores en Power BI.
- **RF-BI-011:** conservar linaje desde indicador hasta dato operacional fuente.
- **RF-BI-012:** registrar ejecución, errores, rechazo y reprocesamiento de ETL.

## Requerimientos no funcionales BI

- **RNF-BI-001 — Aislamiento:** ninguna consulta o carga mezcla datos visibles de tenants distintos.
- **RNF-BI-002 — Seguridad:** acceso analítico por mínimo privilegio y pertenencia autorizada.
- **RNF-BI-003 — Integridad:** BI no modifica directamente la base operacional.
- **RNF-BI-004 — Trazabilidad:** cada carga e indicador identifica origen, regla y momento de proceso.
- **RNF-BI-005 — Calidad:** exactitud, completitud, consistencia, validez, unicidad, oportunidad y
  trazabilidad se controlan explícitamente.
- **RNF-BI-006 — Historia:** cambios relevantes se conservan conforme a la política aprobada.
- **RNF-BI-007 — Separación de ambientes:** desarrollo, pruebas y producción usan datos y credenciales
  independientes.
- **RNF-BI-008 — Rendimiento:** la carga analítica no debe degradar materialmente el OLTP; los objetivos
  cuantitativos permanecen pendientes de línea base.
- **RNF-BI-009 — Explicabilidad:** toda métrica tiene definición única, fórmula y limitaciones visibles.
- **RNF-BI-010 — Privacidad:** datos personales se minimizan y enmascaran cuando no son necesarios.

## Preguntas de negocio iniciales

1. ¿Cuánto vende la bodega por día, semana y mes?
2. ¿Qué productos generan mayores ingresos y margen?
3. ¿Qué productos tienen mayor o menor rotación?
4. ¿Qué productos están próximos a vencer?
5. ¿Cuánto se pierde por mermas?
6. ¿Qué productos deben revisarse para reposición?
7. ¿Qué modalidades de venta generan mayor rentabilidad?
8. ¿Qué lotes vendidos por importe ya recuperaron su costo?
9. ¿Qué lotes continúan abiertos con margen estimado?
10. ¿Cómo evolucionan stock, salidas y agotamientos dentro de cada tenant?

## Alcance BI del MVP académico

Incluye diseño conceptual y preparación de DataMarts de Ventas e Inventario, modelo dimensional
preliminar, matriz bus, dimensiones conformadas, ETL incremental, calidad, gobierno, trazabilidad e
indicadores iniciales. Power BI es la herramienta seleccionada para implementar posteriormente el
dashboard; este bloque no genera un archivo PBIX.

## Exclusiones

- DataMart completo de Clientes.
- DataMart completo de Compras y Proveedores.
- Machine learning predictivo y predicción de demanda.
- Comparación pública entre bodegas.
- Tableau implementado; solo puede estudiarse como alternativa teórica.
- Escritura o corrección del OLTP desde Power BI, DataMarts o Data Warehouse.
- Datos históricos, resultados o mejoras porcentuales no observados.

## Criterios de éxito

- Ventas e inventario pueden analizarse con definiciones documentadas y trazabilidad al origen.
- Las cargas incrementales evitan duplicados y aíslan registros inválidos.
- Una bodega nunca consulta datos de otra.
- Margen estimado y definitivo no se confunden.
- Las ventas por importe no adquieren cantidades físicas inventadas.
- DataMarts comparten dimensiones conformadas coherentes.
- Power BI consume únicamente el entorno analítico autorizado.
- Indicadores y fórmulas preliminares son validados antes de usarse para aceptación.

## Decisiones pendientes

Frecuencia exacta de actualización, latencia objetivo, herramienta ETL, mecanismo incremental,
política de dimensiones lentamente cambiantes, retención analítica, umbrales de calidad, permisos
analíticos detallados y fórmulas finales requieren validación y especificación aprobada.
