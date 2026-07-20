# Descripción de procesos

## Convenciones

Los procesos `PR-001` a `PR-020` describen el MVP sin definir pantallas, API, persistencia ni
decisiones todavía abiertas. En todo proceso protegido, el backend valida autenticación, pertenencia
activa, tenant y permisos. La información resultante permanece asociada a la bodega autorizada.

## PR-001 — Configurar una bodega

- **ID:** PR-001.
- **Nombre:** Configurar una bodega.
- **Objetivo:** Mantener parámetros operativos y comerciales propios del tenant.
- **Actores:** Propietario administrador; administrador técnico solo para soporte autorizado.
- **Precondiciones:** Bodega existente, pertenencia activa y permiso administrativo.
- **Disparador:** Necesidad de establecer o cambiar una configuración aprobada.
- **Flujo principal:** 1. Seleccionar la bodega autorizada. 2. Consultar configuración vigente. 3.
  Modificar valores permitidos. 4. Validar entradas. 5. Confirmar y auditar el cambio.
- **Flujos alternativos:** Conservar valores predeterminados explícitos y sustituibles por bodega.
- **Excepciones:** Rechazar valores inválidos, permisos insuficientes o tenant ajeno.
- **Información de entrada:** Stock mínimo, días de alerta, datos del ticket y parámetros aprobados.
- **Información resultante:** Configuración versionada lógicamente para la bodega.
- **Auditoría requerida:** Usuario, fecha, sesión y valores anterior y nuevo.
- **Reglas de negocio relacionadas:** RN-001 a RN-006, RN-039 y RN-040.
- **Preguntas abiertas relacionadas:** PA-002, PA-005, PA-009, PA-010 y PA-015.
- **Criterio de finalización:** Configuración válida guardada y auditada sin afectar otro tenant.

## PR-002 — Gestionar usuarios, pertenencias y permisos

- **ID:** PR-002.
- **Nombre:** Gestionar usuarios, pertenencias y permisos.
- **Objetivo:** Conceder acceso de mínimo privilegio según la relación persona-bodega.
- **Actores:** Propietario administrador; persona invitada o vinculada.
- **Precondiciones:** Administrador autorizado en la bodega.
- **Disparador:** Alta, invitación, cambio de rol o desactivación de una pertenencia.
- **Flujo principal:** 1. Identificar persona. 2. Seleccionar bodega. 3. Definir pertenencia y permisos
  aprobados. 4. Validar autoridad. 5. Confirmar. 6. Auditar.
- **Flujos alternativos:** Una persona puede conservar pertenencias y roles diferentes en otras bodegas.
- **Excepciones:** Rechazar escalamiento no autorizado o pertenencia inactiva.
- **Información de entrada:** Identidad, bodega, estado de pertenencia y roles autorizados.
- **Información resultante:** Relación persona-bodega vigente.
- **Auditoría requerida:** Alta, cambio o desactivación con actor y valores afectados.
- **Reglas de negocio relacionadas:** RN-001 a RN-006, RN-039 y RN-040.
- **Preguntas abiertas relacionadas:** PA-003, PA-004 y PA-005.
- **Criterio de finalización:** Permisos aplicables solo a la pertenencia indicada y cambio auditado.

## PR-003 — Mantener catálogo y presentaciones

- **ID:** PR-003.
- **Nombre:** Mantener catálogo y presentaciones.
- **Objetivo:** Identificar cada producto, marca, presentación y modalidad operativa.
- **Actores:** Responsable de inventario; propietario administrador.
- **Precondiciones:** Permiso de catálogo dentro del tenant.
- **Disparador:** Alta o actualización de un producto.
- **Flujo principal:** 1. Buscar coincidencias. 2. Registrar marca y presentación. 3. Asociar código de
  barras o generar código interno. 4. Definir unidad de compra, unidad base, modalidad de venta y
  control de stock. 5. Validar. 6. Guardar y auditar.
