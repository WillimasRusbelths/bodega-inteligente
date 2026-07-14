# Stakeholders y actores

## Modelo de roles y pertenencias

Una misma persona puede asumir varios roles dentro de una bodega. Los permisos no son atributos
globales de la persona: dependen de su pertenencia a cada tenant. Una persona podría, por ejemplo,
ser propietaria y vendedora en una bodega y no tener acceso a ninguna otra. Todo acceso protegido
debe ser autorizado por el backend a partir de la pertenencia activa y sus permisos.

Los niveles de prioridad son iniciales y deben validarse con los participantes del piloto.

## Participantes de la validación piloto

La validación inicial de BodegIA se realizará en una bodega familiar propiedad del investigador y
contará con cuatro usuarios internos que trabajan en la bodega y diez clientes voluntarios, catorce
participantes en total. La distribución exacta de roles entre los cuatro usuarios internos no está
confirmada y no debe inferirse de los actores descritos a continuación. Este grupo corresponde a una
validación piloto y no constituye una muestra estadística de todas las bodegas de Ayacucho. El
nombre comercial de la bodega puede mantenerse anonimizado y el distrito sigue pendiente. La
dirección exacta no se solicitará ni publicará; la ubicación exacta solo podrá conservarse
privadamente cuando sea indispensable para la investigación.

## Propietario administrador

- **Descripción**: Responsable principal de la administración y configuración de una bodega.
- **Objetivos**: Mantener control operativo, proteger el negocio y tomar decisiones informadas.
- **Responsabilidades**: Configurar la bodega, administrar pertenencias y revisar información crítica.
- **Operaciones principales**: Gestionar usuarios, permisos, configuración, catálogo, descuentos,
  reportes, auditorías y anulaciones autorizadas; también puede vender.
- **Información consultable**: Información operativa, comercial y auditada de su propia bodega,
  limitada por necesidad funcional y privacidad.
- **Restricciones**: Sin acceso a otros tenants; acciones sensibles sujetas a mínimo privilegio,
  confirmación y auditoría; no administra infraestructura global.
- **Prioridad inicial**: Crítica.

## Propietario vendedor

- **Descripción**: Propietario que participa directamente en la atención y las ventas.
- **Objetivos**: Completar ventas con rapidez y mantener el inventario consistente.
- **Responsabilidades**: Registrar ventas correctamente, identificar productos y respetar reglas de
  descuento, lotes y clientes.
- **Operaciones principales**: Buscar o escanear productos, seleccionar cantidades, asociar cliente
  cuando corresponda, aplicar descuentos autorizados, cobrar y emitir ticket interno.
- **Información consultable**: Catálogo, precios, stock operativo, clientes necesarios para la venta
  y sus propias operaciones; vistas administrativas solo si posee permisos adicionales.
- **Restricciones**: Sin acceso cruzado; no modifica controles críticos por el solo hecho de vender.
- **Prioridad inicial**: Crítica.

## Empleado vendedor

- **Descripción**: Persona autorizada para atender ventas sin facultades administrativas implícitas.
- **Objetivos**: Registrar ventas claras y ágiles con información suficiente.
- **Responsabilidades**: Identificarse, respetar precios y permisos, y reportar incidencias.
- **Operaciones principales**: Escanear, vender, consultar disponibilidad, registrar cliente mínimo y
  emitir ticket; seleccionar venta por unidad, registrar peso manual o ingresar un importe; usar
  productos frecuentes o botones rápidos; solicitar autorización para operaciones restringidas.
- **Información consultable**: Datos de productos, stock y clientes estrictamente necesarios para su
  función, dentro de la bodega asignada.
- **Restricciones**: Descuentos, anulaciones, cambios de precio y reportes dependen de permisos; no
  administra usuarios ni configuración por defecto.
- **Prioridad inicial**: Alta.

## Responsable de inventario

- **Descripción**: Persona encargada del ingreso, control y regularización de existencias.
- **Objetivos**: Mantener inventario, lotes y vencimientos completos y confiables.
- **Responsabilidades**: Registrar recepciones y ajustes, confirmar OCR y revisar alertas.
- **Operaciones principales**: Gestionar productos, códigos, categorías, lotes, costos, proveedores,
  entradas, cantidades aprovechables, conversiones estimadas, transformaciones básicas, ajustes,
  conteos, estados aproximados, mermas, cierres y vencimientos.
