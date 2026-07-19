# Evidencia de rendimiento del acceso MVP

## Estado

T136 está completada mediante `apps/api/test/performance/access.js`.
T137 está completada con una ejecución real de k6 en GitHub Actions. Esta
medición corresponde a un ambiente controlado y no constituye un SLA de
producción.

## Ejecución verificable

| Campo                     | Resultado                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Ambiente                  | GitHub Actions                                                                         |
| Workflow                  | `MVP access performance`                                                               |
| Rama                      | `main`                                                                                 |
| PostgreSQL                | 16.14, service container                                                               |
| API                       | Levantada dentro del workflow                                                          |
| Comando                   | `k6 run --summary-export=performance-summary.json apps/api/test/performance/access.js` |
| Duración                  | 30 segundos                                                                            |
| VUs máximos               | 8                                                                                      |
| Iteraciones completadas   | 247                                                                                    |
| Iteraciones interrumpidas | 0                                                                                      |

## Escenarios

Se ejecutaron los ocho escenarios definidos por el script:

- `audit`
- `guard_chain`
- `login`
- `refresh`
- `revocation`
- `safe_errors`
- `tenant_listing`
- `tenant_selection`

## Resultados k6

| Métrica                         |          Resultado |
| ------------------------------- | -----------------: |
| `http_reqs`                     |                710 |
| `checks_total`                  |               1420 |
| `checks_succeeded`              |               1420 |
| `checks_failed`                 |                  0 |
| Checks                          |            100.00% |
| `data_received`                 |             204 kB |
| `data_sent`                     |             112 kB |
| `http_req_duration` avg         |          520.27 µs |
| `http_req_duration` p90         |            1.05 ms |
| `http_req_duration` p95         |            1.43 ms |
| `access_operation_duration` avg |          520.27 µs |
| `access_operation_duration` p90 |            1.05 ms |
| `access_operation_duration` p95 |            1.43 ms |
| `access_operation_failures`     |    0.00%, 0 de 710 |
| `http_req_failed`               | 65.21%, 463 de 710 |

La ejecución sí realizó solicitudes HTTP reales: `http_reqs=710`,
`data_received=204 kB` y `data_sent=112 kB`.

`http_req_failed` aparece alto porque k6 clasifica las respuestas 4xx como
fallidas a nivel HTTP. En este gate, varios escenarios esperan respuestas
seguras 400/401/404/422 para validar errores seguros, endpoints protegidos y
ausencia de filtración. La métrica funcional del gate es
`access_operation_failures`, que quedó en 0.00%.

## Thresholds

| Threshold                             |     Resultado | Estado   |
| ------------------------------------- | ------------: | -------- |
| `access_operation_duration p(95)<300` | p95 = 1.43 ms | Cumplido |
| `access_operation_failures rate<0.05` |  rate = 0.00% | Cumplido |
| `http_req_duration p(95)<300`         | p95 = 1.43 ms | Cumplido |

El p95 observado fue 1.43 ms, menor al objetivo p95 <300 ms. El resultado
corresponde exclusivamente al ambiente controlado de GitHub Actions y no
constituye un SLA definitivo de producción.

## Alcance y seguridad

El script recibe teléfono, PIN, credencial de dispositivo y UUIDs únicamente
mediante variables de entorno sintéticas del workflow. No contiene
credenciales, tokens ni UUIDs reales y no imprime cuerpos de respuesta.

No se modificaron API, Prisma, migraciones ni Supabase para esta medición.
