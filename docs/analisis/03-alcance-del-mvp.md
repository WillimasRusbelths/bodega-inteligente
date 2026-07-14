# Alcance del MVP

## Funcionalidades incluidas en la aplicación móvil

- Acceso autenticado y selección de una pertenencia autorizada a una bodega.
- Consulta y configuración operativa básica permitida por rol.
- Registro y consulta de productos, códigos de barras y categorías.
- Código interno generado, búsqueda por nombre, productos frecuentes y botones rápidos para
  artículos sin código de barras.
- Escaneo de códigos de barras.
- Registro de lotes, costos y fechas de vencimiento.
- Registro de unidad de compra, unidad base de inventario, modalidad de venta, forma de control del
  stock, presentación comercial y cantidad aprovechable cuando sea medible.
- Venta por unidad, por peso ingresado manualmente y por importe, con cantidades decimales cuando
  corresponda.
- Conversiones estimadas por lote para productos vendidos por peso y por unidad, corregibles
  mediante ajustes de inventario.
- Control aproximado de recipientes y atados mediante estados de disponibilidad.
- Transformación básica, mermas, deterioros, descartes y cierres de lote.
- Captura OCR de vencimientos con confirmación o corrección humana obligatoria.
- Registro de entradas, salidas y ajustes autorizados de inventario.
- Consulta de stock, stock mínimo y alertas operativas.
- Registro y consulta mínima de proveedores.
- Punto de venta con selección de productos, cantidades y descuentos autorizados.
- Importes rápidos o personalizados para ventas por importe; estas operaciones no son descuentos.
- Aplicación FEFO cuando existan lotes con vencimientos diferentes.
- Registro de clientes identificados con código interno y fecha de registro generados por el
  sistema, nombre completo y teléfono obligatorios.
- Registro separado, explícito y auditable del consentimiento para promociones o comunicaciones.
- Ventas sin identificación individual mediante «Cliente general».
- Emisión de ticket interno.
- Ticket de venta por importe con el producto y el importe vendido, sin cantidades ficticias.
- Consulta operativa de ventas propias o autorizadas.

## Funcionalidades incluidas en la plataforma web

- Administración básica de la bodega y su configuración independiente.
- Administración de usuarios, invitaciones o altas, pertenencias, roles y permisos, sujeto a la
  definición pendiente del flujo exacto.
- Gestión de productos, categorías, códigos, lotes, proveedores y parámetros de inventario.
- Historial y análisis de ventas e inventario.
- Identificación de productos agotados, con bajo stock o próximos a vencer.
- Dashboard inicial con indicadores cuya definición exacta está pendiente.
- Consulta autorizada de clientes frecuentes con datos mínimos.
- Preparación y seguimiento inicial de reposición y pedidos a proveedores.
- Alertas y recomendaciones iniciales de promociones, precios y reposición basadas en reglas
  determinísticas, explícitas y explicables.
- Consulta autorizada de auditorías y reportes.

## Capacidades del backend

- API REST centralizada y documentada con OpenAPI.
- Autenticación y autorización por pertenencia activa a cada tenant.
- Validación autoritativa de entradas y del contexto de bodega.
- Reglas de ventas, inventario, lotes, FEFO, descuentos y configuración.
- Transacciones atómicas para ventas y movimientos relacionados.
- Generación y conservación de auditorías inmutables.
- Aplicación de borrado lógico o estados históricos donde corresponda.
- Cálculo de alertas y recomendaciones iniciales basadas en reglas.
- Cálculo de margen exacto para productos contados o pesados, margen estimado para lotes no medidos
  abiertos y margen definitivo al agotar, descartar o cerrar dichos lotes.
- Rechazo explícito de intentos de acceso cruzado entre bodegas.
- Contratos consistentes para las aplicaciones móvil y web.

## Capacidades iniciales de la base de datos

Sin definir todavía tablas ni migraciones, el modelo futuro deberá permitir representar:

- Bodegas como tenants y su configuración independiente.
- Personas, usuarios, pertenencias, roles y permisos por bodega.
- Productos, códigos de barras, categorías y proveedores por tenant.
- Productos con código interno, variantes por marca y presentación, unidad de compra, unidad base,
  modalidad de venta y forma de control del stock.
- Lotes de compra y transformados con costos, vencimientos, cantidades aprovechables reales,
  estados aproximados, mermas y cierres.
- Movimientos de inventario y relaciones con ventas, ajustes y lotes.
- Ventas, detalles, descuentos, anulaciones y tickets internos.
- Clientes identificados con código interno, nombre completo, teléfono y fecha de registro;
  consentimiento de comunicaciones separado; y «Cliente general» para ventas no identificadas.
