# Protocolo e instrumento de usabilidad MVP

Estado: preparado por T148; no ejecutado.

Este documento prepara la medición de SC-006 y SC-007. No contiene nombres,
teléfonos, correos, credenciales, resultados ni métricas de participantes.

## Alcance y objetivos

- **SC-006**: al menos 90% de cuatro usuarios internos completa login y
  selección correcta de bodega en menos de dos minutos, sin ayuda correctiva.
- **SC-007**: al menos 90% de dos propietarios completa incorporación, cambio de
  rol y desactivación de una pertenencia en el primer intento.

El cálculo exige 4/4 para SC-006 y 2/2 para SC-007 porque los denominadores son
cuatro y dos respectivamente.

## Ambiente controlado

1. Usar una build identificada del gate MVP y Node.js 22 LTS según el repositorio.
2. Usar un ambiente no productivo con PostgreSQL de pruebas separado, tenant A
   y tenant B sintéticos, y datos reiniciados antes de cada sesión.
3. Verificar antes de iniciar que no existan tareas de pairing, soporte,
   biometría, dispositivo compartido ni funciones comerciales en el recorrido.
4. Usar un dispositivo/navegador por participante, reloj del servidor y zona
   horaria UTC para las marcas de tiempo.
5. El facilitador registra únicamente códigos anónimos; la tabla de
   correspondencia, si fuera necesaria, se guarda separada, cifrada y se
   elimina al cerrar la medición.

## Participantes y códigos

Asignar códigos al azar al comienzo, sin registrar identidad personal en este
instrumento:

- Usuarios internos: `U-01`, `U-02`, `U-03`, `U-04`.
- Propietarios administradores: `O-01`, `O-02`.

No sustituir estos códigos por nombres reales en archivos del repositorio,
logs, capturas o resultados.

## Consentimiento y privacidad

Antes de cada sesión, el facilitador debe explicar objetivo, duración,
grabación opcional, datos observados, derecho a retirarse y contacto de
incidencias. El participante confirma consentimiento informado sin entregar
PIN, teléfono real ni credenciales al instrumento. No capturar pantalla con
secretos; si una captura es indispensable, redactarla antes de almacenarla.

## Procedimiento SC-006

Para cada `U-xx`:

1. Preparar una cuenta sintética con pertenencias y roles aprobados.
2. Leer solo la instrucción neutral: “Inicia sesión y selecciona la bodega que
   corresponde a tu tarea”.
3. Iniciar cronómetro al terminar la instrucción.
4. Detenerlo cuando la persona esté en la bodega correcta y pueda ver el estado
   de contexto autorizado.
5. Registrar éxito, duración y si hubo ayuda correctiva. No corregir la ruta ni
   sugerir botones durante el intento.

## Procedimiento SC-007

Para cada `O-xx`:

1. Preparar una bodega sintética y un trabajador sintético pendiente.
2. Leer la instrucción neutral: “Incorpora al trabajador, cambia su rol y
   desactiva su pertenencia”.
3. Considerar un único primer intento desde el primer gesto operativo hasta la
   finalización de las tres acciones.
4. Registrar éxito o fallo, ayuda correctiva, errores seguros observados y
   preservación de auditoría. No completar pasos por la persona.

## Definiciones de medición

- **Primer intento**: la primera ejecución iniciada después de la instrucción
  neutral, sin reinicio por error del participante.
- **Ayuda correctiva**: cualquier indicación de botón, ruta, valor, orden de
  pasos o corrección de una acción. Lectura literal de la instrucción neutral
  no cuenta como ayuda correctiva.
- **Éxito SC-006**: login y selección correcta completados en menos de 120
  segundos, sin ayuda correctiva.
- **Éxito SC-007**: las tres acciones completadas en el primer intento, sin que
  el facilitador ejecute una acción por el participante.

## Instrumento

| Campo                            | Valor a registrar                                    |
| -------------------------------- | ---------------------------------------------------- |
| `participantCode`                | `U-01`…`U-04` u `O-01`…`O-02`                        |
| `scenario`                       | `SC-006` o `SC-007`                                  |
| `sessionCode`                    | Código aleatorio sin PII                             |
| `startedAtUtc` / `finishedAtUtc` | ISO-8601 UTC                                         |
| `durationSeconds`                | Diferencia calculada, sin redondear antes de guardar |
| `firstAttempt`                   | `true`/`false`                                       |
| `correctiveHelp`                 | `true`/`false`                                       |
| `success`                        | `true`/`false` según la definición anterior          |
| `blockerCode`                    | Código controlado o `NONE`, nunca texto con secretos |
| `sanitizedNotes`                 | Observación técnica sin PII ni credenciales          |

## Cálculo y cierre

```text
SC-006 = éxitos_SC006 / 4 * 100
SC-007 = éxitos_SC007 / 2 * 100
```

Publicar únicamente conteos agregados y duraciones anonimizadas después de
revisar que no haya secretos, PII o identificadores de tenant innecesarios.
T149 y T150 son las tareas que ejecutarían este protocolo; permanecen sin
marcar y no se anticipan resultados.
