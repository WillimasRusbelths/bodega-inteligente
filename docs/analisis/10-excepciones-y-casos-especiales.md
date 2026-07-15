# Excepciones y casos especiales

## Alcance y estados conceptuales

Este documento consolida comportamientos excepcionales del MVP. No define enumeraciones técnicas,
tablas ni decisiones pendientes. En todos los casos protegidos, el backend valida tenant,
pertenencia activa y permiso; una excepción nunca habilita acceso cruzado ni pérdida de historia.

Un lote contado o medido puede estar conceptualmente **abierto**, **agotado**, **descartado** o
**cerrado**. Un lote no medido usa estados cualitativos cuya definición final depende de PA-045; las
referencias actuales —completo, más de la mitad, mitad, poco y agotado— no equivalen a porcentajes,
pesos, volúmenes o porciones.

El margen es **exacto** para cantidades contadas o pesadas, **estimado** mientras un lote no medido
permanece abierto y **definitivo** al agotarlo, descartarlo o cerrarlo. Una venta puede estar
conceptualmente **confirmada**, **anulada** o **fallida**. Una transformación se confirma
íntegramente, falla sin efectos parciales o se corrige mediante movimientos trazables.

## CE-001 — Producto sin código de barras

- **ID:** CE-001.
- **Situación:** Un producto fresco, preparado o local no posee código comercial.
- **Riesgo:** No encontrarlo en venta o crear duplicados.
- **Comportamiento esperado:** Generar código interno y permitir búsqueda por nombre, frecuentes y
  botones rápidos; la impresión de etiquetas sigue fuera del MVP.
- **Actor autorizado:** Responsable de inventario o propietario administrador según permisos.
- **Auditoría requerida:** Alta y cambios de identidad del producto.
- **Pregunta abierta relacionada:** PA-025.

## CE-002 — Código duplicado

- **ID:** CE-002.
- **Situación:** El código ingresado ya está asociado a un producto o presentación.
- **Riesgo:** Vender o descontar inventario del producto equivocado.
- **Comportamiento esperado:** Detener la asociación automática, mostrar la coincidencia dentro del
  tenant y exigir resolución autorizada sin mezclar variantes.
- **Actor autorizado:** Responsable de inventario o propietario administrador según PA-025.
- **Auditoría requerida:** Intento y resolución cuando modifique asociaciones.
- **Pregunta abierta relacionada:** PA-025.

## CE-003 — Producto sin vencimiento

- **ID:** CE-003.
- **Situación:** El producto no posee una fecha de vencimiento aplicable.
- **Riesgo:** Inventar una fecha o aplicar FEFO incorrectamente.
- **Comportamiento esperado:** No exigir una fecha ficticia; clasificar y controlar el caso según la
  regla que se apruebe, conservando lotes y trazabilidad.
- **Actor autorizado:** Responsable de inventario.
- **Auditoría requerida:** Clasificación o cambio relevante del lote.
- **Pregunta abierta relacionada:** PA-011.

## CE-004 — Lote vencido

- **ID:** CE-004.
- **Situación:** Un lote alcanzó o superó su fecha de vencimiento confirmada.
- **Riesgo:** Venta indebida y afectación al cliente.
- **Comportamiento esperado:** Marcarlo como no elegible para selección automática y exigir el
  tratamiento aprobado de descarte, ajuste o excepción; no consumirlo silenciosamente.
- **Actor autorizado:** Responsable de inventario; excepción solo por rol aprobado.
- **Auditoría requerida:** Bloqueo, descarte, ajuste o excepción.
- **Pregunta abierta relacionada:** PA-026 y PA-027.

## CE-005 — Lote sin cantidad exacta

- **ID:** CE-005.
- **Situación:** Una bolsa, recipiente o atado no tiene peso o volumen medido.
- **Riesgo:** Mostrar una existencia o margen falsamente exactos.
- **Comportamiento esperado:** Registrar costo y estado cualitativo; vender por importe sin inventar
  gramos, mililitros, cucharadas o porciones; mostrar margen estimado hasta el cierre.
- **Actor autorizado:** Responsable de inventario para el lote; vendedor para la venta.
- **Auditoría requerida:** Apertura, cambios de estado, ventas y cierre.
- **Pregunta abierta relacionada:** PA-045, PA-046 y PA-051.

## CE-006 — Caja con cantidad diferente a la esperada

