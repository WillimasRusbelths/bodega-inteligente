# Roadmap evolutivo

## Criterio de evolución

BodegIA incorpora primero las modalidades reales observadas en la bodega piloto, manteniendo
aislamiento multi-tenant, trazabilidad y registro fiel de lo medido. Ninguna fase debe convertir una
estimación visual en peso, volumen o cantidad exacta.

## MVP obligatorio

- Venta por unidad, peso ingresado manualmente e importe.
- Cantidades decimales y precisión pendiente de validación.
- Variantes por marca y presentación comercial.
- Unidad de compra separada de la unidad base de inventario y modalidad de venta.
- Cantidad aprovechable real y conversiones estimadas por lote.
- Control aproximado de recipientes, bolsas y atados no medidos.
- Transformación básica con origen, consumo, costo atribuido, resultado, fecha y responsable.
- Mermas, deterioros, descartes y cierres de lote.
- Código interno, búsqueda por nombre, productos frecuentes y botones rápidos.
- Margen exacto para productos contados o pesados; estimado para lotes no medidos abiertos y
  definitivo al cierre.

## Evolución posterior al MVP

- Integración automática con balanzas electrónicas.
- Medición automática de porciones.
- Impresión de etiquetas para productos sin código comercial.
- Producción industrial y fórmulas de elaboración avanzadas.
- Trazabilidad sanitaria avanzada.
- Predicción de mermas mediante machine learning.
- Capacidades predictivas aprobadas conforme a PA-033.

### Experiencia futura para consumidores

Fuera del MVP actual se conserva una evolución orientada a consumidores que podrá incluir:

- Consulta de bodegas disponibles.
- Catálogo público únicamente con la información autorizada por cada bodega.
- Consulta de productos visibles y sus estados de disponibilidad.
- Cuenta global de consumidor separada del cliente interno registrado por una bodega. Esta cuenta
  no concede acceso a información privada, operaciones ni datos internos de ningún tenant.
- Recomendaciones de desayuno, almuerzo y cena utilizando productos disponibles en la bodega que el
  consumidor seleccione.
- Recomendaciones iniciales basadas en recetas y reglas explícitas.
- Personalización e inteligencia artificial en fases posteriores, sujeta a especificación,
  privacidad, consentimiento y aislamiento multi-tenant.

Estas capacidades no forman parte del MVP vigente y no deben implementarse anticipadamente.

Las capacidades futuras requieren especificación y aprobación propias. El uso de historial para
modelos debe respetar privacidad, autorización y aislamiento entre bodegas; los datos de un tenant
no pueden emplearse para otro sin una base autorizada y documentada.