- **Flujos alternativos:** Localizar por nombre, frecuentes o botones rápidos si no existe código.
- **Excepciones:** Código duplicado, modalidad inconsistente o tenant incorrecto.
- **Información de entrada:** Identidad comercial, códigos, categorías y modalidades aprobadas.
- **Información resultante:** Producto o variante diferenciable dentro de la bodega.
- **Auditoría requerida:** Alta y cambios relevantes del producto.
- **Reglas de negocio relacionadas:** RN-007 a RN-009 y RN-039.
- **Preguntas abiertas relacionadas:** PA-025 y PA-043.
- **Criterio de finalización:** Producto identificable y configurado sin duplicidad no resuelta.

## PR-004 — Recibir un lote contado o pesado

- **ID:** PR-004.
- **Nombre:** Recibir un lote contado o pesado.
- **Objetivo:** Incorporar inventario exacto a partir de unidades o peso aprovechable real.
- **Actores:** Responsable de inventario; proveedor como participante externo.
- **Precondiciones:** Producto configurado y usuario autorizado.
- **Disparador:** Recepción de mercadería contada o medida.
- **Flujo principal:** 1. Seleccionar producto. 2. Registrar presentación de compra, proveedor y costo. 3. Contar unidades o ingresar peso medido. 4. Registrar lote y vencimiento aplicable. 5. Confirmar. 6. Crear entrada y auditoría.
- **Flujos alternativos:** Compra por caja, costal o jaba convertida a cantidad aprovechable real.
- **Excepciones:** Cantidad diferente a la esperada, fecha inválida o error OCR.
- **Información de entrada:** Costo total, cantidad aprovechable, proveedor, lote y vencimiento.
- **Información resultante:** Lote abierto con inventario y costo trazables.
- **Auditoría requerida:** Entrada, usuario, fecha, cantidad y costo.
- **Reglas de negocio relacionadas:** RN-010 a RN-014, RN-039, RN-040 y RN-048.
- **Preguntas abiertas relacionadas:** PA-011, PA-012, PA-016 y PA-050.
- **Criterio de finalización:** Lote e inventario registrados consistentemente con la medición real.

## PR-005 — Recibir un lote sin cantidad exacta

- **ID:** PR-005.
- **Nombre:** Recibir un lote sin cantidad exacta.
- **Objetivo:** Registrar bolsas, recipientes o atados sin inventar una medida física.
- **Actores:** Responsable de inventario; proveedor como participante externo.
- **Precondiciones:** Producto configurado para control aproximado.
- **Disparador:** Recepción de un lote cuyo peso o volumen no fue medido.
- **Flujo principal:** 1. Seleccionar producto. 2. Registrar recipiente o atado, costo y proveedor. 3.
  Registrar vencimiento si aplica. 4. Asignar estado aproximado inicial aprobado. 5. Confirmar entrada. 6. Auditar.
- **Flujos alternativos:** Producto fresco, molido o preparado adquirido como un único lote.
- **Excepciones:** Intento de registrar gramos, volumen o porciones no medidos.
- **Información de entrada:** Producto, costo, presentación, estado aproximado y vencimiento aplicable.
- **Información resultante:** Lote abierto con costo exacto y disponibilidad cualitativa.
- **Auditoría requerida:** Apertura, costo y estado inicial.
- **Reglas de negocio relacionadas:** RN-012, RN-013 y RN-023 a RN-029.
- **Preguntas abiertas relacionadas:** PA-045 y PA-046.
- **Criterio de finalización:** Lote disponible sin cantidades físicas ficticias.

## PR-006 — Capturar y confirmar un vencimiento con OCR

- **ID:** PR-006.
- **Nombre:** Capturar y confirmar un vencimiento con OCR.
- **Objetivo:** Facilitar la captura sin sustituir la decisión humana.
- **Actores:** Responsable de inventario.
- **Precondiciones:** Lote en registro y permiso de inventario.
- **Disparador:** Usuario captura una fecha con la cámara.
- **Flujo principal:** 1. Capturar imagen. 2. Ejecutar OCR preentrenado. 3. Mostrar fecha propuesta. 4.
  Confirmar o corregir. 5. Validar formato. 6. Guardar el valor confirmado y auditar.