- Alertas, recomendaciones basadas en reglas y auditorías.
- Historial estructurado de ventas, inventario, precios, promociones y vencimientos para una futura
  evaluación predictiva, siempre aislado por tenant.
- Conservación histórica, borrado lógico y restricciones de aislamiento.
- Transformaciones básicas con producto y lote de origen, cantidad consumida, costo atribuido,
  producto preparado resultante, fecha, usuario, costos adicionales opcionales y lote resultante.

Este documento no autoriza ni diseña esquemas físicos.

## Funciones administrativas por bodega

- Mantener identidad y datos básicos del negocio.
- Administrar pertenencias, roles y permisos.
- Configurar stock mínimo, días de alerta y permisos de descuento.
- Configurar datos del ticket y parámetros comerciales aprobados.
- Administrar categorías y proveedores propios.
- Consultar reportes, alertas y auditorías según permiso.
- Autorizar operaciones restringidas como anulaciones o descuentos.

## Características multi-tenant obligatorias

- Toda entidad perteneciente a una bodega tiene asociación inequívoca con su tenant.
- El backend determina o valida la bodega autorizada en cada operación protegida.
- Ningún cliente puede obtener acceso enviando por sí solo un identificador de otra bodega.
- Roles y permisos se resuelven por pertenencia, no como atributos globales.
- Configuraciones, catálogos, ventas, clientes, proveedores y auditorías permanecen separados.
- Se contemplan pruebas negativas de lectura, escritura y eliminación cruzada.
- La bodega piloto no se implementa como caso especial mono-tenant.

## Funcionalidades expresamente excluidas del MVP

- Boleta electrónica SUNAT.
- Facturación electrónica.
- Pasarelas de pago.
- Integración con balanzas.
- Medición automática de porciones.
- Producción industrial.
- Trazabilidad sanitaria avanzada.
- Predicción de mermas mediante machine learning.
- Modelos predictivos propios o machine learning entrenado con datos de ventas.
- Predicción de demanda y predicción de reposición.
- Recomendaciones aprendidas de precios y promociones.
- Detección de operaciones anómalas mediante machine learning.
- Entrenamiento de modelos con información histórica de cada bodega.
- Funcionamiento offline completo.
- Suscripciones y planes comerciales.
- Múltiples sucursales por bodega.
- Aplicación pública para consumidores.

Estas capacidades no deben implementarse de forma anticipada. Su futura incorporación requiere una
especificación aprobada.

## Supuestos

1. La validación inicial se realizará en una bodega familiar propiedad del investigador, con cuatro
   usuarios internos y diez clientes voluntarios. Su nombre comercial puede mantenerse anonimizado
   y el distrito está pendiente; la dirección exacta no se solicitará ni publicará y la ubicación
   exacta solo podrá conservarse privadamente cuando sea indispensable para la investigación.
   Tampoco se ha confirmado la distribución exacta de roles internos.
2. Los usuarios dispondrán de dispositivos compatibles; modelos y versiones están pendientes.
3. El MVP contará con conectividad para las operaciones principales; la calidad real está pendiente
   de medición.
4. Los productos sin código de barras usarán un código interno generado y podrán localizarse por
   nombre, productos frecuentes o botones rápidos. La impresión de etiquetas queda para una fase
   posterior; debe definirse el tratamiento de códigos duplicados.
5. Las recomendaciones iniciales serán determinísticas y explicables, no modelos de machine learning.
6. El ticket es interno y no constituye comprobante tributario electrónico.
7. Una persona puede desempeñar varios roles y pertenecer a más de una bodega.
8. La información histórica crítica no se elimina físicamente.
9. Los valores por defecto serán configurables por tenant cuando la constitución así lo exige.
10. El español será el idioma inicial; variantes lingüísticas y localización requieren investigación.
11. Los catorce participantes iniciales conforman una validación piloto y no una muestra estadística
    de todas las bodegas de la región de Ayacucho.
12. El peso del MVP se ingresa manualmente; no existe integración con una balanza electrónica.
13. Las cantidades no medidas no se infieren. Para ventas por importe se registra el valor monetario
    y un estado aproximado del lote.

## Modalidades de producto y venta del MVP

1. **Empacados vendidos por unidad**: cada marca y presentación se diferencia. Una compra por caja
   se convierte en las unidades realmente recibidas para inventario y venta.
2. **Vendidos por peso**: el lote registra costo total y peso aprovechable real. Inventario y venta
   admiten decimales, con peso ingresado manualmente.
3. **Comprados por peso o lote y vendidos por unidad**: la recepción registra unidades aprovechables
   reales y el costo unitario se obtiene del costo total atribuible.
4. **Vendidos por peso y por unidad**: la recepción puede registrar peso y cantidad para obtener una
   equivalencia estimada por lote, identificada como estimación y corregible mediante ajustes.
