# Plan ETL conceptual

## Objetivo y límites

El ETL trasladará copias autorizadas desde PostgreSQL operacional hacia staging y el modelo
dimensional. No modifica el OLTP, no define una herramienta definitiva ni crea esquemas físicos.

## Fuentes de datos

- Ventas, detalles, descuentos, anulaciones y tickets internos.
- Productos, categorías, códigos, modalidades y unidades.
- Lotes, vencimientos, costos y estados de cierre.
- Movimientos, entradas, salidas, ajustes, mermas y transformaciones.
- Clientes mínimos, «Cliente general», usuarios y pertenencias autorizadas.
- Bodegas y configuración necesaria para interpretar indicadores.
- Auditorías operacionales como fuente de linaje o conciliación cuando corresponda.

## Extracción y staging

La extracción es de solo lectura y registra tenant, entidad fuente, clave operacional, instante de
extracción, punto de corte y ejecución. Staging separa datos por ambiente y ejecución, conserva el
valor recibido y no se usa como sistema operacional. El mecanismo incremental —marca temporal,
identificador creciente, CDC u otro— queda pendiente de evaluación técnica.

## Transformación

1. Normalizar formatos de fecha, moneda, cantidad y códigos sin cambiar significado.
2. Validar relaciones dentro del mismo tenant.
3. Resolver claves dimensionales y miembros especiales autorizados.
4. Aplicar historia dimensional según estrategia SCD aprobada.
5. Derivar importes, costos y márgenes con fórmulas versionadas.
6. Conservar cantidad ausente en ventas por importe no medidas.
7. Distinguir margen estimado y definitivo.
8. Generar linaje de fuente, regla y ejecución.

## Reglas de limpieza y validación

- No fusionar automáticamente códigos o clientes duplicados.
- Rechazar fechas inválidas o OCR no confirmado.
- Rechazar relaciones producto-lote-venta de tenants diferentes.
- Validar que ventas confirmadas tengan detalle.
- Validar signos según tipo de movimiento.
- Validar compatibilidad entre cantidad, unidad y modalidad.
- Conciliar bruto, descuento y neto con tolerancia pendiente de aprobación.
- No imputar cantidades físicas desconocidas.
- Usar miembros «Desconocido» solo cuando la regla permita cargar el hecho sin falsear identidad.

## Carga inicial

1. Definir punto de corte y respaldo lógico de control.
2. Extraer dimensiones base por tenant.
3. Validar y cargar dimensiones conformadas.
4. Extraer y validar hechos de Ventas e Inventario.
5. Cargar hechos respetando dependencias.
6. Conciliar conteos e importes con la fuente.
7. Publicar solo tras controles aprobados.

No se inventan históricos anteriores a la información operacional disponible.

## Carga incremental

Cada ejecución procesa cambios desde el último punto de corte confirmado hasta un nuevo corte
consistente. El punto avanza solo si la carga cumple atomicidad analítica definida y conciliación. Las
anulaciones, ajustes y cierres se propagan como cambios o eventos trazables; nunca se omiten por haber
cargado previamente la venta o lote.

## Duplicados, errores y cuarentena

- Una clave de idempotencia conceptual combina fuente, tenant, clave operacional, versión o evento.
- Un duplicado exacto no genera un segundo hecho.
- Un conflicto no se sobrescribe silenciosamente: se registra y aísla.
- La cuarentena conserva tenant, fuente, ejecución, regla vulnerada y motivo.
- Un error de tenant, grano o integridad bloquea el registro afectado y puede detener la publicación
  según severidad aprobada.

## Reprocesamiento

El reprocesamiento selecciona una ejecución, intervalo o conjunto en cuarentena; conserva el intento
original, aplica reglas versionadas y evita duplicados. No retrocede el punto de corte confirmado sin
procedimiento controlado. Las correcciones necesarias en OLTP se realizan mediante procesos
operacionales autorizados y luego se extraen nuevamente.

## Auditoría ETL y trazabilidad

Cada ejecución registra identificador, ambiente, inicio, fin, punto de corte, fuente, tenants
procesados, versión de reglas, conteos leídos/aceptados/rechazados, resultado, error y responsable o
servicio. Cada hecho conserva claves de linaje suficientes para rastrear el registro fuente.

