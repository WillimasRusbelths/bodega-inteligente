# Feature Specification: Base multi-bodega, identidad y acceso

**Feature Branch**: `No creada: no existe hook before_specify configurado`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Base multi-bodega, autenticación, pertenencias, roles y permisos"

## Clarifications

### Session 2026-07-15

- Q: ¿Qué mecanismo se usará para la autenticación y activación inicial de trabajadores? → A: Teléfono y código o QR temporal entregado presencialmente, sin SMS ni correo.
- Q: ¿Qué permisos componen cada rol inicial y cómo pueden combinarse? → A: Matriz fija de mínimo privilegio con roles combinables; solo el propietario concede roles.
- Q: ¿Qué regla impide que una bodega quede sin propietario administrador activo? → A: Bloquear la operación hasta designar otro propietario activo.
- Q: ¿Qué políticas regirán sesiones, bloqueo y recuperación? → A: PIN de 6 dígitos o biometría; sesión de 8 horas, bloqueo tras 30 minutos, espera de 15 minutos después de 5 fallos y reactivación presencial.
- Q: ¿Cuándo puede acceder temporalmente el administrador técnico? → A: Solo con aprobación del propietario, por hasta 1 hora, alcance limitado y auditoría completa.

## User Scenarios & Testing *(mandatory)*

### HU-001 — Crear una bodega controladamente (Priority: P1)

Como administrador técnico de BodegIA, quiero registrar una bodega y vincular a su primer propietario
administrador para habilitar un tenant sin registro público automático ni acceso a información
comercial privada.

**Why this priority**: Sin una bodega y una primera pertenencia administrativa no existe un contexto
autorizado donde incorporar miembros o asignar responsabilidades.

**Independent Test**: Puede probarse creando una bodega con su primer propietario, verificando que
ambos quedan activos, auditados y aislados de otra bodega ya existente.

**Acceptance Scenarios**:

1. **Given** un administrador técnico autorizado y una identidad válida para el primer propietario,
   **When** registra la nueva bodega, **Then** se crean el tenant y su primera pertenencia de
   propietario administrador como una operación íntegra y auditada.
2. **Given** una persona ya registrada, **When** el administrador técnico la vincula como primer
   propietario de una nueva bodega, **Then** se reutiliza su identidad sin otorgarle permisos globales
   ni acceso a otras bodegas.
3. **Given** una bodega activa, **When** el administrador técnico consulta su cuenta, **Then** solo ve
   información técnica mínima y no ventas, clientes, costos, inventario ni otros datos comerciales.

---

### HU-002 — Iniciar y cerrar sesión (Priority: P1)

Como miembro de una bodega, quiero autenticarme y cerrar mi sesión para acceder únicamente a
funciones permitidas mientras mi cuenta, bodega y pertenencia estén activas.

**Why this priority**: Toda operación protegida depende de conocer la identidad y mantener una sesión
válida sin aceptar cuentas desactivadas.

**Independent Test**: Puede probarse con credenciales válidas e inválidas, cuenta activa y
desactivada, sesión vigente y expirada, verificando acceso, rechazo y auditoría.

**Acceptance Scenarios**:

1. **Given** una cuenta activa con al menos una pertenencia activa en una bodega activa, **When** la
   persona presenta credenciales válidas, **Then** inicia una sesión sin recibir permisos superiores a
   sus pertenencias.
2. **Given** credenciales inválidas, una cuenta desactivada o una bodega desactivada, **When** se
   intenta iniciar o continuar una sesión, **Then** se rechaza el acceso con un mensaje que no revela
   información sensible y se registra el evento conforme a la política aprobada.
3. **Given** una sesión vigente, **When** el usuario cierra sesión o la sesión expira, **Then** deja de
   autorizar operaciones protegidas y el resultado queda auditado cuando corresponde.

---

### HU-003 — Seleccionar la bodega activa (Priority: P1)

Como usuario perteneciente a varias bodegas, quiero seleccionar y cambiar el contexto activo para
operar exclusivamente con los roles y permisos de la pertenencia elegida.

**Why this priority**: La separación de contexto evita heredar permisos o datos entre tenants.