- **ID:** CE-006.
- **Situación:** Las unidades aprovechables recibidas no coinciden con la cantidad esperada.
- **Riesgo:** Sobrestimar inventario y costo unitario.
- **Comportamiento esperado:** Registrar las unidades realmente recibidas y conservar la presentación
  de compra; no completar automáticamente la diferencia.
- **Actor autorizado:** Responsable de inventario.
- **Auditoría requerida:** Cantidad real, costo y diferencia registrada cuando corresponda.
- **Pregunta abierta relacionada:** PA-016 y PA-027.

## CE-007 — Producto vendido por peso y por unidad

- **ID:** CE-007.
- **Situación:** Un mismo lote admite ambas modalidades.
- **Riesgo:** Tratar una equivalencia estimada como medición exacta y desajustar inventario.
- **Comportamiento esperado:** Registrar peso y cantidad reales disponibles cuando se conozcan,
  identificar la equivalencia como estimada y corregir desviaciones mediante ajustes auditados.
- **Actor autorizado:** Vendedor para la venta; responsable de inventario para el ajuste.
- **Auditoría requerida:** Modalidad vendida, cantidad real, equivalencia usada y ajustes.
- **Pregunta abierta relacionada:** PA-049 y PA-051.

## CE-008 — Peso ingresado incorrectamente

- **ID:** CE-008.
- **Situación:** El vendedor detecta un error en el peso digitado manualmente.
- **Riesgo:** Cobro e inventario incorrectos.
- **Comportamiento esperado:** Antes de confirmar, permitir corrección. Después de confirmar, no
  editar silenciosamente: usar el procedimiento autorizado de anulación o corrección que se apruebe.
- **Actor autorizado:** Vendedor antes de confirmar; rol definido por PA-014 después de confirmar.
- **Auditoría requerida:** Venta confirmada y cualquier corrección o anulación posterior.
- **Pregunta abierta relacionada:** PA-014 y PA-050.

## CE-009 — Venta por importe personalizado

- **ID:** CE-009.
- **Situación:** El cliente solicita un importe distinto de los botones rápidos.
- **Riesgo:** Clasificarlo como descuento o inventar una porción física.
- **Comportamiento esperado:** Permitir un importe válido personalizado, registrar producto e importe,
  no exigir cantidad física y no clasificar la operación como descuento.
- **Actor autorizado:** Propietario vendedor o empleado vendedor según permisos.
- **Auditoría requerida:** Importe, producto, lote, vendedor y fecha.
- **Pregunta abierta relacionada:** PA-044 y PA-052.

## CE-010 — Atado o recipiente agotado

- **ID:** CE-010.
- **Situación:** Ya no queda producto vendible en un lote controlado aproximadamente.
- **Riesgo:** Continuar vendiendo o mantener indefinidamente un margen estimado.
- **Comportamiento esperado:** Marcar agotado, impedir nuevas ventas, consolidar ingresos y calcular
  margen definitivo conforme a la regla de cierre aprobada.
- **Actor autorizado:** Responsable de inventario; autorización adicional según PA-046.
- **Auditoría requerida:** Estado anterior y nuevo, responsable, ingresos y cierre.
- **Pregunta abierta relacionada:** PA-045, PA-046 y PA-051.

## CE-011 — Transformación incompleta

- **ID:** CE-011.
- **Situación:** Falla el descuento del origen o la creación del lote preparado.
- **Riesgo:** Perder inventario o crear un resultado sin costo y origen trazables.
- **Comportamiento esperado:** No confirmar parcialmente; revertir consumo y resultado como una sola
  operación y comunicar el fallo.
- **Actor autorizado:** Responsable de inventario.
- **Auditoría requerida:** Intento fallido y causa según política, sin ocultar efectos parciales.
- **Pregunta abierta relacionada:** PA-047 y PA-048.

## CE-012 — Merma detectada después de una venta

- **ID:** CE-012.
- **Situación:** Se descubre una pérdida física que ya afectaba la existencia disponible.
- **Riesgo:** Reescribir ventas históricas o mantener stock incorrecto.
- **Comportamiento esperado:** Conservar la venta y registrar una merma o ajuste posterior vinculado
  al lote, con motivo y autorización aplicables.
