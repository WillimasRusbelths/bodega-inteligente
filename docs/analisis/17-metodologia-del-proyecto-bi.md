# Metodología del proyecto de Business Intelligence

## Enfoque seleccionado

El proyecto combina la metodología dimensional de Kimball para el producto de datos con prácticas de
gestión de PMI para organizar alcance, cronograma, riesgos, calidad, stakeholders, comunicaciones y
aceptación. Esto no reemplaza el flujo constitucional de especificar, aclarar, planificar, comprobar,
implementar, probar, documentar y revisar.

## Comparación Kimball e Inmon

| Criterio             | Kimball                                           | Inmon                                   |
| -------------------- | ------------------------------------------------- | --------------------------------------- |
| Punto de partida     | Procesos de negocio y DataMarts                   | Almacén corporativo integrado           |
| Modelo principal     | Dimensional                                       | Corporativo, frecuentemente normalizado |
| Integración          | Dimensiones conformadas y matriz bus              | Integración central previa              |
| Entrega              | Incremental por proceso                           | Mayor diseño empresarial inicial        |
| Adecuación a BodegIA | Ventas e Inventario pueden aportar valor temprano | Excede el alcance inicial académico     |

Se selecciona Kimball porque BodegIA tiene dos procesos analíticos prioritarios y requiere evolución
incremental sin diseñar anticipadamente DataMarts completos de Clientes, Compras o Proveedores.

## Ciclo dimensional aplicado

1. **Seleccionar proceso:** ventas e inventario.
2. **Declarar grano:** detalle de venta por producto, modalidad y lote; movimiento por producto, lote
   y momento.
3. **Identificar dimensiones:** tiempo, bodega, producto, lote y demás contextos de cada proceso.
4. **Identificar hechos:** importes, cantidades reales, costos, márgenes, entradas, salidas y mermas.

El orden es obligatorio: no se agregan medidas sin comprender el grano y no se imputa cantidad donde
la operación no la midió.

## Aplicación conceptual de PMI

### Inicio

- Formalizar necesidad, patrocinio, objetivos y restricciones.
- Identificar stakeholders y autoridad sobre los datos.
- Aprobar separación OLTP/OLAP, alcance de DataMarts y criterios iniciales.
- Registrar preguntas, supuestos y exclusiones.

### Planificación

- Crear EDT de análisis, calidad, arquitectura, modelo, ETL, pruebas y visualización.
- Estimar cronograma después de medir volumen y disponibilidad; no inventar fechas.
- Planificar recursos, ambientes, seguridad, comunicaciones y calidad.
- Definir riesgos, dependencias, criterios de aceptación y plan de reversión de cargas.

### Ejecución

- Perfilar fuentes autorizadas.
- Implementar posteriormente staging, ETL, dimensiones, hechos y DataMarts mediante especificaciones.
- Validar definiciones con usuarios de negocio.
- Construir posteriormente el dashboard Power BI sin acceso de escritura al OLTP.
- Mantener documentación, linaje y evidencias.

### Monitoreo y control

- Comparar conteos e importes entre OLTP, staging y DataMarts.
- Medir calidad, duración de cargas, rechazos, frescura y disponibilidad.
- Revisar aislamiento multi-tenant y acceso.
- Gestionar cambios de grano, métricas o alcance mediante aprobación.
- Dar seguimiento a riesgos e incidencias sin ocultar cargas parciales.

### Cierre

- Obtener aceptación de definiciones, conciliación, seguridad y dashboard.
- Entregar documentación, modelo, pruebas, evidencias y manuales aplicables.
- Registrar lecciones aprendidas y pendientes.
- Cerrar accesos temporales y conservar artefactos conforme a política.

## Gestión del alcance

Incluye DataMarts de Ventas e Inventario, modelo preliminar, ETL incremental, calidad, gobierno,
indicadores y dashboard Power BI posterior. Excluye DataMarts completos de Clientes y Compras/
Proveedores, predicción, comparación pública, Tableau implementado y escritura analítica al OLTP.

Toda ampliación requiere especificación aprobada, impacto en matriz bus, privacidad, tenant, pruebas y
cronograma. El análisis actual no autoriza implementación.

## Cronograma conceptual