## Frecuencia

La hipótesis inicial es una carga incremental diaria con ejecución manual controlada durante la
validación. Frecuencia, horario, latencia y SLA finales permanecen pendientes de volumen y línea base.

## Separación por tenant

El tenant se valida en extracción, staging, resolución dimensional, hechos, cuarentena, auditoría y
publicación. Una clave operacional nunca se resuelve contra una dimensión de otra bodega. Los conteos
de conciliación se calculan también por tenant.

## Matriz conceptual de transformación

| Campo o dato fuente      | Regla de transformación                     | Destino dimensional          | Control de calidad                  | Tratamiento de error                           |
| ------------------------ | ------------------------------------------- | ---------------------------- | ----------------------------------- | ---------------------------------------------- |
| Fecha/hora de venta      | Normalizar zona y derivar calendario        | DimTiempo / FactVentas       | Fecha válida y venta confirmada     | Cuarentena                                     |
| Bodega de la operación   | Resolver tenant autorizado                  | DimBodega y todos los hechos | Coincidencia en relaciones          | Rechazo crítico                                |
| Producto y presentación  | Conformar identidad histórica               | DimProducto                  | Código/clave únicos por tenant      | Revisión, sin fusión automática                |
| Categoría                | Resolver versión aplicable                  | DimCategoria                 | Categoría existente en tenant       | Miembro desconocido solo si se aprueba         |
| Cliente                  | Resolver identificado o Cliente general     | DimCliente                   | Datos mínimos y tenant coherente    | Cuarentena o miembro general según fuente real |
| Usuario vendedor         | Resolver pertenencia aplicable              | DimUsuarioVendedor           | Pertenencia coherente al momento    | Cuarentena                                     |
| Lote consumido           | Resolver lote del producto y tenant         | DimLote / FactVentas         | Producto, lote y tenant coinciden   | Rechazo crítico                                |
| Modalidad de venta       | Normalizar unidad/peso/importe              | DimModalidadVenta            | Compatible con producto             | Cuarentena                                     |
| Cantidad vendida         | Conservar medida real; ausente si no medida | FactVentas                   | No negativa y unidad compatible     | Rechazo; no imputar                            |
| Bruto, descuento y neto  | Aplicar fórmula versionada preliminar       | FactVentas                   | Conciliación monetaria              | Cuarentena o marca de calidad                  |
| Costo y margen           | Atribuir costo y clasificar estado          | FactVentas                   | Costo trazable; estimado/definitivo | No publicar margen no sustentado               |
| Tipo de movimiento       | Normalizar catálogo autorizado              | DimTipoMovimiento            | Tipo válido                         | Cuarentena                                     |
| Cantidades de movimiento | Separar entrada, salida y merma             | FactMovimientosInventario    | Signo y unidad compatibles          | Rechazo                                        |
| Stock anterior/posterior | Conservar valores operacionales medidos     | FactMovimientosInventario    | Conciliación con movimiento         | Incidencia y cuarentena                        |
| Motivo                   | Resolver motivo aprobado                    | DimMotivo                    | Obligatorio cuando aplique          | Cuarentena                                     |
| Unidad de medida         | Conformar unidad real                       | DimUnidadMedida              | Compatible con modalidad            | Rechazo                                        |

## Pruebas ETL

- Carga inicial repetible en ambiente aislado.
- Incremental sin duplicar hechos.
- Reprocesamiento idempotente.
- Conciliación de conteos e importes por tenant.
- Rechazo de relaciones cruzadas entre tenants.
- Fechas inválidas, cantidades negativas y ventas sin detalle.
- Cliente general y privacidad de clientes identificados.
- Venta por importe sin cantidad física.
- Margen estimado que pasa a definitivo al cierre.
- Doble modalidad sin convertir estimaciones en medidas exactas.
- Fallo parcial con recuperación y punto de corte estable.

## Alternativas técnicas pendientes

Se evaluarán capacidades nativas de base de datos, tareas programadas del backend, herramientas ETL
de código abierto o servicios administrados compatibles con el stack, seguridad y costo. No se
selecciona ninguna en este análisis. La decisión deberá comparar incrementalidad, observabilidad,
reprocesamiento, aislamiento, portabilidad y operación por ambientes.