**Independent Test**: Puede probarse con una cuenta que tenga roles diferentes en dos bodegas,
cambiando de contexto y verificando que permisos, consultas y acciones se recalculan completamente.

**Acceptance Scenarios**:

1. **Given** una cuenta con una única pertenencia activa, **When** inicia sesión, **Then** puede entrar
   a ese único contexto autorizado sin obtener acceso a otro tenant.
2. **Given** una cuenta con varias pertenencias activas, **When** inicia sesión, **Then** debe elegir
   una bodega antes de realizar operaciones dependientes del tenant.
3. **Given** un contexto activo en la Bodega A, **When** selecciona una pertenencia activa en la Bodega
   B, **Then** se reemplazan completamente tenant, roles y permisos y dejan de ser utilizables los del
   contexto anterior.

---

### HU-004 — Incorporar un trabajador (Priority: P1)

Como propietario administrador, quiero incorporar un trabajador a mi bodega y asignarle funciones
autorizadas para que pueda trabajar sin adquirir acceso global ni pertenencia a otra bodega.

**Why this priority**: Permite delegar la operación manteniendo mínimo privilegio y aislamiento.

**Independent Test**: Puede probarse incorporando una persona a una bodega, asignándole un rol y
verificando que no aparece como miembro ni obtiene acceso en otro tenant.

**Acceptance Scenarios**:

1. **Given** un propietario administrador en su bodega activa, **When** incorpora una persona y le
   asigna al menos un rol permitido, **Then** se crea una pertenencia trazable solo en esa bodega.
2. **Given** un vendedor o responsable de inventario sin permiso administrativo, **When** intenta
   incorporar un miembro, **Then** la operación se rechaza y no se crea pertenencia alguna.

---

### HU-005 — Gestionar roles de una pertenencia (Priority: P1)

Como propietario administrador, quiero consultar y modificar los roles de un miembro de mi bodega
para mantener sus responsabilidades actualizadas.

**Why this priority**: Los permisos deben derivarse de la pertenencia y cambiar conforme a las
responsabilidades reales, sin atributos globales del usuario.

**Independent Test**: Puede probarse cambiando a una persona de vendedor a una combinación autorizada
y verificando el nuevo acceso en esa bodega y la ausencia de cambios en sus otras pertenencias.

**Acceptance Scenarios**:

1. **Given** un miembro activo de la bodega seleccionada, **When** el propietario administrador cambia
   sus roles, **Then** los nuevos permisos se aplican solo a esa pertenencia y el cambio queda auditado.
2. **Given** dos propietarios que intentan cambiar simultáneamente la misma pertenencia, **When** se
   detecta un estado desactualizado, **Then** no se pierde silenciosamente ningún cambio y uno de los
   actores debe revisar el estado vigente antes de confirmar.
3. **Given** un miembro de otra bodega, **When** el propietario intenta modificarlo usando su
   identificador, **Then** la operación se rechaza sin revelar información privada del otro tenant.

---

### HU-006 — Desactivar o reactivar una pertenencia (Priority: P1)

Como propietario administrador, quiero desactivar el acceso de un trabajador y reactivarlo cuando
esté permitido, sin eliminar su actividad histórica.

**Why this priority**: Retirar acceso oportunamente es un control de seguridad y la conservación
histórica es obligatoria para trazabilidad.

**Independent Test**: Puede probarse desactivando una pertenencia durante una sesión activa,
verificando el rechazo inmediato de nuevas operaciones, la conservación de auditorías y una
reactivación posterior autorizada.

**Acceptance Scenarios**:

1. **Given** una pertenencia activa, **When** el propietario registra un motivo y la desactiva,
   **Then** deja de autorizar nuevas operaciones y se conserva toda su historia.
2. **Given** una sesión iniciada cuya pertenencia acaba de ser desactivada, **When** intenta una nueva
   operación protegida, **Then** se rechaza aunque la sesión aún no haya expirado.
3. **Given** una pertenencia desactivada elegible para reactivación, **When** un propietario autorizado
   la reactiva, **Then** recupera únicamente los roles vigentes registrados para esa pertenencia y el
   cambio queda auditado.

---

### HU-007 — Impedir acceso cruzado entre bodegas (Priority: P1)