- **Flujos alternativos:** Ingreso manual si el OCR no reconoce la fecha.
- **Excepciones:** Imagen ilegible, fecha ambigua o ausencia de confirmación.
- **Información de entrada:** Imagen y corrección humana.
- **Información resultante:** Fecha confirmada asociada al lote.
- **Auditoría requerida:** Usuario, fecha propuesta cuando corresponda y valor confirmado.
- **Reglas de negocio relacionadas:** RN-010, RN-039, RN-040 y RN-048.
- **Preguntas abiertas relacionadas:** PA-011 y PA-012.
- **Criterio de finalización:** Solo la fecha confirmada queda como dato autoritativo.

## PR-007 — Registrar una transformación básica

- **ID:** PR-007.
- **Nombre:** Registrar una transformación básica.
- **Objetivo:** Trazar el consumo de un lote y la creación de un producto preparado.
- **Actores:** Responsable de inventario.
- **Precondiciones:** Lote de origen disponible y producto resultante identificable.
- **Disparador:** Preparación o molienda realizada por la bodega.
- **Flujo principal:** 1. Seleccionar origen. 2. Registrar cantidad realmente consumida. 3. Seleccionar
  resultado. 4. Atribuir costo de origen y costos adicionales reales autorizados. 5. Registrar fecha
  y responsable. 6. Descontar origen y crear lote resultante atómicamente. 7. Auditar.
- **Flujos alternativos:** Resultado controlado por cantidad exacta o estado aproximado.
- **Excepciones:** Consumo insuficiente, costo inválido o creación incompleta.
- **Información de entrada:** Lote origen, consumo, producto resultante y costos reales.
- **Información resultante:** Lote transformado trazable.
- **Auditoría requerida:** Origen, resultado, cantidades, costos, fecha y usuario.
- **Reglas de negocio relacionadas:** RN-030 a RN-040.
- **Preguntas abiertas relacionadas:** PA-047 y PA-048.
- **Criterio de finalización:** Origen y resultado quedan consistentes o no se aplica cambio parcial.

## PR-008 — Registrar ajuste, merma o deterioro

- **ID:** PR-008.
- **Nombre:** Registrar ajuste, merma o deterioro.
- **Objetivo:** Explicar correcciones y pérdidas sin alterar silenciosamente la historia.
- **Actores:** Responsable de inventario; propietario administrador cuando deba autorizar.
- **Precondiciones:** Producto y lote existentes.
- **Disparador:** Diferencia física, merma, pérdida o deterioro detectado.
- **Flujo principal:** 1. Seleccionar lote. 2. Elegir tipo permitido. 3. Registrar cantidad real o estado
  aplicable y motivo. 4. Obtener autorización cuando corresponda. 5. Actualizar inventario. 6. Auditar.
- **Flujos alternativos:** Ajustar equivalencia estimada de un producto vendido por peso y unidad.
- **Excepciones:** Usuario sin permiso, motivo ausente o ajuste cruzado entre tenants.
- **Información de entrada:** Lote, tipo, valor anterior, valor nuevo, motivo y evidencia aplicable.
- **Información resultante:** Movimiento de ajuste trazable.
- **Auditoría requerida:** Obligatoria con usuario y valores anterior y nuevo.
- **Reglas de negocio relacionadas:** RN-022, RN-027 a RN-029, RN-039 y RN-040.
- **Preguntas abiertas relacionadas:** PA-027, PA-049 y PA-051.
- **Criterio de finalización:** Inventario corregido mediante movimiento, sin borrar el estado previo.

## PR-009 — Controlar lotes, vencimientos y FEFO

- **ID:** PR-009.
- **Nombre:** Controlar lotes, vencimientos y FEFO.
- **Objetivo:** Priorizar salidas y alertas respetando vencimientos por lote.
- **Actores:** Responsable de inventario; propietario administrador como consulta o autorización.
- **Precondiciones:** Lotes registrados en la bodega.
- **Disparador:** Consulta, venta, reposición o revisión de vencimientos.
- **Flujo principal:** 1. Consultar lotes elegibles. 2. Ordenar por vencimiento aplicable. 3. Identificar
  próximos a vencer o vencidos. 4. Sugerir FEFO. 5. Registrar excepción autorizada si existe.
