# Contexto y problema

## Descripción de una bodega familiar

Para este proyecto, una bodega familiar es un establecimiento minorista de proximidad cuya gestión y
atención suelen estar a cargo de propietarios, familiares y un número reducido de empleados. Los
roles no son necesariamente exclusivos: una misma persona puede administrar, controlar inventario y
atender ventas durante una misma jornada.

Esta caracterización es una hipótesis de partida. La composición, tamaño, categorías comercializadas
y prácticas concretas de las bodegas de Ayacucho deben validarse mediante investigación de campo.

## Forma actual de trabajo

El contexto proporcionado indica el uso de cuadernos, cálculos mentales, mensajes y archivos no
integrados para registrar o recordar operaciones. Esto puede dispersar la información entre personas
y soportes, y dificulta obtener una visión común del inventario y las ventas.

Debe investigarse en la bodega piloto qué procesos son manuales, quién los ejecuta, qué documentos
utiliza, con qué frecuencia se actualizan y cuáles son las excepciones habituales. No se dispone aún
de tiempos, tasas de error ni resultados de encuestas.

La validación inicial se realizará en una bodega familiar propiedad del investigador, con cuatro
usuarios internos que trabajan en ella y diez clientes voluntarios. Los catorce participantes
corresponden a una validación piloto y no representan todavía una muestra estadística de todas las
bodegas de la región de Ayacucho. El nombre comercial de la bodega puede mantenerse anonimizado y el
distrito permanece pendiente. La dirección exacta no se solicitará ni publicará; la ubicación
exacta solo podrá conservarse privadamente cuando sea indispensable para la investigación.

La observación del piloto muestra que compra, inventario y venta no siempre usan la misma unidad.
Hay productos empacados comprados por caja y vendidos por unidad; productos comprados por caja o
costal y vendidos por kilogramo; productos comprados por peso o lote y vendidos por unidad; frutas
que pueden venderse por peso y por unidad; y productos frescos, molidos o preparados cuya porción se
determina visualmente y se vende por el importe solicitado. Cada marca y presentación comercial
debe poder diferenciarse.

En el último caso no existe una medición real que permita deducir gramos, mililitros, cucharadas o
porciones uniformes. La información exacta es el importe vendido y el ingreso acumulado; la
disponibilidad del lote es aproximada hasta su cierre. BodegIA no debe presentar estimaciones como
mediciones exactas.

## Problema central

Las bodegas familiares objetivo carecen de una fuente integrada, trazable y accesible para controlar
ventas, inventario por lotes, vencimientos, clientes, proveedores y decisiones de reposición, sin
perder la flexibilidad de su operación cotidiana.

## Causas iniciales del problema

- Información registrada en medios separados o mantenida de memoria.
- Actualización manual y no necesariamente simultánea de ventas y existencias.
- Ausencia de trazabilidad uniforme para movimientos, anulaciones, descuentos y cambios de precio.
- Dificultad para asociar vencimientos con lotes concretos.
- Falta de alertas configurables y de una vista histórica consolidada.
- Roles operativos superpuestos sin un esquema formal de permisos por bodega.
- Herramientas genéricas o diseñadas para una única tienda que no incorporan aislamiento multi-tenant.

Estas causas son hipótesis documentales y deben confirmarse con observación y entrevistas.

## Consecuencias operativas y económicas

Consecuencias plausibles que requieren validación real:

- Desconocimiento o desactualización del stock disponible.
- Detección tardía de productos agotados, con bajo stock o próximos a vencer.
- Dificultad para reconstruir el origen de diferencias de inventario.
- Mayor esfuerzo para preparar reportes, pedidos y análisis históricos.
- Decisiones de precios, promociones o reposición con información incompleta.
- Atención inconsistente cuando la información depende de una persona o soporte específico.
- Riesgo de exposición indebida de datos si se comparten archivos sin controles de acceso.

No se atribuyen montos, porcentajes ni frecuencia a estas consecuencias hasta contar con evidencia.

## Procesos afectados

- Alta y mantenimiento de productos, categorías y códigos de barras.
- Recepción de mercadería y registro de costos, lotes y vencimientos.
- Entradas, salidas, ajustes y consulta de inventario.
- Selección FEFO de lotes cuando existen distintos vencimientos.
- Venta, descuento, anulación, devolución y emisión de ticket interno.
- Registro y consulta autorizada de clientes.
- Venta por unidad, por peso ingresado manualmente y por importe, sin clasificar esta última como
  descuento.
- Recepción con costo total, cantidad o peso aprovechable real y conversiones estimadas por lote
  cuando corresponda.
- Transformación básica entre un producto o lote de origen y un lote preparado resultante.
- Registro de mermas, deterioro, descarte y cierre de lote.
- Gestión de proveedores y preparación de pedidos.
- Seguimiento de stock mínimo, agotamientos y vencimientos.
- Análisis de ventas, inventario, clientes, precios y promociones.
- Administración de usuarios, pertenencias, roles y auditorías.