Como propietario, quiero que una persona válida de otra bodega no pueda consultar, modificar ni
administrar información de mi establecimiento.

**Why this priority**: El aislamiento multi-tenant es una condición constitucional y de confianza, no
una mejora opcional.

**Independent Test**: Puede probarse intentando leer y modificar recursos de la Bodega B con una
sesión autorizada únicamente para la Bodega A, incluyendo identificadores manipulados.

**Acceptance Scenarios**:

1. **Given** un usuario válido de la Bodega A sin pertenencia activa en la Bodega B, **When** envía
   manualmente un identificador de la Bodega B, **Then** toda lectura o modificación se rechaza sin
   revelar si el recurso existe.
2. **Given** una persona con pertenencias en A y B pero con A como contexto activo, **When** intenta
   usar permisos de B sin cambiar el contexto, **Then** la operación se rechaza.
3. **Given** un intento relevante de acceso cruzado, **When** se produce el rechazo, **Then** queda un
   evento auditable con información suficiente para investigación autorizada.

---

### HU-008 — Auditar cambios de acceso (Priority: P2)

Como propietario administrador, quiero consultar eventos autorizados de membresía y permisos de mi
bodega para saber quién realizó cada cambio y cuál fue su resultado.

**Why this priority**: La auditoría permite explicar y revisar cambios de acceso, aunque la protección
preventiva de los flujos P1 debe existir primero.

**Independent Test**: Puede probarse ejecutando altas, cambios y desactivaciones y comprobando que el
propietario solo consulta los eventos autorizados de su bodega con datos anteriores y nuevos.

**Acceptance Scenarios**:

1. **Given** cambios de miembros y roles en una bodega, **When** un propietario autorizado consulta la
   auditoría, **Then** ve actor, evento, fecha, resultado, motivo aplicable y valores anterior y nuevo.
2. **Given** auditorías pertenecientes a otra bodega, **When** el propietario intenta consultarlas,
   **Then** se rechaza el acceso sin exponer su contenido.
3. **Given** una acción técnica relevante, **When** se completa o falla, **Then** se registra con el
   alcance mínimo necesario y sin otorgar al administrador técnico acceso comercial por defecto.

### Edge Cases

- Credenciales incorrectas o cuenta desactivada no permiten iniciar sesión.
- Una bodega desactivada bloquea nuevas operaciones de sus pertenencias sin borrar historia.
- Un usuario sin pertenencias activas puede autenticarse solo hasta recibir una respuesta segura de
  que no dispone de contexto operativo; no puede seleccionar tenant ni ejecutar operaciones.
- Una persona con una única pertenencia desactivada no recibe acceso por tener una identidad válida.
- La desactivación de la única pertenencia de una persona conserva la cuenta y actividad histórica.
- La desactivación, retiro o cambio de rol del último propietario administrador activo se rechaza
  hasta que exista otro propietario administrador activo en la bodega.
- Un vendedor o responsable de inventario que intenta administrar miembros o roles es rechazado.
- Un propietario no puede administrar miembros de otra bodega mediante identificadores manipulados.
- Cambios simultáneos de roles no pueden sobrescribirse silenciosamente.
- Una sesión expirada no autoriza operaciones y exige una nueva autenticación conforme a la política.
- Una pertenencia desactivada durante una sesión activa invalida nuevas operaciones inmediatamente.
- Cinco intentos incorrectos consecutivos de PIN bloquean el acceso del perfil durante 15 minutos sin
  revelar información adicional sobre la cuenta.
- La pérdida o cambio de celular exige revocar el dispositivo anterior antes de activar el nuevo con
  un código único o QR temporal entregado presencialmente por el propietario.
- El acceso temporal de soporte expira al cumplirse una hora o al cerrarse el caso, lo que ocurra
  primero, y no concede por defecto acceso a información comercial.
- Los mensajes de denegación no confirman la existencia de bodegas, cuentas, pertenencias o recursos
  ajenos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir únicamente a un administrador técnico autorizado registrar una
  bodega durante el MVP; no existirá alta pública automática. Supports HU-001, scenarios 1-3.