- **Flujos alternativos:** Producto aprobado sin fecha de vencimiento.
- **Excepciones:** Lote vencido, fecha ausente no resuelta o selección distinta sin autorización.
- **Información de entrada:** Lotes, fechas confirmadas, existencias y configuración del tenant.
- **Información resultante:** Prioridad FEFO y alertas operativas.
- **Auditoría requerida:** Excepciones FEFO y cambios relevantes.
- **Reglas de negocio relacionadas:** RN-010, RN-014, RN-028 y RN-039.
- **Preguntas abiertas relacionadas:** PA-010, PA-011 y PA-026.
- **Criterio de finalización:** Lotes clasificados sin consumir automáticamente uno no elegible.

## PR-010 — Registrar una venta por unidad

- **ID:** PR-010.
- **Nombre:** Registrar una venta por unidad.
- **Objetivo:** Vender cantidades contadas con descuento de inventario atómico.
- **Actores:** Propietario vendedor o empleado vendedor; cliente participa.
- **Precondiciones:** Producto activo, stock elegible y permiso de venta.
- **Disparador:** Cliente solicita unidades de un producto.
- **Flujo principal:** 1. Seleccionar producto. 2. Registrar unidades. 3. Seleccionar lote por FEFO. 4.
  Asociar cliente identificado o general. 5. Calcular y confirmar total. 6. Registrar venta, salida,
  ticket y auditoría atómicamente.
- **Flujos alternativos:** Producto comprado por caja, peso o lote pero vendido por unidad.
- **Excepciones:** Stock insuficiente, concurrencia, lote vencido o fallo de inventario.
- **Información de entrada:** Producto, unidades, precio, lote y cliente aplicable.
- **Información resultante:** Venta confirmada, inventario actualizado y ticket.
- **Auditoría requerida:** Venta, vendedor, tenant, lote, cantidad e importe.
- **Reglas de negocio relacionadas:** RN-014, RN-015 y RN-037 a RN-046.
- **Preguntas abiertas relacionadas:** PA-013, PA-014, PA-015 y PA-026.
- **Criterio de finalización:** Todos los efectos se confirman o se revierten juntos.

## PR-011 — Registrar una venta por peso

- **ID:** PR-011.
- **Nombre:** Registrar una venta por peso.
- **Objetivo:** Vender una cantidad decimal realmente medida e ingresada manualmente.
- **Actores:** Propietario vendedor o empleado vendedor; cliente participa.
- **Precondiciones:** Producto habilitado por peso y stock elegible.
- **Disparador:** Cliente solicita una cantidad pesada.
- **Flujo principal:** 1. Seleccionar producto. 2. Ingresar manualmente el peso medido. 3. Validar
  precisión y disponibilidad. 4. Aplicar FEFO. 5. Calcular importe. 6. Confirmar venta, salida, ticket
  y auditoría atómicamente.
- **Flujos alternativos:** Producto con modalidad adicional por unidad.
- **Excepciones:** Peso erróneo, redondeo no validado, stock insuficiente o concurrencia.
- **Información de entrada:** Peso medido, precio, producto, lote y cliente aplicable.
- **Información resultante:** Venta e inventario expresados con la precisión aprobada.
- **Auditoría requerida:** Peso ingresado, importe, lote, usuario y fecha.
- **Reglas de negocio relacionadas:** RN-014, RN-016, RN-017 y RN-037 a RN-040.
- **Preguntas abiertas relacionadas:** PA-026, PA-049 y PA-050.
- **Criterio de finalización:** Cantidad medida descontada sin integración automática con balanza.

## PR-012 — Registrar una venta por importe

- **ID:** PR-012.
- **Nombre:** Registrar una venta por importe sin medición exacta.
- **Objetivo:** Registrar fielmente el importe cobrado por una porción determinada visualmente.
- **Actores:** Propietario vendedor o empleado vendedor; cliente participa.
- **Precondiciones:** Producto y lote habilitados para venta por importe.
- **Disparador:** Cliente solicita un importe rápido o personalizado.
- **Flujo principal:** 1. Seleccionar producto. 2. Elegir o ingresar importe. 3. Entregar porción visual
  sin declarar cantidad física. 4. Confirmar. 5. Acumular ingreso del lote. 6. Emitir ticket y auditar.
