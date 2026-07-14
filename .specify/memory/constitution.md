<!--
Sync Impact Report
- Version change: template (unratified) -> 1.0.0
- Modified principles: none; initial adoption of principles I-XXV
- Added sections: Technology and Architectural Constraints; Development Workflow and Quality Gates
- Removed sections: none; template placeholders were replaced
- Templates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ reviewed: .specify/templates/constitution-template.md (generic bootstrap template retained)
- Runtime/agent guidance: ✅ reviewed; no project runtime guidance exists yet and no stale
  agent-specific references require changes
- Follow-up TODOs: none
-->
# Plataforma Multi-Bodega Inteligente Constitution

## Core Principles

### I. Especificaciones como Fuente de Verdad
Toda funcionalidad MUST comenzar con una especificación aprobada que describa historias de usuario,
criterios de aceptación, requisitos y alcance. Ninguna funcionalidad puede implementarse basándose
solo en una instrucción informal. La especificación aprobada prevalece sobre conversaciones,
prototipos o supuestos no documentados.

### II. Trazabilidad Completa
Cada requisito MUST tener un identificador estable y relacionarse con al menos una historia de
usuario, criterios de aceptación, tareas técnicas, cambios de código y casos de prueba. Los planes,
tareas y revisiones MUST conservar estas referencias para permitir reconstruir qué se solicitó,
por qué se implementó y cómo se validó.

### III. Arquitectura Desacoplada
Las aplicaciones móvil y web MUST consumir las reglas de negocio y los datos críticos únicamente a
través del backend y su API REST. No MUST acceder directamente a tablas críticas ni duplicar reglas
de negocio autoritativas. Los contratos REST MUST documentarse con OpenAPI y versionarse cuando un
cambio pueda afectar consumidores.

### IV. Seguridad por Diseño
Toda entrada MUST validarse en el cliente para usabilidad y nuevamente en el servidor como control
autoritativo. El sistema MUST aplicar autenticación, autorización basada en roles y mínimo
privilegio. Contraseñas, tokens, claves y credenciales reales MUST permanecer fuera del repositorio.
Cada especificación y plan MUST identificar datos sensibles, amenazas relevantes y controles.

### V. Integridad Transaccional
Ventas, inventario, lotes y movimientos de stock relacionados MUST ejecutarse con límites
transaccionales explícitos. Una venta MUST revertirse completamente si falla el descuento de
inventario o cualquier actualización indispensable. Las especificaciones MUST definir condiciones
de concurrencia, reintento, idempotencia o compensación cuando sean relevantes.

### VI. Auditoría Obligatoria
Todo movimiento de stock, cambio de precio, anulación, descuento, venta y modificación relevante
MUST producir un registro de auditoría inmutable que incluya usuario responsable, fecha y hora,
tipo de operación y valores anterior y nuevo cuando correspondan. También MUST registrar dispositivo
o sesión cuando sea técnicamente posible. Las fallas de auditoría MUST tratarse de forma explícita y
no pueden ocultar una operación parcialmente registrada.

### VII. Gestión de Inventario por Lotes
Los vencimientos MUST asociarse a lotes y nunca modelarse como una única fecha del producto. Las
salidas MUST aplicar FEFO cuando existan lotes con distintas fechas de vencimiento, salvo excepción
de negocio aprobada y auditada. Ajustes, pérdidas y anulaciones MUST conservar la referencia al lote.

### VIII. Migraciones Versionadas
Todo cambio de estructura de PostgreSQL MUST realizarse mediante una migración Prisma versionada,
revisable y reproducible. Ningún agente ni automatización puede eliminar tablas, columnas o datos de
producción sin aprobación humana expresa. Los cambios destructivos MUST incluir respaldo, plan de
reversión y evidencia de ensayo fuera de producción.

### IX. Borrado Lógico y Conservación Histórica
Ventas, movimientos de inventario, lotes y auditorías MUST conservarse físicamente. Cuando una
entidad deba dejar de estar activa, MUST utilizarse borrado lógico o un estado de ciclo de vida que
preserve relaciones y trazabilidad. Cualquier excepción legal de eliminación MUST documentarse,
autorizarse y auditarse.