- **FR-002**: La creación de una bodega MUST incluir el registro o vinculación de un primer propietario
  administrador y completarse íntegramente o no producir efectos parciales. Supports HU-001, scenarios 1-2.
- **FR-003**: El administrador técnico MUST poder activar o desactivar una bodega y MUST registrar un
  motivo para la desactivación. Supports HU-001 scenario 1 and HU-002 scenario 2.
- **FR-004**: El administrador técnico MUST ver por defecto solo información técnica mínima y MUST NOT
  consultar ventas, clientes, costos, inventario u otra información comercial privada. Supports HU-001 scenario 3.
- **FR-005**: El sistema MUST permitir iniciar sesión, mantener una sesión válida y cerrar sesión, y
  MUST rechazar credenciales inválidas. Supports HU-002, scenarios 1-3.
- **FR-006**: Una cuenta desactivada MUST NOT iniciar ni continuar operaciones protegidas. Supports HU-002 scenario 2.
- **FR-007**: Una bodega desactivada MUST NOT aceptar nuevas operaciones protegidas en su contexto,
  aun cuando la cuenta y pertenencia estén activas. Supports HU-002 scenario 2.
- **FR-008**: Después de autenticar, el sistema MUST determinar las pertenencias activas disponibles
  sin conceder acceso por una pertenencia desactivada. Supports HU-003, scenarios 1-2.
- **FR-009**: Con una única pertenencia activa, el usuario MUST poder entrar únicamente a ese contexto;
  con varias, MUST seleccionar una antes de operar sobre datos de tenant. Supports HU-003, scenarios 1-2.
- **FR-010**: Cambiar de bodega activa MUST reemplazar completamente el contexto, roles y permisos
  anteriores. Supports HU-003 scenario 3.
- **FR-011**: Cada pertenencia MUST conservar bodega, persona o usuario, estado, roles o permisos,
  fecha de incorporación y usuario responsable. Supports HU-003 and HU-004.
- **FR-012**: Una desactivación de pertenencia MUST conservar fecha, motivo obligatorio y responsable,
  y MUST NOT eliminar actividad histórica. Supports HU-006, scenarios 1-3.
- **FR-013**: Los roles iniciales MUST representar propietario administrador, vendedor y responsable
  de inventario, y una persona MAY combinar funciones autorizadas dentro de una pertenencia. Supports HU-004 and HU-005.
- **FR-014**: Roles y permisos MUST pertenecer a la relación usuario-bodega y MUST NOT actuar como
  permisos globales de la cuenta. Supports HU-003 scenario 3 and HU-005 scenarios 1-3.
- **FR-015**: Un propietario administrador MUST poder incorporar, consultar, cambiar roles, desactivar
  y, cuando esté permitido, reactivar miembros únicamente de su bodega activa. Supports HU-004, HU-005 and HU-006.
- **FR-016**: Vendedores y responsables de inventario MUST NOT administrar miembros o roles salvo que
  una pertenencia les otorgue explícitamente un permiso administrativo futuro aprobado. Supports HU-004 scenario 2 and HU-005 scenario 3.
- **FR-017**: Una reactivación MUST conservar la identidad e historia previas y aplicar únicamente los
  roles vigentes de esa pertenencia. Supports HU-006 scenario 3.
- **FR-018**: Toda operación protegida MUST resolver identidad autenticada, pertenencia activa, bodega
  activa y permiso aplicable antes de consultar o cambiar datos. Supports HU-002 through HU-007.
- **FR-019**: La autorización MUST validar autoritativamente el tenant y MUST NOT confiar únicamente en
  el identificador de bodega aportado por una aplicación cliente. Supports HU-007, scenarios 1-3.
- **FR-020**: Un usuario autorizado solo en la Bodega A MUST NOT leer, modificar ni administrar
  información de la Bodega B; el rechazo MUST NOT revelar la existencia del recurso objetivo. Supports HU-007 scenarios 1-2.
- **FR-021**: Una pertenencia desactivada durante una sesión activa MUST impedir la siguiente operación
  protegida sin esperar a la expiración de sesión. Supports HU-006 scenario 2.
- **FR-022**: Cambios concurrentes sobre la misma pertenencia MUST evitar pérdida silenciosa de
  actualizaciones y MUST exigir confirmación sobre el estado vigente cuando exista conflicto. Supports HU-005 scenario 2.