- **Flujos alternativos:** Actualizar el estado aproximado si el usuario tiene permiso.
- **Excepciones:** Importe inválido, lote agotado o intento de registrar cantidad ficticia.
- **Información de entrada:** Producto, lote, importe y cliente aplicable.
- **Información resultante:** Venta monetaria exacta e ingreso acumulado actualizado.
- **Auditoría requerida:** Producto, importe, lote, vendedor y estado modificado si aplica.
- **Reglas de negocio relacionadas:** RN-018 a RN-029 y RN-037 a RN-040.
- **Preguntas abiertas relacionadas:** PA-044, PA-045, PA-051 y PA-052.
- **Criterio de finalización:** Venta y ticket registrados sin clasificarla como descuento.

## PR-013 — Registrar venta de producto por peso o unidad

- **ID:** PR-013.
- **Nombre:** Registrar venta con doble modalidad.
- **Objetivo:** Mantener una equivalencia estimada sin presentarla como medición exacta.
- **Actores:** Propietario vendedor o empleado vendedor; responsable de inventario para ajustes.
- **Precondiciones:** Producto configurado con ambas modalidades y lote con equivalencia estimada.
- **Disparador:** Venta concreta por peso o por unidad.
- **Flujo principal:** 1. Elegir modalidad. 2. Registrar unidad contada o peso medido. 3. Confirmar
  venta. 4. Aplicar equivalencia estimada al control del lote. 5. Auditar.
- **Flujos alternativos:** Ajuste posterior por desviación física autorizado mediante PR-008.
- **Excepciones:** Equivalencia ausente, desviación o precisión pendiente.
- **Información de entrada:** Modalidad, cantidad real y equivalencia del lote.
- **Información resultante:** Venta exacta en lo cobrado y referencia estimada de inventario.
- **Auditoría requerida:** Modalidad, cantidad, equivalencia usada y ajustes posteriores.
- **Reglas de negocio relacionadas:** RN-022, RN-028, RN-037 a RN-040.
- **Preguntas abiertas relacionadas:** PA-049, PA-050 y PA-051.
- **Criterio de finalización:** Estimación identificada y venta aplicada atómicamente.

## PR-014 — Registrar un cliente identificado

- **ID:** PR-014.
- **Nombre:** Registrar un cliente identificado.
- **Objetivo:** Mantener los datos mínimos necesarios dentro de una bodega.
- **Actores:** Propietario vendedor o empleado vendedor; cliente participa.
- **Precondiciones:** Finalidad autorizada y permiso para registrar clientes.
- **Disparador:** Cliente acepta identificarse.
- **Flujo principal:** 1. Generar código interno y fecha. 2. Registrar nombre completo y teléfono. 3.
  Validar. 4. Guardar dentro del tenant. 5. Auditar.
- **Flujos alternativos:** Registrar la venta como «Cliente general» mediante PR-016.
- **Excepciones:** Falta de datos obligatorios o intento de recopilar datos excluidos.
- **Información de entrada:** Nombre completo y teléfono.
- **Información resultante:** Cliente interno de la bodega con código y fecha generados.
- **Auditoría requerida:** Alta y cambios posteriores autorizados.
- **Reglas de negocio relacionadas:** RN-042, RN-043 y RN-047.
- **Preguntas abiertas relacionadas:** PA-022.
- **Criterio de finalización:** Cliente guardado con datos mínimos y aislado por tenant.

## PR-015 — Registrar consentimiento promocional

- **ID:** PR-015.
- **Nombre:** Registrar consentimiento promocional.
- **Objetivo:** Separar la autorización de contacto de la identificación del cliente.
- **Actores:** Cliente participa; usuario autorizado registra.
- **Precondiciones:** Cliente identificado en la bodega.
- **Disparador:** Cliente otorga, niega o cambia su consentimiento.
- **Flujo principal:** 1. Informar finalidad. 2. Capturar decisión explícita. 3. Registrar de forma
  independiente. 4. Confirmar. 5. Auditar.