5. **Vendidos por importe sin medición exacta**: el vendedor determina visualmente la porción. Se
   registra producto e importe, no gramos, mililitros, cucharadas ni porciones. El lote usa estados
   aproximados —completo, más de la mitad, mitad, poco o agotado, sujetos a validación—; su ingreso
   acumulado es exacto, el margen es estimado mientras permanece abierto y definitivo al cierre.
6. **Transformados por la bodega**: una transformación básica consume una cantidad real de un lote,
   atribuye su costo y genera un lote preparado, con responsable, fecha y costos adicionales
   opcionales. No constituye un módulo industrial de producción.
7. **Molidos adquiridos en bolsa no medida**: la bolsa se registra como lote o recipiente con costo,
   ventas por importe y estado aproximado; el margen se determina al cierre sin inventar peso o
   volumen.

## Reglas de costo y margen

- En productos contados o pesados, el margen se calcula con cantidades exactas.
- En lotes vendidos por importe sin medición, el ingreso acumulado es exacto y el margen permanece
  estimado mientras el lote está abierto.
- Al agotar, descartar o cerrar el lote, el margen definitivo compara sus ingresos acumulados con el
  costo atribuible y los costos adicionales registrados.
- Las mermas y el deterioro se registran para explicar el resultado; nunca se presuponen porciones
  iguales.

## Alcance del componente inteligente

El MVP no incluye un modelo predictivo propio entrenado con datos de ventas. Su componente
inteligente se limita a OCR preentrenado para capturar fechas de vencimiento —con confirmación o
corrección humana obligatoria antes de guardar— y recomendaciones de promociones, precios y
reposición mediante reglas determinísticas y explicables.

El historial estructurado de ventas, inventario, precios, promociones y vencimientos permitirá
evaluar posteriormente capacidades predictivas, sin autorizarlas ni implementarlas en el MVP. Toda
fase futura deberá preservar el aislamiento multi-tenant y contar con garantías de privacidad y
autorización para el uso de datos.

## Reglas de identificación de clientes

- Para un cliente identificado son obligatorios el código interno generado por el sistema, el nombre
  completo, el número de teléfono y la fecha de registro generada por el sistema.
- Durante el MVP no se recopilan DNI, dirección domiciliaria, fecha de nacimiento ni correo
  electrónico.
- El consentimiento para promociones o comunicaciones es explícito, independiente de la
  identificación y auditable.
- Se permiten ventas sin identificar individualmente al cliente mediante «Cliente general».
- Las ventas de «Cliente general» se excluyen de rankings, fidelización y análisis individual.

## Restricciones

- Cumplimiento obligatorio de la constitución 1.0.0.
- Arquitectura multi-tenant, desacoplada y basada en backend desde la primera versión.
- Experiencia mobile-first y lenguaje comprensible.
- Confirmación humana obligatoria de cualquier fecha capturada por OCR.
- Mínimo privilegio, privacidad y ausencia de secretos reales en el repositorio.
- Separación de desarrollo, pruebas y producción.
- PostgreSQL/Supabase, Prisma, NestJS, React/Vite, React Native/Expo y TypeScript estricto como stack
  aprobado para fases posteriores.
- No se habilitan operaciones destructivas sobre producción sin aprobación humana expresa.

## Dependencias

- Acceso autorizado a la bodega piloto y disponibilidad de participantes.
- Investigación de procesos actuales, dispositivos, conectividad y vocabulario de usuarios.
- Definición humana de políticas de registro, invitación, descuentos, clientes, tickets y retención.
- Catálogo o muestras reales autorizadas para validar códigos y OCR sin exponer datos sensibles.
- Criterios acordados para alertas, dashboard y recomendaciones basadas en reglas.
- Ambientes y credenciales separados cuando comience la implementación.

## Criterios para declarar terminado el MVP

- Todas las capacidades incluidas cuentan con especificaciones y trazabilidad aprobadas.
- Los recorridos críticos móvil y web satisfacen criterios de aceptación con la bodega piloto.
- Ventas y movimientos relacionados son atómicos y preservan inventario e historia.
- Lotes, vencimientos, FEFO y confirmación humana de OCR funcionan según reglas aprobadas.
- El aislamiento multi-tenant y la autorización por pertenencia están demostrados con pruebas negativas.
- Auditorías, privacidad, borrado lógico y separación de ambientes cumplen la constitución.
- Pruebas unitarias, de integración, de sistema, regresión y rendimiento aplicables pasan.
- La documentación, OpenAPI, modelo de datos, decisiones y evidencias están actualizados.
- No se han incorporado capacidades excluidas.
- El cambio ha sido revisado antes de integrarse y no existen regresiones críticas conocidas.