- **FR-023**: El sistema MUST auditar inicio exitoso, intento fallido conforme a política, cierre de
  sesión, creación y estado de bodegas, incorporación de miembros, cambios de roles, estado de
  pertenencias, intentos entre tenants y acciones técnicas relevantes. Supports HU-001, HU-002, HU-006, HU-007 and HU-008.
- **FR-024**: Cada evento de auditoría MUST conservar actor responsable, bodega afectada cuando aplique,
  tipo, fecha y hora, resultado, valores anterior y nuevo cuando correspondan y motivo obligatorio en
  cambios sensibles. Supports HU-008 scenarios 1-3.
- **FR-025**: La auditoría MUST conservarse históricamente y MUST NOT poder alterarse o eliminarse por
  una operación administrativa ordinaria. Supports HU-006 and HU-008.
- **FR-026**: Un propietario administrador MUST consultar solo eventos de acceso y membresía
  autorizados de su bodega, sin acceso a auditorías de otro tenant. Supports HU-008 scenarios 1-2.
- **FR-027**: Los mensajes de autenticación y autorización MUST ser comprensibles y MUST NOT revelar
  cuentas, bodegas, pertenencias o recursos ajenos. Supports HU-002 scenario 2 and HU-007.
- **FR-028**: Los mismos resultados de identidad, contexto y autorización MUST aplicarse en la
  experiencia móvil y web para una misma cuenta y pertenencia. Supports HU-002 through HU-007.
- **FR-029**: La especificación y sus pruebas MUST incluir todos los casos negativos descritos en Edge
  Cases, especialmente intentos de acceso cruzado de lectura, modificación y administración. Supports HU-007.
- **FR-030**: La plataforma web administrativa MUST autenticarse mediante una solicitud de
  emparejamiento de un solo uso, expirada después de cinco minutos y confirmada con PIN o biometría
  desde un dispositivo móvil previamente activado. Antes de confirmar, la aplicación móvil MUST
  mostrar bodega, navegador, momento y alcance solicitado. El backend MUST crear una sesión WEB
  independiente, vinculada al usuario, navegador o dispositivo, pertenencia y tenant autorizados,
  con duración máxima de ocho horas, e invalidarla al revocar la cuenta, pertenencia o dispositivo.
  El QR MUST contener solo un `approvalSecret` opaco de al menos 128 bits y MUST NOT contener un token
  de sesión reutilizable. El navegador iniciador MUST recibir por separado y una sola vez un
  `browserPollingSecret` independiente de al menos 128 bits, no incluido en el QR; consultar o recoger
  el resultado MUST exigir `pairingId`, polling secret válido, challenge vigente y navegador vinculado,
  con una única entrega e invalidación posterior. Ambos secretos MUST almacenarse solo como hashes y
  MUST NOT registrarse en logs o auditoría. La web MUST NOT recibir PIN ni datos biométricos, ni permitir acceso únicamente con teléfono. El
  acceso web sin dispositivo móvil previamente activado queda fuera del MVP como recuperación
  controlada o evolución futura. Supports HU-002 and HU-003.
- **FR-031**: El propietario administrador MUST incorporar presencialmente al trabajador registrando
  nombre, número de teléfono y rol inicial, y MUST entregarle directamente un código único temporal
  o QR de activación. El teléfono MUST ser el identificador de autenticación y el MVP MUST NOT depender
  de SMS ni correo electrónico para activar o recuperar el acceso. Supports HU-002 and HU-004.
- **FR-032**: La matriz inicial MUST reservar al propietario administrador la gestión de miembros,
  roles y auditoría de acceso; MUST limitar al vendedor al dominio de ventas y al responsable de
  inventario al dominio de productos, lotes y stock. Los roles MAY combinarse dentro de una
  pertenencia, pero solo un propietario administrador MUST poder concederlos. Esta matriz no habilita
  las funciones de ventas o inventario excluidas del alcance de esta feature. Supports HU-004 and HU-005.
