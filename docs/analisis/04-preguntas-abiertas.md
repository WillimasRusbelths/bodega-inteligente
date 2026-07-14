# Preguntas abiertas

## Uso del registro

Estas preguntas deben responderse antes del diseño cuando afecten alcance, datos, autorización o
reglas centrales. El estado inicial `Pendiente` indica que no existe aún una decisión aprobada.

| ID | Tema | Pregunta | Impacto | Responsable de responder | Estado |
|---|---|---|---|---|---|
| PA-001 | Identidad | ¿Cuál será el nombre definitivo y la identidad inicial de la plataforma? Decisión provisional: BodegIA. | Medio: documentación y experiencia | Propietario del producto e investigadores | Resuelta provisionalmente |
| PA-002 | Alta de tenant | ¿Quién puede registrar una nueva bodega y qué validación debe completar? | Alto: seguridad, fraude y onboarding | Propietario del producto y asesor legal | Pendiente |
| PA-003 | Trabajadores | ¿Los trabajadores se crean, se invitan o se vinculan mediante ambos mecanismos? | Alto: identidad y soporte | Propietarios piloto y propietario del producto | Pendiente |
| PA-004 | Pertenencias | ¿Puede una persona reutilizar una misma cuenta en varias bodegas y cómo cambia de contexto? | Alto: UX y aislamiento | Propietario del producto y arquitectura | Pendiente |
| PA-005 | Roles | ¿Qué permisos exactos componen cada rol inicial y cuáles puede combinar una persona? | Crítico: autorización | Propietarios piloto y seguridad | Pendiente |
| PA-006 | Clientes | ¿Qué datos de cliente son obligatorios o no deben recopilarse? Decisión MVP: nombre completo y teléfono obligatorios; código interno y fecha de registro generados por el sistema; no se recopilan DNI, dirección domiciliaria, fecha de nacimiento ni correo electrónico. | Crítico: privacidad y UX | Propietarios piloto, producto y asesor legal | Resuelta para el MVP |
| PA-007 | Consentimiento | ¿Qué mecanismo registra autorización para fidelización o contacto? Decisión: consentimiento explícito, independiente y auditable; queda pendiente la redacción legal definitiva. | Alto: privacidad | Propietario del producto y asesor legal | Resuelta parcialmente |
| PA-008 | Descuentos | ¿Qué límites, motivos y niveles de aprobación se aplican a descuentos? | Alto: ventas y auditoría | Propietarios piloto | Pendiente |
| PA-009 | Stock bajo | ¿El umbral se define por producto, categoría o valor general por bodega? | Alto: configuración y alertas | Propietarios piloto e inventario | Pendiente |
| PA-010 | Vencimientos | ¿Cuántos niveles y días de anticipación requieren las alertas por bodega? | Alto: operación | Propietarios piloto e inventario | Pendiente |
| PA-011 | Sin vencimiento | ¿Cómo se clasifica y controla un producto que no posee fecha de vencimiento? | Alto: modelo de lotes y FEFO | Responsable de inventario y producto | Pendiente |
| PA-012 | OCR | ¿Qué formatos de fecha, calidad mínima y flujo de corrección se aceptan? | Alto: captura y errores | Usuarios piloto, UX y producto | Pendiente |
| PA-013 | Devoluciones | ¿Qué tipos de devolución se permiten y cómo restituyen stock, lote y pago registrado? | Crítico: transacciones y auditoría | Propietarios piloto y contabilidad | Pendiente |
| PA-014 | Anulaciones | ¿Quién puede anular, en qué plazo y con qué motivo obligatorio? | Crítico: control y fraude | Propietarios piloto | Pendiente |
| PA-015 | Ticket | ¿Qué datos son obligatorios, opcionales o prohibidos en el ticket interno? | Alto: operación y privacidad | Propietarios piloto y asesor legal | Pendiente |
| PA-016 | Costos por lote | ¿Cómo se registra un costo variable y qué regla usa el análisis de margen? | Crítico: inventario y rentabilidad | Propietarios piloto y contabilidad | Pendiente |
| PA-017 | Precio | ¿Qué reglas, límites y evidencia sustentan recomendaciones iniciales de precio? | Alto: recomendación explicable | Propietarios piloto y producto | Pendiente |
| PA-018 | Promociones | ¿Qué tipos de promoción y restricciones pueden recomendarse en el MVP? | Medio: alcance y reglas | Propietarios piloto y producto | Pendiente |
| PA-019 | Pedido | ¿El MVP solo prepara una sugerencia o también registra estados del pedido al proveedor? | Alto: alcance y flujo | Propietarios piloto y proveedores | Pendiente |
| PA-020 | Dashboard | ¿Qué indicadores son indispensables y cómo se definen sin ambigüedad? | Alto: análisis y aceptación | Propietarios piloto e investigadores | Pendiente |
| PA-021 | Administrador técnico | ¿En qué situaciones puede acceder a datos de un tenant, con qué aprobación y por cuánto tiempo? | Crítico: privacidad y seguridad | Seguridad, producto y asesor legal | Pendiente |
| PA-022 | Conservación | ¿Cuánto tiempo se conservan clientes, tickets y datos no críticos, y qué obligaciones legales aplican? | Crítico: privacidad y cumplimiento | Propietario del producto y asesor legal | Pendiente |
| PA-023 | Conectividad | ¿Qué calidad de conexión existe en el piloto y qué degradación parcial se requiere antes de un modo offline completo? | Alto: arquitectura y UX | Investigadores y usuarios piloto | Pendiente |
| PA-024 | Dispositivos | ¿Qué teléfonos, cámaras, navegadores y resoluciones deben soportarse inicialmente? | Alto: compatibilidad y pruebas | Investigadores y usuarios piloto | Pendiente |
| PA-025 | Códigos | ¿Cómo se tratan productos sin código, códigos internos y un mismo código asociado a presentaciones distintas? | Alto: catálogo y venta | Inventario y propietarios piloto | Pendiente |
| PA-026 | FEFO | ¿Qué excepciones permiten seleccionar un lote distinto del sugerido y quién las autoriza? | Alto: inventario y auditoría | Inventario y propietarios piloto | Pendiente |
| PA-027 | Ajustes | ¿Qué motivos de ajuste, pérdida o merma se admiten y qué aprobación requieren? | Alto: integridad y auditoría | Inventario y propietarios piloto | Pendiente |
| PA-028 | Auditoría | ¿Qué eventos adicionales se consideran relevantes y cuánto detalle técnico se conserva? | Alto: trazabilidad y privacidad | Seguridad, producto y propietarios piloto | Pendiente |
| PA-029 | Piloto | ¿Qué procesos validará la bodega piloto y qué condiciones definirán la aceptación? Decisión: bodega familiar propiedad del investigador, con 4 usuarios internos y 10 clientes voluntarios; el nombre comercial puede mantenerse anonimizado y quedan pendientes el distrito y las condiciones finales de aceptación. La dirección exacta no se solicitará ni publicará; la ubicación exacta solo podrá conservarse privadamente cuando sea indispensable para la investigación. | Crítico: investigación y éxito | Patrocinador e investigadores | Resuelta parcialmente |
| PA-030 | Métricas | ¿Cuál es la línea base y qué métricas verificables se usarán para evaluar el MVP? | Crítico: evaluación | Investigadores y propietarios piloto | Pendiente |
| PA-031 | Accesibilidad | ¿Qué necesidades visuales, motrices, lingüísticas o de alfabetización digital presentan los usuarios? | Alto: experiencia | Investigadores y usuarios piloto | Pendiente |
| PA-032 | Incidentes | ¿Cómo se notifican y atienden errores operativos o sospechas de acceso indebido? | Alto: soporte y seguridad | Producto, seguridad y propietarios piloto | Pendiente |
| PA-033 | Inteligencia artificial futura | ¿Qué volumen mínimo de historial, variables, modelo base y métricas serán necesarios para autorizar el entrenamiento de un modelo predictivo propio? | Alto | Investigadores, producto y responsable de datos | Pendiente para una fase posterior al MVP |
| PA-034 | Aplicación del consumidor | ¿La experiencia para consumidores estará en la misma aplicación móvil o en una aplicación separada? | Alto: arquitectura y experiencia | Investigadores, producto y usuarios piloto | Pendiente para una fase posterior al MVP |
| PA-035 | Descubrimiento de bodegas | ¿Cómo podrá el consumidor buscar y seleccionar bodegas? | Alto: experiencia y privacidad | Investigadores, producto, usuarios piloto y seguridad | Pendiente para una fase posterior al MVP |
| PA-036 | Catálogo público | ¿Qué datos de los productos podrá publicar cada bodega? | Alto: privacidad y control del tenant | Producto, usuarios piloto y seguridad | Pendiente para una fase posterior al MVP |
| PA-037 | Disponibilidad pública | ¿Se mostrará stock exacto o únicamente estados como Disponible, Pocas unidades y No disponible? | Alto: privacidad e inventario | Producto, usuarios piloto y seguridad | Pendiente para una fase posterior al MVP |
| PA-038 | Recetas | ¿De dónde se obtendrán y cómo se validarán las recetas iniciales? | Alto: contenido y calidad | Investigadores, producto y usuarios piloto | Pendiente para una fase posterior al MVP |
| PA-039 | Preferencias alimentarias | ¿Qué preferencias, alergias y restricciones podrá registrar el consumidor? | Crítico: privacidad y seguridad | Investigadores, producto, usuarios piloto y seguridad | Pendiente para una fase posterior al MVP |
| PA-040 | Recomendación de comidas | ¿Las recomendaciones iniciales utilizarán reglas, un modelo entrenado o IA generativa? | Alto: alcance e inteligencia artificial | Investigadores, producto, usuarios piloto y seguridad | Pendiente para una fase posterior al MVP |
| PA-041 | Privacidad del consumidor | ¿Cómo se separarán los datos globales del consumidor de los datos y relaciones mantenidos por cada bodega? | Crítico: privacidad y aislamiento multi-tenant | Investigadores, producto y seguridad | Pendiente para una fase posterior al MVP |
| PA-042 | Pedidos | ¿La experiencia futura permitirá únicamente consultar productos o también reservar y realizar pedidos? | Alto: alcance y operación | Investigadores, producto, usuarios piloto y seguridad | Pendiente para una fase posterior al MVP |
| PA-043 | Modalidades de inventario | ¿Qué modalidades iniciales de inventario se habilitarán y cómo se asignarán a cada producto? | Alto: modelo operativo y UX | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-044 | Importes rápidos | ¿Qué importes rápidos se permitirán para las ventas por importe? | Medio: agilidad de venta | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-045 | Estado aproximado | ¿Qué estados aproximados se usarán para recipientes y atados? | Alto: control de inventario | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-046 | Cierre de lote | ¿Qué reglas y autorizaciones se aplicarán para agotar, cerrar o descartar un lote? | Alto: margen y auditoría | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-047 | Transformaciones | ¿Cómo se registrarán y corregirán las transformaciones básicas de productos? | Alto: trazabilidad y costos | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-048 | Costos de transformación | ¿Qué costos adicionales podrán atribuirse a un producto transformado y con qué evidencia? | Alto: cálculo de margen | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-049 | Peso y unidad | ¿Cómo se tratarán los productos vendidos por peso y por unidad y cómo se corregirá su equivalencia estimada? | Alto: inventario y venta | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-050 | Precisión decimal | ¿Qué precisión decimal y reglas de redondeo se aplicarán a cantidades, costos, precios e importes? | Crítico: integridad monetaria y de inventario | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-051 | Ajustes aproximados | ¿Quién podrá autorizar ajustes de inventario aproximado y qué motivo o evidencia deberá registrar? | Alto: autorización y auditoría | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |
| PA-052 | Ticket por importe | ¿Qué información mostrará el ticket para una venta por importe sin medición exacta? | Alto: transparencia y UX | Usuarios internos de la bodega piloto | Pendiente de validación con los usuarios internos de la bodega piloto |

## Prioridad de resolución

Antes de diseñar datos y transacciones deben resolverse como mínimo PA-002, PA-004, PA-005, PA-013,
PA-014, PA-016, PA-021, PA-022 y PA-030, además de los aspectos aún abiertos de PA-007 y PA-029.
PA-006 queda resuelta para el MVP. Las demás preguntas pueden ordenarse según el primer recorrido
funcional que se especifique, sin asumir respuestas implícitas.

Las decisiones de detalle de PA-043 a PA-052 deben validarse con los usuarios internos de la bodega
piloto antes de cerrar el diseño de inventario, venta por importe, transformaciones y márgenes.