- **Flujos alternativos:** Cliente permanece identificado sin consentir comunicaciones.
- **Excepciones:** Consentimiento implícito, unido a otro dato o sin trazabilidad.
- **Información de entrada:** Decisión del cliente y contexto autorizado.
- **Información resultante:** Registro independiente y auditable.
- **Auditoría requerida:** Decisión, fecha, usuario y cambios.
- **Reglas de negocio relacionadas:** RN-044 y RN-047.
- **Preguntas abiertas relacionadas:** PA-007 y PA-022.
- **Criterio de finalización:** Preferencia registrada sin condicionar la venta o identificación.

## PR-016 — Registrar una venta sin cliente identificado

- **ID:** PR-016.
- **Nombre:** Registrar venta con «Cliente general».
- **Objetivo:** Permitir ventas sin recopilar identidad individual.
- **Actores:** Propietario vendedor o empleado vendedor; cliente participa anónimamente.
- **Precondiciones:** Venta válida dentro de la bodega.
- **Disparador:** Cliente no se identifica o no corresponde identificarlo.
- **Flujo principal:** 1. Preparar la venta. 2. Asociar «Cliente general». 3. Confirmar. 4. Registrar
  venta e inventario atómicamente. 5. Emitir ticket. 6. Auditar.
- **Flujos alternativos:** Asociar un cliente identificado válido mediante PR-014.
- **Excepciones:** Intento de incluir la venta en análisis individual.
- **Información de entrada:** Datos de venta, sin datos personales.
- **Información resultante:** Venta no identificada individualmente.
- **Auditoría requerida:** Auditoría normal de venta, sin identidad inventada.
- **Reglas de negocio relacionadas:** RN-045, RN-046 y RN-037 a RN-040.
- **Preguntas abiertas relacionadas:** PA-015.
- **Criterio de finalización:** Venta excluida de rankings, fidelización y análisis individual.

## PR-017 — Emitir un ticket interno

- **ID:** PR-017.
- **Nombre:** Emitir un ticket interno.
- **Objetivo:** Comunicar el resultado de una venta sin presentarlo como comprobante tributario.
- **Actores:** Propietario vendedor o empleado vendedor; cliente recibe.
- **Precondiciones:** Venta confirmada.
- **Disparador:** Finalización íntegra de la venta.
- **Flujo principal:** 1. Recuperar datos autorizados de la venta. 2. Formatear productos, importes y
  cantidades reales cuando existan. 3. Omitir cantidad física en venta por importe. 4. Emitir ticket.
- **Flujos alternativos:** Ticket de venta por unidad, peso o importe.
- **Excepciones:** Dato privado innecesario o cantidad ficticia.
- **Información de entrada:** Venta confirmada y configuración de ticket del tenant.
- **Información resultante:** Ticket interno comprensible.
- **Auditoría requerida:** La emisión se vincula con la venta; reemisiones según regla aprobada.
- **Reglas de negocio relacionadas:** RN-021, RN-037, RN-039 y RN-043.
- **Preguntas abiertas relacionadas:** PA-015 y PA-052.
- **Criterio de finalización:** Ticket representa fielmente la venta y su modalidad.

## PR-018 — Anular una venta

- **ID:** PR-018.
- **Nombre:** Anular una venta.
- **Objetivo:** Revertir efectos autorizados sin eliminar la operación original.
- **Actores:** Propietario administrador u otro rol que defina PA-014.
- **Precondiciones:** Venta confirmada, permiso y condiciones aprobadas.
- **Disparador:** Solicitud justificada de anulación.
- **Flujo principal:** 1. Seleccionar venta. 2. Registrar motivo. 3. Validar permiso, plazo y estado. 4.
  Revertir efectos autorizados sobre inventario de forma atómica. 5. Conservar original. 6. Auditar.