- **FR-033**: El sistema MUST rechazar la desactivación, retiro o cambio de rol del último propietario
  administrador activo de una bodega. La operación solo MUST poder completarse después de activar o
  designar a otro propietario administrador en esa misma bodega. Supports HU-005 and HU-006.
- **FR-034**: En la activación, el trabajador MUST crear un PIN personal de seis dígitos y MAY habilitar
  la biometría disponible. Los accesos y desbloqueos posteriores MUST aceptar PIN o biometría; la
  biometría solo MUST desbloquear la sesión protegida del dispositivo y MUST NOT sustituir la identidad
  individual. Supports HU-002.
- **FR-035**: Una sesión MUST durar como máximo ocho horas. La aplicación MUST bloquearse después de
  treinta minutos de inactividad y MUST exigir PIN o biometría para desbloquearse. Supports HU-002.
- **FR-036**: Después de cinco intentos incorrectos consecutivos de PIN, el sistema MUST bloquear el
  acceso del perfil durante quince minutos y MUST responder sin facilitar enumeración de cuentas.
  Supports HU-002.
- **FR-037**: Un celular personal MUST mantener como máximo una cuenta activa de BodegIA; usar otra
  MUST exigir cerrar completamente la sesión y realizar una nueva activación autorizada. Un dispositivo
  compartido de la bodega MAY mantener varios perfiles, cada uno protegido por su PIN individual.
  Supports HU-002.
- **FR-038**: Al desactivar una pertenencia, el sistema MUST revocar sus sesiones y desvincular sus
  dispositivos sin eliminar la cuenta ni su historia. El PIN o dato biométrico previamente habilitado
  MUST NOT permitir acceso posterior. Supports HU-006.
- **FR-039**: La recuperación por pérdida o cambio de celular MUST requerir que el propietario revoque
  el dispositivo anterior y entregue presencialmente un nuevo código único o QR temporal para activar
  el nuevo dispositivo. Supports HU-002 and HU-006.
- **FR-040**: El administrador técnico solo MUST poder acceder temporalmente al contexto de una bodega
  para un caso de soporte con aprobación previa de un propietario administrador activo. El acceso MUST
  limitarse al alcance aprobado, expirar al cerrar el caso o tras una hora y MUST NOT incluir por defecto
  ventas, clientes, costos ni inventario. MUST auditarse motivo, alcance, aprobador, inicio, acciones,
  resultado y cierre. Supports HU-001 and HU-008.

### Key Entities

- **Persona o cuenta**: Identidad global que puede autenticarse y tener cero o más pertenencias; su
  desactivación impide operaciones sin borrar historia.
- **Bodega**: Tenant aislado con estado activo o desactivado; la validación piloto no la convierte en
  una excepción mono-tenant.
- **Pertenencia**: Relación entre persona y bodega que contiene estado, fecha de incorporación,
  responsable, roles y datos de desactivación; es la fuente de autorización por tenant.
- **Rol**: Agrupación inicial de responsabilidades —propietario administrador, vendedor o responsable
  de inventario— asignada dentro de una pertenencia, no globalmente.
- **Permiso**: Capacidad verificable dentro de una bodega, definida por la matriz fija de mínimo
  privilegio del rol o combinación de roles de su pertenencia.
- **Sesión**: Contexto temporal de una identidad autenticada; no sustituye la validación vigente de
  cuenta, bodega, pertenencia y permiso.
- **Dispositivo autorizado**: Celular personal o dispositivo compartido de la bodega vinculado a uno
  o más perfiles según su tipo; puede revocarse sin eliminar la identidad ni su historia.
- **Contexto de bodega activa**: Selección actual del tenant sobre el que se evalúan roles y permisos.
- **Evento de auditoría**: Registro histórico e inmutable de autenticación, acceso o administración,
  con actor, tenant aplicable, resultado, momento, cambios y motivo.

### Constitutional Requirements *(mandatory)*

- **Tenant Isolation**: Toda pertenencia y operación se vincula inequívocamente a una bodega. La
  autorización valida el contexto en cada operación y rechaza lectura, modificación o administración
  cruzada sin revelar datos del tenant objetivo.
- **Roles and Authorization**: Los roles derivan de cada pertenencia, admiten combinaciones autorizadas
  y aplican mínimo privilegio. Una función en una bodega no concede permisos en otra.