### X. Calidad y Pruebas Automatizadas
Las reglas críticas de negocio MUST tener pruebas unitarias; los endpoints MUST tener pruebas de
integración; y los flujos principales MUST tener pruebas de sistema en la superficie correspondiente.
Las pruebas de regresión existentes MUST pasar antes de integrar cambios. Los objetivos de
rendimiento relevantes MUST validarse con k6. Una omisión de pruebas MUST justificarse y aprobarse
en la especificación o revisión.

### XI. Desarrollo Seguro con Agentes
Codex puede analizar, proponer, crear código y ejecutar pruebas en ambientes autorizados. Sin
aprobación humana expresa, MUST NOT desplegar a producción, ejecutar migraciones de producción,
modificar secretos reales, eliminar información real ni fusionar cambios directamente a `main`.
Las acciones de alto impacto MUST detenerse y solicitar autorización verificable.

### XII. Control de Versiones
Cada especificación funcional MUST desarrollarse en una rama independiente. Todo cambio MUST pasar
por revisión antes de fusionarse y la rama `main` MUST mantenerse estable. Los commits y pull
requests SHOULD conservar referencias a los requisitos y tareas que satisfacen.

### XIII. Tipado Estricto y Mantenibilidad
Todo código de producto MUST escribirse en TypeScript con modo estricto. Los tipos `any` MUST evitarse
salvo justificación localizada. La revisión MUST rechazar duplicación evitable, funciones
excesivamente grandes, responsabilidades mezcladas y acoplamiento innecesario. Las interfaces entre
aplicaciones y paquetes MUST ser explícitas y documentadas.

### XIV. Experiencia de Usuario
La experiencia MUST diseñarse mobile-first, con interfaces claras, lenguaje comprensible, estados
de carga, vacío y error definidos, y flujos apropiados para personas con poca experiencia
tecnológica. Las historias de usuario MUST incluir criterios verificables de accesibilidad y
recuperación cuando correspondan.

### XV. Confirmación Humana del OCR
Una fecha obtenida mediante cámara u OCR MUST mostrarse al usuario antes de persistirse. El usuario
MUST poder confirmarla o corregirla, y el sistema MUST conservar el valor confirmado como dato
autoritativo. La confianza del OCR nunca sustituye esta confirmación.

### XVI. Privacidad de Clientes
Solo MUST recopilarse información necesaria para ventas, fidelización o contacto autorizado. Los
datos de clientes MUST limitarse por finalidad, acceso y exposición; reportes e interfaces MUST
ocultar información que no sea funcionalmente necesaria. La especificación MUST indicar propósito,
visibilidad y conservación de cada dato personal nuevo.

### XVII. Separación de Ambientes
Desarrollo, pruebas y producción MUST usar ambientes, credenciales y datos independientes. Las
pruebas automatizadas MUST NOT ejecutarse contra la base de datos real de producción. La promoción
entre ambientes MUST ser explícita, reproducible y sujeta a los controles de aprobación aplicables.

### XVIII. Documentación Continua
Especificaciones, arquitectura, modelo de datos, contratos OpenAPI, decisiones técnicas, pruebas y
evidencias MUST actualizarse durante el desarrollo. Un cambio no está listo para revisión si la
documentación afectada permanece desactualizada.

### XIX. Definición de Terminado
Una funcionalidad solo está terminada cuando cumple sus criterios de aceptación, su código está
implementado, todas las pruebas aplicables pasan, no introduce regresiones conocidas, actualiza su
documentación, conserva evidencias suficientes y ha sido revisada antes de fusionarse. Todos estos
controles MUST constar en tareas o en la revisión.

### XX. Evolución Controlada
La arquitectura MUST permitir incorporar posteriormente productos por peso, alimentos frescos,
balanzas, boleta electrónica, modo offline, nuevos reportes y modelos de recomendación. Esta
extensibilidad MUST lograrse mediante límites claros, sin implementar anticipadamente capacidades
fuera de una especificación aprobada.

### XXI. Arquitectura Multi-Tenant
La plataforma MUST soportar múltiples bodegas desde la primera versión. Toda entidad perteneciente
a una bodega MUST incluir una asociación inequívoca con su tenant o bodega; sus índices, consultas,
restricciones y contratos MUST preservar ese límite. La validación inicial en una sola bodega piloto
no permite diseños estructuralmente mono-tenant.