- **Actor autorizado:** Responsable de inventario; propietario administrador cuando deba autorizar.
- **Auditoría requerida:** Movimiento, lote, motivo, usuario y valores anterior y nuevo.
- **Pregunta abierta relacionada:** PA-027 y PA-051.

## CE-013 — Venta sin cliente identificado

- **ID:** CE-013.
- **Situación:** El comprador no se identifica individualmente.
- **Riesgo:** Inventar identidad o incorporar la venta en análisis individual.
- **Comportamiento esperado:** Asociar «Cliente general» y excluir la venta de rankings,
  fidelización y análisis individual.
- **Actor autorizado:** Propietario vendedor o empleado vendedor.
- **Auditoría requerida:** Auditoría normal de venta, sin datos personales ficticios.
- **Pregunta abierta relacionada:** PA-015.

## CE-014 — Stock insuficiente

- **ID:** CE-014.
- **Situación:** La cantidad solicitada supera la existencia elegible.
- **Riesgo:** Inventario negativo o venta incompleta.
- **Comportamiento esperado:** Rechazar la confirmación, informar de forma comprensible y permitir
  corregir la cantidad; no registrar efectos parciales.
- **Actor autorizado:** Vendedor corrige; no existe autorización para forzar stock inexistente.
- **Auditoría requerida:** Venta no creada; intento según política de eventos operativos.
- **Pregunta abierta relacionada:** PA-028.

## CE-015 — Dos ventas simultáneas

- **ID:** CE-015.
- **Situación:** Dos usuarios intentan consumir la misma existencia al mismo tiempo.
- **Riesgo:** Sobreventa y movimientos incompatibles.
- **Comportamiento esperado:** Aplicar control transaccional y de concurrencia; solo se confirman
  operaciones con stock elegible y la perdedora se rechaza o reintenta según especificación.
- **Actor autorizado:** Vendedores con pertenencia activa.
- **Auditoría requerida:** Ventas confirmadas y conflicto técnico según política.
- **Pregunta abierta relacionada:** PA-028; la estrategia técnica debe definirse en la especificación.

## CE-016 — Fallo durante el descuento de inventario

- **ID:** CE-016.
- **Situación:** La venta fue iniciada, pero falla un movimiento indispensable.
- **Riesgo:** Cobro o venta registrada sin inventario consistente.
- **Comportamiento esperado:** Revertir la venta completa y sus efectos indispensables; mostrar error
  recuperable y no aparentar éxito.
- **Actor autorizado:** No requiere autorización para revertir el fallo; el vendedor puede reintentar.
- **Auditoría requerida:** Fallo tratado explícitamente y diagnóstico según política.
- **Pregunta abierta relacionada:** PA-028 y PA-032.

## CE-017 — Intento de acceso a otra bodega

- **ID:** CE-017.
- **Situación:** Una solicitud apunta a un tenant no autorizado.
- **Riesgo:** Exposición o modificación cruzada de información.
- **Comportamiento esperado:** Rechazar sin revelar datos del tenant objetivo; el backend no confía
  en el identificador enviado por el cliente.
- **Actor autorizado:** Ninguno puede acceder sin pertenencia y permiso aplicables.
- **Auditoría requerida:** Intento de acceso cruzado con contexto de seguridad autorizado.
- **Pregunta abierta relacionada:** PA-021, PA-028 y PA-032.

## CE-018 — Usuario sin pertenencia activa

- **ID:** CE-018.
- **Situación:** Un usuario autenticado intenta operar sin relación activa con la bodega.
- **Riesgo:** Acceso basado solo en identidad global.
- **Comportamiento esperado:** Denegar la operación y solicitar selección o regularización de una
  pertenencia válida; no conceder permisos heredados de otro tenant.
- **Actor autorizado:** Propietario administrador gestiona pertenencias según reglas aprobadas.
- **Auditoría requerida:** Intento denegado y cualquier cambio posterior de pertenencia.
- **Pregunta abierta relacionada:** PA-003, PA-004 y PA-005.

## CE-019 — Anulación fuera del plazo autorizado

- **ID:** CE-019.
- **Situación:** Se solicita anular una venta fuera del límite aplicable.
- **Riesgo:** Fraude, alteración histórica o restitución indebida de inventario.
- **Comportamiento esperado:** Rechazar sin modificar venta ni stock, salvo procedimiento excepcional
  que PA-014 apruebe expresamente.