- **Flujos alternativos:** Rechazar y derivar a tratamiento definido posteriormente.
- **Excepciones:** Fuera de plazo, sin permiso o lote no restituible según reglas pendientes.
- **Información de entrada:** Venta, motivo y autorización.
- **Información resultante:** Venta anulada y movimientos trazables o rechazo explícito.
- **Auditoría requerida:** Obligatoria con motivo, responsable y valores afectados.
- **Reglas de negocio relacionadas:** RN-029, RN-037 a RN-041.
- **Preguntas abiertas relacionadas:** PA-013 y PA-014.
- **Criterio de finalización:** Reversión íntegra y auditable o ausencia total de cambios.

## PR-019 — Cerrar un lote vendido por importe

- **ID:** PR-019.
- **Nombre:** Cerrar un lote vendido por importe.
- **Objetivo:** Convertir el margen estimado en definitivo al finalizar el lote.
- **Actores:** Responsable de inventario; propietario administrador cuando autorice.
- **Precondiciones:** Lote no medido abierto con ingresos registrados.
- **Disparador:** Lote agotado, descartado o listo para cierre.
- **Flujo principal:** 1. Seleccionar lote. 2. Elegir condición de cierre. 3. Validar permiso. 4.
  Consolidar ingresos exactos y costos registrados. 5. Calcular margen bruto definitivo. 6. Cerrar y
  auditar.
- **Flujos alternativos:** Registrar merma o descarte antes del cierre.
- **Excepciones:** Cierre sin autorización, costos inconsistentes o lote todavía disponible.
- **Información de entrada:** Lote, condición, ingresos, costo atribuible y costos adicionales.
- **Información resultante:** Lote cerrado y margen definitivo.
- **Auditoría requerida:** Estado anterior y nuevo, responsable, motivo y cálculo aplicado.
- **Reglas de negocio relacionadas:** RN-023 a RN-029, RN-039 y RN-040.
- **Preguntas abiertas relacionadas:** PA-045, PA-046 y PA-051.
- **Criterio de finalización:** Cierre conservado históricamente y margen ya no marcado como estimado.

## PR-020 — Consultar análisis y preparar reposición

- **ID:** PR-020.
- **Nombre:** Consultar análisis y preparar reposición.
- **Objetivo:** Apoyar decisiones con historial y reglas explicables del tenant.
- **Actores:** Propietario administrador; responsable de inventario; proveedor participa externamente.
- **Precondiciones:** Historial autorizado y configuración disponible.
- **Disparador:** Revisión operativa, alerta o necesidad de reposición.
- **Flujo principal:** 1. Consultar ventas, inventario y vencimientos autorizados. 2. Aplicar reglas
  determinísticas. 3. Mostrar alertas o recomendaciones explicables. 4. Revisar humanamente. 5.
  Preparar acción de reposición dentro del alcance aprobado.
- **Flujos alternativos:** Consultar productos agotados, con bajo stock o próximos a vencer.
- **Excepciones:** Datos de otro tenant, indicador no definido o recomendación sin explicación.
- **Información de entrada:** Historial estructurado y configuración de la bodega.
- **Información resultante:** Alertas, indicadores y preparación de reposición.
- **Auditoría requerida:** Acciones o cambios derivados; consultas según política aprobada.
- **Reglas de negocio relacionadas:** RN-005, RN-014, RN-047 y RN-049 a RN-052.
- **Preguntas abiertas relacionadas:** PA-009, PA-010 y PA-017 a PA-020.
- **Criterio de finalización:** Resultado explicable mostrado sin modelo predictivo propio ni cruce de tenants.

## PR-021 — Extraer y cargar información analítica

- **ID:** PR-021.
- **Nombre:** Extraer y cargar información analítica.
- **Objetivo:** Actualizar staging, Data Warehouse y DataMarts sin modificar el OLTP.
- **Actores:** Administrador técnico analítico; investigador o analista BI; responsable de calidad.
- **Precondiciones:** Fuentes autorizadas, ambiente separado, punto de corte y credenciales de solo lectura.
- **Disparador:** Ejecución programada o manual controlada de ETL.
- **Flujo principal:** 1. Registrar ejecución y corte. 2. Extraer cambios por tenant. 3. Cargar staging. 4. Validar, limpiar y conformar. 5. Poner inválidos en cuarentena. 6. Cargar dimensiones y hechos. 7.
  Actualizar DataMarts de Ventas e Inventario. 8. Conciliar y publicar. 9. Cerrar auditoría ETL.