- **Transactions and Concurrency**: Crear una bodega con su primer propietario y actualizar estados o
  roles debe concluir íntegramente. Los cambios concurrentes no se sobrescriben silenciosamente y las
  operaciones fallidas no dejan autorización parcial.
- **Audit and Historical Record**: Los eventos enumerados en FR-023 son obligatorios e inmutables. La
  desactivación usa estado de ciclo de vida y preserva pertenencias y acciones históricas.
- **Security and Privacy**: Credenciales y sesiones se protegen, las entradas se validan en la
  experiencia y de forma autoritativa, y los mensajes no revelan información ajena. No se incorporan
  datos de clientes en esta feature.
- **Lot and FEFO Rules**: Esta feature no crea ni consulta productos, inventario, lotes o vencimientos;
  por ello no altera FEFO ni las reglas de lotes.
- **Human Confirmation**: OCR está fuera del alcance y no se capturan fechas mediante cámara.
- **Environment Boundaries**: Desarrollo, pruebas y producción deben mantener credenciales y datos
  separados; las pruebas de aislamiento no pueden usar datos reales de producción.
- **Out of Scope**: Productos, códigos de producto, inventario, lotes, vencimientos, OCR, ventas, clientes,
  proveedores, tickets, BI, Data Warehouse, ETL, Power BI, consumidores, suscripciones, múltiples
  sucursales, implementación técnica y diseño físico de datos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las pruebas negativas de lectura, modificación y administración entre dos
  bodegas rechaza el acceso sin exponer información del tenant objetivo.
- **SC-002**: El 100% de creaciones de bodega validadas produce exactamente una bodega y una primera
  pertenencia administrativa coherentes, o no produce ninguna de las dos.
- **SC-003**: El 100% de nuevas operaciones intentadas después de desactivar cuenta, bodega o
  pertenencia es rechazado, incluida una sesión previamente activa.
- **SC-004**: El 100% de altas, cambios y desactivaciones de pertenencias conserva actor, fecha,
  resultado, bodega, valores aplicables y motivo cuando es obligatorio.
- **SC-005**: En pruebas con una persona perteneciente a dos bodegas y roles distintos, el 100% de los
  cambios de contexto aplica exclusivamente los permisos de la bodega seleccionada.
- **SC-006**: Al menos 90% de los usuarios piloto completa inicio de sesión y selección de bodega
  correcta en menos de dos minutos durante una prueba guiada, sin ayuda correctiva.
- **SC-007**: Al menos 90% de los propietarios piloto completa incorporación, cambio de rol y
  desactivación de una pertenencia en el primer intento durante una prueba guiada.
- **SC-008**: El 100% de los conflictos simulados de cambio simultáneo evita la pérdida silenciosa de
  una de las decisiones y solicita revisión del estado vigente.
- **SC-009**: Ninguna prueba de soporte técnico estándar expone ventas, clientes, costos, inventario u
  otra información comercial al administrador técnico por defecto.
- **SC-010**: El 100% de auditorías históricas de una pertenencia desactivada permanece consultable por
  actores autorizados después de retirar su acceso.

## Assumptions

- Durante el MVP, solo el administrador técnico puede dar de alta una bodega; no existe registro público.
- Una persona puede tener una identidad global y pertenencias independientes en varias bodegas.
- El propietario administrador puede combinar funciones de venta e inventario, pero esas funciones
  no se especifican ni habilitan operativamente en esta feature.
- La conectividad está disponible para autenticación y autorización; el modo offline está fuera.
- El registro offline de ventas permanece fuera de esta especificación y se decidirá en una futura
  especificación de ventas, incluida cualquier regla de almacenamiento local, sincronización,
  idempotencia o resolución de conflictos de inventario.
- Los objetivos de SC-006 y SC-007 son metas de aceptación que deben medirse con participantes, no
  resultados ya observados.
- La bodega piloto no recibe excepciones de seguridad o diseño mono-tenant.
- Las acciones de alto impacto y el acceso productivo requieren las aprobaciones constitucionales.

## Dependencies

- Disponibilidad de datos sintéticos o autorizados para pruebas multi-tenant.