1. Inicio y validación de alcance.
2. Perfilado y calidad de fuentes.
3. Diseño dimensional y matriz bus.
4. Diseño y prueba del ETL incremental.
5. Construcción posterior de DataMarts.
6. Validación de indicadores.
7. Desarrollo posterior de Power BI.
8. Pruebas, aceptación y cierre.

Duraciones, hitos y fechas dependen de disponibilidad, volumen, herramienta y decisiones pendientes.

## Calidad

El plan verifica las siete dimensiones definidas, conciliación por tenant, linaje, idempotencia,
cantidad no medida, Cliente general, margen estimado/definitivo y seguridad. Los umbrales cuantitativos
se aprueban antes de usarse como puerta de calidad.

## Stakeholders

- Patrocinador o propietario del producto.
- Propietario administrador y responsable de inventario de la bodega piloto.
- Usuarios vendedores como fuentes de validación operativa.
- Investigador o analista BI.
- Responsable de calidad de datos.
- Administrador técnico y seguridad.
- Asesor legal cuando intervengan privacidad y conservación.

## Comunicaciones

- Revisión de definiciones y calidad con responsables de negocio.
- Reporte de carga con conteos, errores y conciliación.
- Registro de decisiones y cambios con trazabilidad.
- Comunicación de incidentes de seguridad por canal autorizado.
- Demostraciones de dashboard con datos sintéticos o autorizados.

Frecuencia, formato y responsables nominales se fijarán en el plan aprobado.

## Entregables BI

- Visión y requerimientos BI.
- Arquitectura OLTP/OLAP.
- Catálogo de calidad y gobierno.
- Modelo dimensional, estrellas y matriz bus.
- Plan ETL, linaje y estrategia de pruebas.
- Catálogo de indicadores y storytelling.
- DataMarts de Ventas e Inventario implementados posteriormente.
- Dashboard Power BI y evidencias, también posteriores.

## Criterios de aceptación

- Grano y dimensiones validados para ambos procesos.
- Definiciones de métricas únicas y aprobadas.
- Conciliación con OLTP dentro de tolerancias aprobadas.
- Carga incremental repetible, idempotente y recuperable.
- Registros inválidos rechazados o puestos en cuarentena.
- Linaje desde dashboard hasta fuente.
- Pruebas negativas de acceso entre tenants satisfactorias.
- Margen estimado y definitivo claramente separados.
- Dashboard indica tenant, filtros y fecha de actualización.
- Revisión humana y evidencias completas antes de integración.

## Riesgos principales

| Riesgo                             | Efecto                        | Respuesta conceptual                                            |
| ---------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Calidad insuficiente del OLTP      | Indicadores incorrectos       | Perfilado, reglas, cuarentena y corrección autorizada en origen |
| Mezcla de tenants                  | Brecha crítica                | Tenant extremo a extremo y pruebas negativas                    |
| Grano ambiguo                      | Doble conteo                  | Declarar y validar grano antes del diseño físico                |
| Carga parcial                      | DataMarts inconsistentes      | Publicación controlada, punto de corte y reprocesamiento        |
| Fórmulas no acordadas              | Métricas contradictorias      | Catálogo único, propietario y versionado                        |
| Margen estimado tratado como final | Decisión errónea              | Indicador obligatorio de estado y filtros visibles              |
| Cantidades imputadas               | Falsa exactitud               | Ausencia explícita para ventas por importe                      |
| Impacto en OLTP                    | Operación degradada           | Extracción incremental y ventana medida                         |
| Acceso excesivo de Power BI        | Exposición de datos           | Solo lectura, mínimo privilegio y seguridad por tenant          |
| Dashboard desactualizado           | Decisiones con datos antiguos | Fecha de corte, monitoreo y alerta de frescura                  |
| Dependencia de herramienta         | Costos o bloqueo              | Modelo conceptual independiente y evaluación técnica            |
| Datos personales innecesarios      | Riesgo de privacidad          | Minimización, enmascaramiento y exclusión del DataMart completo |

## Decisiones pendientes

Herramienta ETL, plataforma física analítica, licenciamiento y modo de Power BI, seguridad analítica,
frecuencia y SLA, responsables nominales, cronograma, tolerancias, política SCD, retención, catálogo
de datos y fórmulas finales.