- **Actor autorizado:** Rol y excepción pendientes de PA-014.
- **Auditoría requerida:** Solicitud, motivo, responsable y rechazo o excepción.
- **Pregunta abierta relacionada:** PA-014.

## CE-020 — Error del OCR

- **ID:** CE-020.
- **Situación:** La fecha propuesta es ilegible, ambigua o incorrecta.
- **Riesgo:** Guardar un vencimiento falso y alterar FEFO.
- **Comportamiento esperado:** Mostrar la propuesta y exigir corrección o confirmación humana; sin
  ella no persiste como dato autoritativo. Debe permitirse ingreso manual.
- **Actor autorizado:** Responsable de inventario.
- **Auditoría requerida:** Valor confirmado y responsable; detalle adicional según PA-012.
- **Pregunta abierta relacionada:** PA-012.

## CE-021 — Producto próximo a vencer

- **ID:** CE-021.
- **Situación:** Un lote entra en el intervalo de alerta configurado.
- **Riesgo:** Pérdida por vencimiento o recomendación no explicable.
- **Comportamiento esperado:** Mostrar alerta dentro del tenant y priorizar FEFO; cualquier
  recomendación de promoción usa reglas determinísticas y explicables.
- **Actor autorizado:** Responsable de inventario y roles con consulta autorizada.
- **Auditoría requerida:** Cambios derivados de precio, promoción, ajuste o descarte; la consulta
  simple depende de la política.
- **Pregunta abierta relacionada:** PA-010, PA-017 y PA-018.

## CE-022 — Pérdida de conexión durante una operación

- **ID:** CE-022.
- **Situación:** La conectividad se interrumpe antes de conocer el resultado de una operación.
- **Riesgo:** Duplicar ventas o dejar al usuario sin certeza sobre el estado.
- **Comportamiento esperado:** No afirmar éxito sin confirmación del backend; al recuperar conexión,
  consultar el resultado y aplicar idempotencia, reintento o compensación definidos por la
  especificación. El modo offline completo permanece fuera del MVP.
- **Actor autorizado:** Usuario que inició la operación dentro de su permiso.
- **Auditoría requerida:** Operación confirmada una sola vez y fallos técnicos según política.
- **Pregunta abierta relacionada:** PA-023 y PA-032.

## Límites conservados

La balanza automática, la aplicación para consumidores, producción industrial, medición automática
de porciones y modelos predictivos propios permanecen fuera del MVP. El BI académico se limita al
alcance aprobado en los documentos `11` a `17`; ningún caso especial autoriza capacidades excluidas.

## Excepciones del componente analítico

## CE-023 — Fallo de ETL

- **ID:** CE-023.
- **Situación:** La extracción, transformación o carga termina con error.
- **Riesgo:** Publicar información incompleta o avanzar indebidamente el punto de corte.
- **Comportamiento esperado:** Marcar ejecución fallida, conservar diagnóstico, no publicar el corte
  incompleto y habilitar reprocesamiento controlado.
- **Actor autorizado:** Administrador técnico analítico; analista BI revisa calidad autorizada.
- **Auditoría requerida:** Inicio, fin, punto de corte, etapa, error, conteos y responsable o servicio.
- **Pregunta abierta relacionada:** Herramienta ETL, política de reintento y SLA pendientes.

## CE-024 — Registro analítico duplicado

- **ID:** CE-024.
- **Situación:** Una ejecución encuentra un evento fuente ya cargado.
- **Riesgo:** Doble conteo de ventas, movimientos o importes.
- **Comportamiento esperado:** Aplicar idempotencia; no crear un segundo hecho y registrar conflicto si
  el contenido difiere.
- **Actor autorizado:** Proceso ETL; revisión por administrador técnico analítico o analista BI.
- **Auditoría requerida:** Clave de origen, tenant, ejecución y tratamiento.
- **Pregunta abierta relacionada:** Mecanismo incremental y clave idempotente definitivos.

## CE-025 — Dimensión desconocida

- **ID:** CE-025.
- **Situación:** Un hecho no puede resolver una dimensión requerida.
- **Riesgo:** Perder trazabilidad o atribuir el hecho a un miembro incorrecto.
- **Comportamiento esperado:** Usar miembro «Desconocido» solo si la regla aprobada lo permite; de lo
  contrario, poner el hecho en cuarentena sin resolverlo contra otro tenant.