- **Flujos alternativos:** Reprocesar intervalo o cuarentena de forma idempotente.
- **Excepciones:** Fallo ETL, duplicado, dimensión desconocida, tenant incorrecto o carga parcial.
- **Información de entrada:** Cambios OLTP, reglas versionadas, tenant y punto de corte.
- **Información resultante:** Corte analítico consistente, errores aislados y linaje.
- **Auditoría requerida:** Ejecución, fuente, tenants, reglas, conteos, errores, resultado y responsable.
- **Reglas de negocio relacionadas:** RN-053 a RN-058.
- **Preguntas abiertas relacionadas:** Herramienta ETL, mecanismo incremental, frecuencia, umbrales y
  política SCD continúan pendientes.
- **Criterio de finalización:** DataMarts publicados y conciliados o ejecución fallida sin corte parcial visible.

## PR-022 — Generar indicadores BI

- **ID:** PR-022.
- **Nombre:** Generar indicadores BI.
- **Objetivo:** Calcular métricas únicas y trazables sobre los DataMarts autorizados.
- **Actores:** Investigador o analista BI; propietario administrador valida significado.
- **Precondiciones:** Corte analítico publicado, fórmulas versionadas y acceso al tenant.
- **Disparador:** Actualización de DataMarts o solicitud autorizada de análisis.
- **Flujo principal:** 1. Seleccionar tenant y corte. 2. Aplicar definición de métrica. 3. Calcular con
  dimensiones conformadas. 4. Separar margen estimado y definitivo. 5. Validar suficiencia y
  conciliación. 6. Publicar resultado con fecha y linaje.
- **Flujos alternativos:** Marcar indicador no disponible si faltan datos suficientes.
- **Excepciones:** Fórmula no validada, doble conteo, datos desactualizados o mezcla de unidades.
- **Información de entrada:** Hechos, dimensiones, fórmula preliminar o aprobada y filtros autorizados.
- **Información resultante:** Indicadores trazables de ventas, rentabilidad, inventario, vencimientos y mermas.
- **Auditoría requerida:** Versión de definición, corte, tenant y ejecución que produjo el resultado.
- **Reglas de negocio relacionadas:** RN-054, RN-055, RN-057, RN-059 y RN-060.
- **Preguntas abiertas relacionadas:** Fórmulas finales, tolerancias, ventanas, umbrales y responsables.
- **Criterio de finalización:** Indicador calculado una sola vez por definición y claramente interpretado.

## PR-023 — Consultar dashboard BI

- **ID:** PR-023.
- **Nombre:** Consultar dashboard BI.
- **Objetivo:** Presentar información analítica autorizada en Power BI sin acceso de escritura al OLTP.
- **Actores:** Propietario administrador como consumidor; responsable de inventario según permiso;
  investigador o analista BI; administrador técnico solo para operación técnica.
- **Precondiciones:** Dashboard posterior publicado, usuario autorizado y corte analítico disponible.
- **Disparador:** Usuario abre o actualiza un reporte.
- **Flujo principal:** 1. Autenticar. 2. Resolver pertenencia y tenant. 3. Aplicar seguridad autoritativa. 4. Cargar indicadores del DataMart. 5. Mostrar filtros, fecha de actualización y limitaciones. 6.
  Permitir consulta sin modificación operacional.
- **Flujos alternativos:** Mostrar estado sin datos o alerta de dashboard desactualizado.
- **Excepciones:** Intento de otro tenant, DataMart no conciliado o métrica insuficiente.
- **Información de entrada:** Identidad, pertenencia, tenant, filtros y corte publicado.
- **Información resultante:** Visualización autorizada y de solo lectura.
- **Auditoría requerida:** Accesos y exportaciones según política; incidentes siempre trazables.
- **Reglas de negocio relacionadas:** RN-053 a RN-060.
- **Preguntas abiertas relacionadas:** Licenciamiento, modo de conexión, seguridad exacta, frescura y
  política de auditoría de consultas.
- **Criterio de finalización:** Reporte visible solo para el tenant autorizado, con fecha de corte y sin escritura.
