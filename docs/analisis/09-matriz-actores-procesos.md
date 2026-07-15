# Matriz de actores y procesos

## Criterios de lectura

- **Ejecuta (E):** realiza el proceso o registra su operación principal.
- **Autoriza (A):** aprueba una operación restringida; no implica ejecutarla siempre.
- **Consulta (C):** puede consultar el resultado dentro de sus permisos.
- **Participa (P):** interviene como parte externa o beneficiaria sin administrar el proceso.
- **No tiene acceso (N):** no accede al proceso por defecto.

La matriz expresa responsabilidades iniciales, no reemplaza la definición detallada de permisos de
PA-005. Una misma persona puede desempeñar varios roles, pero cada permiso se evalúa según su
pertenencia activa a la bodega seleccionada. Ningún rol permite acceder a información de otro tenant.

El administrador técnico no consulta información comercial por defecto. Cualquier soporte
excepcional que requiera datos necesita necesidad comprobada, autorización, temporalidad y auditoría
conforme a PA-021. El investigador o desarrollador trabaja por defecto con datos sintéticos,
anonimizados o expresamente autorizados y no obtiene acceso operativo por su función.

En el componente analítico se distingue al **investigador o analista BI**, que diseña y valida datos
y métricas autorizadas, del investigador o desarrollador operacional. El **propietario administrador**
es consumidor de reportes de su propia bodega. El **administrador técnico analítico** opera ETL,
Data Warehouse, DataMarts y disponibilidad, pero no obtiene acceso comercial por defecto.

## Matriz

| Proceso | Propietario administrador | Propietario vendedor | Empleado vendedor | Responsable de inventario | Administrador técnico | Cliente de la bodega | Proveedor | Investigador o desarrollador |
|---|---|---|---|---|---|---|---|---|
| PR-001 Configurar una bodega | E | C | N | C | N | N | N | N |
| PR-002 Gestionar usuarios, pertenencias y permisos | E | C | N | N | N | N | N | N |
| PR-003 Mantener catálogo y presentaciones | A | C | C | E | N | N | P | N |
| PR-004 Recibir lote contado o pesado | A | C | N | E | N | N | P | N |
| PR-005 Recibir lote sin cantidad exacta | A | C | N | E | N | N | P | N |
| PR-006 Capturar y confirmar vencimiento con OCR | C | N | N | E | N | N | N | N |
| PR-007 Registrar transformación básica | A | C | N | E | N | N | N | N |
| PR-008 Registrar ajuste, merma o deterioro | A | C | N | E | N | N | N | N |
| PR-009 Controlar lotes, vencimientos y FEFO | C | C | C | E | N | N | N | N |
| PR-010 Registrar venta por unidad | C | E | E | C | N | P | N | N |
| PR-011 Registrar venta por peso | C | E | E | C | N | P | N | N |
| PR-012 Registrar venta por importe | C | E | E | C | N | P | N | N |
| PR-013 Registrar venta con doble modalidad | C | E | E | C | N | P | N | N |
| PR-014 Registrar cliente identificado | C | E | E | N | N | P | N | N |
| PR-015 Registrar consentimiento promocional | C | E | E | N | N | P | N | N |
| PR-016 Registrar venta con Cliente general | C | E | E | C | N | P | N | N |
| PR-017 Emitir ticket interno | C | E | E | N | N | P | N | N |
| PR-018 Anular una venta | A | E | N | C | N | P | N | N |
| PR-019 Cerrar lote vendido por importe | A | C | N | E | N | N | N | N |
| PR-020 Consultar análisis y preparar reposición | E | C | N | E | N | N | P | N |

## Matriz de procesos analíticos

| Proceso | Propietario administrador como consumidor de reportes | Responsable de inventario | Investigador o analista BI | Administrador técnico analítico | Otros usuarios operativos | Cliente | Proveedor |
|---|---|---|---|---|---|---|---|
| PR-021 Extraer y cargar información analítica | C | C | Participa | Ejecuta | No tiene acceso | No tiene acceso | No tiene acceso |
| PR-022 Generar indicadores BI | Autoriza/Consulta | Participa/Consulta | Ejecuta | Participa | No tiene acceso por defecto | No tiene acceso | No tiene acceso |
| PR-023 Consultar dashboard BI | Ejecuta/Consulta | Consulta según permiso | Participa | No tiene acceso comercial por defecto | Consulta solo si su rol lo permite | No tiene acceso | No tiene acceso |

En PR-021, **Consulta** para actores de negocio significa revisar conciliación o calidad autorizada,
no operar el ETL. La autorización de una métrica expresa validación de negocio y no permite modificar
datos fuente. Los niveles combinados deberán descomponerse en permisos concretos durante la
especificación; no resuelven anticipadamente PA-005 ni PA-021.

## Salvaguardas de interpretación

- Las combinaciones anteriores son iniciales y no fijan los permisos finales pendientes en PA-005.
- **Autoriza** no permite omitir motivo, auditoría ni límites configurados por la bodega.
- **Consulta** se limita a la información funcionalmente necesaria dentro del tenant.
- **Participa** no concede cuenta, sesión ni acceso interno al cliente o proveedor.
- Un propietario puede combinar funciones administrativas y de venta, sujeto a mínimo privilegio.
- Una persona con varias pertenencias debe cambiar de contexto y volver a ser autorizada para cada
  bodega; no hereda permisos entre tenants.
- El acceso a Power BI debe aplicar controles autoritativos por tenant; un filtro visual no basta.
- El administrador técnico analítico puede consultar telemetría y conteos técnicos, no ventas,
  márgenes, clientes o productos por defecto.