## Necesidad de una solución móvil y web

La aplicación móvil responde a actividades realizadas cerca del producto, almacén o punto de venta:
escanear, capturar, consultar y registrar. La plataforma web responde a actividades que requieren una
vista más amplia: configurar, revisar históricos, comparar información y preparar decisiones o
reportes. Ambas superficies deben aplicar las mismas reglas autoritativas mediante el backend.

La investigación debe confirmar disponibilidad de dispositivos, conectividad, alfabetización digital
y preferencias de los usuarios antes de cerrar el diseño de interacción.

## Diferencia frente a un sistema para una sola tienda

El sistema propuesto comparte infraestructura entre diferentes bodegas, pero cada bodega conserva un
espacio lógico aislado. Toda entidad de negocio debe asociarse con un tenant; los permisos dependen
de la pertenencia de la persona a ese tenant; y el backend valida dicha pertenencia en cada operación
protegida. Configuraciones como stock mínimo, alertas o descuentos no son constantes globales.

Una validación inicial con una sola bodega no permite omitir estos límites. Suscripciones, planes,
pagos y múltiples sucursales no forman parte del MVP.

## Planteamiento inicial del problema general

¿Cómo proporcionar a bodegas familiares de la región de Ayacucho una plataforma móvil y web que
integre ventas, inventario por lotes, vencimientos, clientes y reposición, sea comprensible para sus
usuarios y mantenga aislamiento, seguridad y trazabilidad entre múltiples bodegas desde la primera
versión?

## Problemas específicos iniciales

1. ¿Cómo registrar productos y lotes con el menor esfuerzo sin aceptar datos OCR no confirmados?
2. ¿Cómo mantener stock coherente cuando una venta y su descuento de inventario son inseparables?
3. ¿Cómo priorizar lotes por FEFO y tratar productos sin fecha de vencimiento?
4. ¿Cómo definir roles flexibles cuando una persona cumple varias funciones?
5. ¿Cómo impedir el acceso a información de otra bodega en cada operación protegida?
6. ¿Cómo registrar auditoría suficiente sin dificultar la operación cotidiana?
7. ¿Cómo definir alertas, descuentos y configuraciones adaptables por bodega?
8. ¿Cómo limitar los datos de clientes a finalidades necesarias y autorizadas?
9. ¿Cómo ofrecer recomendaciones útiles basadas en reglas sin incorporar machine learning al MVP?
10. ¿Cómo representar modalidades distintas de compra, inventario y venta sin inventar conversiones?
11. ¿Cómo controlar un recipiente o atado no medido y calcular su margen al cierre?
12. ¿Cómo registrar una transformación básica sin convertirla en producción industrial?

## Conceptos operativos diferenciados

- **Unidad de compra**: forma en que ingresa el producto, como caja, costal, jaba, bolsa, atado o
  kilogramo.
- **Unidad base de inventario**: unidad contable real disponible, como unidad o kilogramo, cuando es
  medible; no se fuerza para productos sin medición exacta.
- **Modalidad de venta**: unidad, peso o importe.
- **Forma de control del stock**: conteo exacto, peso exacto ingresado manualmente, equivalencia
  estimada por lote o estado aproximado.
- **Presentación comercial**: combinación diferenciable de marca y presentación.
- **Lote de compra**: ingreso identificable con su costo y cantidad aprovechable conocida o estado
  aproximado.
- **Lote transformado**: resultado de una preparación básica vinculada con su origen y costo.
- **Venta por importe**: registro monetario de una porción visual no medida; no es un descuento.
- **Cierre de lote**: momento en que un lote se declara agotado, descartado o cerrado y permite
  determinar su margen definitivo.
- **Merma y deterioro**: pérdidas registradas y auditables que explican diferencias o cierre.

## Delimitación de la inteligencia del MVP

BodegIA no tendrá en el MVP un modelo predictivo propio entrenado con datos de ventas. La captura de
fechas empleará OCR preentrenado y exigirá confirmación o corrección humana antes de guardar el dato.
Las recomendaciones de promociones, precios y reposición serán determinísticas, explicables y
basadas en reglas. El sistema registrará de forma estructurada ventas, inventario, precios,
promociones y vencimientos como base para evaluar una etapa predictiva posterior.

Quedan fuera del MVP obligatorio la predicción de demanda y reposición, las recomendaciones
aprendidas de precios y promociones, la detección de operaciones anómalas mediante machine learning
y el entrenamiento con información histórica de cada bodega. Cualquier evolución futura deberá
respetar el aislamiento multi-tenant, la privacidad y la autorización para usar los datos.
10. ¿Cómo medir el resultado del MVP sin inventar una línea base ni metas no validadas?
