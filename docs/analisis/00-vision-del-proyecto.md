# Visión del proyecto

## Nombre provisional

**Nombre provisional y comercial:** BodegIA

**Nombre descriptivo:** BodegIA — Gestión inteligente para bodegas familiares.

**Título académico provisional:** BodegIA: plataforma móvil y web multi-bodega para la gestión
inteligente de ventas, inventario y clientes en bodegas familiares de la región de Ayacucho, 2026.

## Visión del producto

Ofrecer a las bodegas familiares una plataforma accesible, confiable y multi-tenant que integre la
operación diaria desde el teléfono móvil con la administración y el análisis desde la web. Cada
bodega dispondrá de un espacio configurable y aislado, aunque comparta la plataforma con otros
establecimientos.

## Propósito

Reducir la dependencia de cuadernos, cálculos mentales, mensajes y archivos desconectados mediante
un registro consistente de ventas, inventario, lotes, vencimientos, clientes y proveedores. La
plataforma busca mejorar el control operativo y facilitar decisiones sustentadas en información
propia de cada bodega.

## Objetivo general del sistema

Centralizar y proteger la información operativa de múltiples bodegas familiares, permitiendo
registrar sus operaciones, consultar su situación y obtener alertas o recomendaciones iniciales,
con aislamiento estricto de datos, trazabilidad y una experiencia apropiada para usuarios con poca
experiencia tecnológica.

## Objetivos específicos iniciales

1. Agilizar el registro de productos mediante códigos de barras, códigos internos y captura móvil.
2. Controlar existencias por bodega, producto y lote según unidades exactas, peso medido o estados
   aproximados, incluidas fechas de vencimiento, mermas y FEFO.
3. Ejecutar ventas transaccionales por unidad, peso ingresado manualmente o importe y producir
   tickets internos coherentes con cada modalidad.
4. Mantener historial auditable de ventas, movimientos, descuentos y cambios relevantes.
5. Alertar sobre stock bajo, agotamientos y vencimientos próximos según reglas configurables.
6. Centralizar información mínima y autorizada de clientes y proveedores.
7. Proporcionar análisis web y recomendaciones iniciales basadas en reglas explícitas.
8. Administrar usuarios, pertenencias, roles y permisos por bodega.
9. Garantizar que ninguna operación protegida permita acceso cruzado entre bodegas.
10. Validar el MVP con una bodega piloto sin adoptar una estructura mono-tenant.

## Usuarios beneficiarios

- Propietarios que administran la bodega y también pueden vender.
- Empleados vendedores.
- Responsables de inventario.
- Personal que analiza ventas, reposición y promociones.
- Clientes, de manera indirecta, mediante una atención más consistente.
- Proveedores, de manera indirecta, mediante pedidos y reposición mejor informados.

## Propuesta de valor

Una sola solución móvil y web, diseñada para la operación real de bodegas familiares, que combina
registro cotidiano, control por lotes, alertas y análisis sin mezclar la información de diferentes
negocios. A diferencia de una solución para una sola tienda, incorpora desde el inicio pertenencias,
roles, configuración y aislamiento por tenant.

## Resultado esperado del MVP

Una bodega piloto puede configurar su espacio, incorporar usuarios, registrar su catálogo e
inventario por lotes, efectuar ventas, administrar clientes y proveedores, consultar indicadores y
recibir alertas o recomendaciones básicas. Los recorridos críticos cuentan con auditoría y evidencias
de que los datos de una bodega no son accesibles desde otra.

El MVP diferencia la unidad de compra, la unidad base de inventario, la presentación comercial, la
modalidad de venta y la forma de controlar el stock. Admite productos empacados por unidad,
productos pesados con ingreso manual de cantidades decimales, productos comprados por peso o lote y
vendidos por unidad, productos vendidos tanto por peso como por unidad, y productos entregados
visualmente por un importe solicitado. También contempla transformaciones básicas, mermas y cierre
de lotes, sin convertir porciones no medidas en pesos, volúmenes o unidades ficticias.

El componente inteligente del MVP utiliza OCR preentrenado para capturar fechas de vencimiento,
siempre con confirmación o corrección humana antes de guardar, y reglas determinísticas y
explicables para recomendaciones de promociones, precios y reposición. El MVP no incluye un modelo
predictivo propio entrenado con datos de ventas. Sí conserva historial estructurado de ventas,
inventario, precios, promociones y vencimientos para habilitar una eventual fase predictiva.

El efecto cuantitativo del MVP sobre tiempos, pérdidas, exactitud de inventario o ventas se encuentra
**pendiente de medición con datos reales**. No se establecen mejoras porcentuales sin línea base.

## Alcance geográfico inicial

La investigación y validación inicial se enfocan en una bodega familiar de la región de Ayacucho,
propiedad del investigador. Participarán inicialmente cuatro usuarios internos que trabajan en la
bodega y diez clientes voluntarios, para un total de catorce participantes. Esta validación piloto
no constituye todavía una muestra estadística de todas las bodegas de la región. El nombre comercial
de la bodega puede mantenerse anonimizado y el distrito permanece pendiente. La dirección exacta no
se solicitará ni publicará; la ubicación exacta solo podrá conservarse privadamente cuando sea
indispensable para la investigación. El uso de una sola bodega piloto no altera la arquitectura
multi-bodega ni autoriza una excepción mono-tenant.

## Criterios generales de éxito

- La bodega piloto puede completar los flujos incluidos en el MVP con capacitación razonable.
- Las ventas y movimientos críticos son íntegros, trazables y auditables.
- Los lotes y vencimientos se gestionan separadamente y las salidas aplican FEFO cuando corresponde.
- El OCR nunca persiste una fecha sin confirmación o corrección humana.
- Los permisos se resuelven por pertenencia y se rechazan accesos cruzados entre tenants.
- Los usuarios comprenden los mensajes, alertas y acciones principales.
- La aplicación móvil y la web usan el backend; no acceden directamente a tablas críticas.
- Las pruebas, documentación y evidencias exigidas por la constitución están completas.
- Las métricas de resultado específicas se definen después de establecer una línea base real.