### XXII. Aislamiento de Información
Un usuario MUST NOT consultar, modificar ni eliminar información de una bodega a la que no pertenece.
El backend MUST obtener o validar el tenant autorizado en cada operación protegida y MUST NOT confiar
únicamente en el identificador enviado por el cliente. Las pruebas MUST incluir intentos de acceso
cruzado entre tenants.

### XXIII. Roles por Pertenencia
Los permisos MUST derivarse de la relación entre la persona y la bodega, no solo de una propiedad
global del usuario. Una persona MAY tener roles distintos en bodegas diferentes. Un propietario MAY
combinar funciones administrativas y operativas, incluidas ventas, siempre sujeto al mínimo
privilegio y a la auditoría.

### XXIV. Configuración Independiente
Cada bodega MUST poder definir, según alcance aprobado, stock mínimo, margen, días de alerta,
permisos de descuento, datos del ticket, categorías, proveedores y configuración comercial. Estas
reglas MUST estar asociadas al tenant y MUST NOT codificarse como constantes globales. Los valores
por defecto MUST ser explícitos y sustituibles por bodega.

### XXV. Escalabilidad Progresiva y Alcance del MVP
La arquitectura, API y persistencia MUST admitir nuevas bodegas aunque el MVP se valide con una sola.
Suscripciones, planes comerciales, pagos y múltiples sucursales están fuera del MVP y MUST NOT
implementarse hasta que una especificación posterior los apruebe. Las decisiones actuales MUST
evitar bloquear esas capacidades sin introducir complejidad prematura.

## Technology and Architectural Constraints

- El repositorio MUST organizarse como monorepo TypeScript para aplicación móvil React Native con
  Expo, plataforma web React con Vite y backend NestJS.
- La persistencia MUST utilizar PostgreSQL alojado en Supabase y Prisma para acceso y migraciones.
- La API MUST ser REST y mantener documentación OpenAPI sincronizada con sus contratos.
- Las pruebas MUST usar Jest o Vitest para unidades, Supertest para integración, Playwright para
  sistema web, Maestro para sistema móvil y k6 para rendimiento.
- La integración continua MUST ejecutarse con GitHub Actions y bloquear integración cuando fallen
  los controles obligatorios.
- Visual Studio Code, Git, GitHub, GitHub Spec Kit y OpenAI Codex constituyen las herramientas
  aprobadas. Sustituciones que cambien arquitectura, seguridad o flujo MUST aprobarse mediante una
  enmienda o una decisión técnica explícita compatible con esta constitución.

## Development Workflow and Quality Gates

1. La secuencia obligatoria es especificar, aclarar, planificar, generar checklist y tareas,
   analizar consistencia, implementar, probar, documentar y revisar.
2. Toda especificación MUST declarar alcance y exclusiones, tenant afectado, actores y pertenencias,
   datos personales, reglas transaccionales, auditoría, casos negativos y resultados medibles.
3. Todo plan MUST superar el Constitution Check antes de investigación y después del diseño. Una
   violación no justificable bloquea las tareas y la implementación.
4. Las tareas MUST conservar trazabilidad con historias y requisitos, incluir pruebas obligatorias,
   documentación, evidencias y controles de aislamiento multi-tenant pertinentes.
5. La revisión MUST verificar límites de tenant, autorización del backend, transacciones, auditoría,
   migraciones, privacidad, tipado estricto y separación de ambientes.
6. La integración a `main` MUST requerir revisión humana y CI satisfactoria. Despliegues y cambios
   productivos MUST requerir además aprobación humana explícita.

## Governance

Esta constitución prevalece sobre planes, prácticas, instrucciones informales y decisiones técnicas
incompatibles. Toda enmienda MUST documentar motivación, impacto, migración de artefactos y aprobación
humana antes de entrar en vigor.

El versionado sigue SemVer: MAJOR para eliminar o redefinir de forma incompatible un principio o una
regla de gobernanza; MINOR para agregar principios, secciones o exigencias materiales; PATCH para
aclaraciones sin cambio normativo. La fecha de última enmienda MUST actualizarse con cada cambio.

Cada especificación, plan, lista de tareas y pull request MUST demostrar cumplimiento. El
Constitution Check y la revisión humana actúan como puertas de calidad; las excepciones MUST ser
temporales, explícitas, justificadas y acompañadas de un plan de corrección. La constitución MUST
revisarse al menos en cada cambio arquitectónico material y antes de ampliar el MVP a nuevas
capacidades comerciales.

**Version**: 1.0.0 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