- **Actor autorizado:** Proceso ETL; analista BI valida la regla.
- **Auditoría requerida:** Dimensión, clave fuente, tenant, regla y resolución.
- **Pregunta abierta relacionada:** Política de miembros desconocidos y SCD pendiente.

## CE-026 — Datos de tenant incorrecto

- **ID:** CE-026.
- **Situación:** Venta, producto, lote o dimensión no comparten el mismo tenant.
- **Riesgo:** Brecha crítica y contaminación cruzada del Data Warehouse.
- **Comportamiento esperado:** Rechazar el registro, detener publicación cuando corresponda y generar
  incidente de seguridad/calidad; nunca corregirlo asignándolo a otra bodega.
- **Actor autorizado:** Ningún consumidor puede forzar la carga; equipo autorizado investiga.
- **Auditoría requerida:** Fuente, relaciones, tenants implicados, ejecución y tratamiento.
- **Pregunta abierta relacionada:** Umbral de detención y procedimiento de incidentes.

## CE-027 — Dashboard desactualizado

- **ID:** CE-027.
- **Situación:** La fecha de corte supera la frescura aprobada o la última carga falló.
- **Riesgo:** Tomar decisiones creyendo que los datos son actuales.
- **Comportamiento esperado:** Mostrar fecha de actualización y alerta visible; no ocultar el retraso ni
  afirmar tiempo real.
- **Actor autorizado:** Administrador técnico analítico gestiona servicio; usuarios solo consultan.
- **Auditoría requerida:** Fallos de actualización, recuperación y notificación.
- **Pregunta abierta relacionada:** Frecuencia, latencia y SLA de frescura.

## CE-028 — Métrica sin datos suficientes

- **ID:** CE-028.
- **Situación:** No existe denominador, cobertura o historia suficiente para calcular una métrica.
- **Riesgo:** Mostrar cero, porcentaje o tendencia engañosos.
- **Comportamiento esperado:** Mostrar «sin datos suficientes» y explicar la limitación; no imputar ni
  convertir ausencia en cero salvo definición aprobada.
- **Actor autorizado:** Analista BI define presentación; propietario valida interpretación.
- **Auditoría requerida:** Versión de métrica, corte y causa de no disponibilidad.
- **Pregunta abierta relacionada:** Fórmulas finales, cobertura mínima y umbrales.

## CE-029 — Diferencia entre OLTP y DataMart

- **ID:** CE-029.
- **Situación:** Conteos o importes del corte no concilian con PostgreSQL operacional.
- **Riesgo:** Indicadores incorrectos o pérdida de confianza.
- **Comportamiento esperado:** Bloquear o marcar publicación según severidad, registrar conciliación y
  rastrear fuente, transformación y carga; no editar OLTP desde BI.
- **Actor autorizado:** Analista BI y administrador técnico analítico; corrección operacional solo por
  actor de negocio autorizado.
- **Auditoría requerida:** Valores comparados, tolerancia, diferencia, tenant y resolución.
- **Pregunta abierta relacionada:** Tolerancias y severidades de conciliación.

## CE-030 — Carga parcial

- **ID:** CE-030.
- **Situación:** Solo una parte de dimensiones o hechos fue cargada.
- **Riesgo:** DataMarts internamente inconsistentes.
- **Comportamiento esperado:** No publicar como corte completo; revertir, aislar o completar mediante el
  mecanismo transaccional analítico aprobado, conservando el punto de corte anterior.
- **Actor autorizado:** Administrador técnico analítico.
- **Auditoría requerida:** Objetos afectados, conteos, punto de corte y recuperación.
- **Pregunta abierta relacionada:** Unidad de publicación, reversión y recuperación técnica.

## CE-031 — Reprocesamiento

- **ID:** CE-031.
- **Situación:** Debe repetirse una ejecución, intervalo o conjunto en cuarentena.
- **Riesgo:** Duplicar hechos, perder historia o usar reglas incompatibles.
- **Comportamiento esperado:** Ejecutar idempotentemente, conservar intento anterior, registrar versión
  de reglas y conciliar antes de publicar.
- **Actor autorizado:** Administrador técnico analítico con procedimiento aprobado.
- **Auditoría requerida:** Motivo, alcance, ejecuciones relacionadas, reglas, conteos y resultado.
- **Pregunta abierta relacionada:** Política de reprocesamiento, aprobación y retención de staging.