- **Información consultable**: Catálogo, existencias, movimientos, lotes, alertas y proveedores de su
  tenant; costos según autorización.
- **Restricciones**: Ajustes y pérdidas son auditados; el OCR exige confirmación; no elimina historia.
- **Criterio de registro**: Solo consigna cantidades medidas o contadas. En recipientes y atados no
  medidos actualiza un estado aproximado sin inventar peso, volumen ni porciones.
- **Prioridad inicial**: Crítica.

## Cliente de la bodega

- **Descripción**: Persona que compra productos y puede autorizar el uso limitado de sus datos.
- **Objetivos**: Recibir atención correcta, ticket comprensible y protección de su información.
- **Responsabilidades**: Proporcionar los datos necesarios cuando decida identificarse, decidir por
  separado si consiente promociones o comunicaciones y revisar su compra.
- **Operaciones principales**: Comprar como cliente identificado o como «Cliente general» y recibir
  ticket interno.
- **Información consultable**: Su ticket o información que la bodega esté autorizada a entregarle; el
  MVP no incluye una aplicación pública para consumidores.
- **Restricciones**: No accede al sistema interno ni a información de otros clientes.
- **Prioridad inicial**: Alta como beneficiario; no es usuario autenticado del MVP.

Para un cliente identificado son obligatorios el código interno generado por el sistema, el nombre
completo, el número de teléfono y la fecha de registro generada por el sistema. Durante el MVP no se
recopilan DNI, dirección domiciliaria, fecha de nacimiento ni correo electrónico. El consentimiento
para promociones o comunicaciones se registra de manera explícita, separada y auditable. Las ventas
a «Cliente general» no participan en rankings, fidelización ni análisis individual de clientes.

## Proveedor

- **Descripción**: Organización o persona que abastece productos a una bodega.
- **Objetivos**: Recibir pedidos claros y mantener una relación comercial consistente.
- **Responsabilidades**: Proporcionar información de productos, lotes, costos y entrega cuando aplique.
- **Operaciones principales**: Interactuar fuera del sistema con pedidos generados o consultados por
  usuarios autorizados; no se asume un portal de proveedor en el MVP.
- **Información consultable**: Ninguna directamente en el MVP, salvo documentos que la bodega decida
  compartir por canales autorizados.
- **Restricciones**: Sin cuenta ni acceso interno por defecto; sus datos pertenecen a cada tenant.
- **Prioridad inicial**: Media.

## Administrador técnico de la plataforma

- **Descripción**: Responsable autorizado de operación, soporte y seguridad de la plataforma común.
- **Objetivos**: Mantener disponibilidad, seguridad y capacidad de diagnóstico sin invadir datos.
- **Responsabilidades**: Supervisar ambientes, incidentes, respaldos y controles técnicos aprobados.
- **Operaciones principales**: Acceder a telemetría y herramientas operativas; ejecutar acciones
  sensibles solo mediante procedimientos autorizados y auditados.
- **Información consultable**: Metadatos técnicos mínimos. El acceso a datos de negocio o clientes
  requiere necesidad, autorización, temporalidad y auditoría aún por definir.
- **Restricciones**: No actúa como propietario; mínimo privilegio; sin cambios productivos destructivos
  ni acceso general a tenants por defecto.
- **Prioridad inicial**: Alta para seguridad y operación; su alcance funcional requiere decisión.

## Investigador o desarrollador

- **Descripción**: Persona que investiga necesidades, diseña, implementa o valida la solución.
- **Objetivos**: Producir evidencia y software conforme a especificaciones y constitución.
- **Responsabilidades**: Documentar supuestos, proteger datos, mantener trazabilidad y probar cambios.
- **Operaciones principales**: Entrevistar con consentimiento, analizar información autorizada,
  trabajar en ambientes no productivos y preparar cambios para revisión.
- **Información consultable**: Datos sintéticos, anonimizados o expresamente autorizados; documentos y
  evidencias necesarias para su trabajo.
- **Restricciones**: Sin secretos reales, despliegues o migraciones productivas no aprobadas, acceso
  cruzado, eliminación real ni fusión directa a `main`.
- **Prioridad inicial**: Alta durante investigación y desarrollo.
