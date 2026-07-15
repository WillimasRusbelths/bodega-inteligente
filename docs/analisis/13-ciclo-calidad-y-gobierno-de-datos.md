# Ciclo, calidad y gobierno de datos

## Ciclo de vida del dato

1. **Captura:** móvil o web registra datos medidos, contados o declarados; OCR exige confirmación.
2. **Validación:** cliente ayuda a corregir y backend aplica reglas autoritativas.
3. **Almacenamiento operacional:** PostgreSQL conserva transacciones, tenant, lotes y auditoría.
4. **Extracción:** ETL lee cambios autorizados sin modificar OLTP.
5. **Limpieza:** identifica duplicados, ausencias, incompatibilidades y valores inválidos.
6. **Transformación:** conforma dimensiones, deriva medidas y preserva significado operacional.
7. **Carga:** incorpora hechos y dimensiones válidos al Data Warehouse y DataMarts.
8. **Análisis:** calcula métricas con definiciones únicas y contexto temporal.
9. **Visualización:** Power BI presenta información autorizada y fecha de actualización.
10. **Conservación y eliminación autorizada:** aplica historia, retención y borrado lógico; una
    eliminación excepcional requiere base legal, autorización y auditoría.

## Dimensiones de calidad

- **Exactitud:** el valor representa la operación real; una venta por importe no inventa cantidad.
- **Completitud:** están presentes campos obligatorios según proceso y grano.
- **Consistencia:** valores relacionados no se contradicen entre fuente, staging y DataMart.
- **Validez:** formato, dominio, signo, unidad y relación cumplen reglas aprobadas.
- **Unicidad:** una operación fuente no se carga dos veces.
- **Oportunidad:** la información declara su fecha de corte y cumple la frecuencia aprobada.
- **Trazabilidad:** cada dato analítico puede vincularse con fuente, ejecución y transformación.

## Controles de calidad

| Caso | Control conceptual | Tratamiento |
|---|---|---|
| Códigos duplicados | Detectar misma clave comercial dentro del tenant y variantes conflictivas | Cuarentena o resolución autorizada; no fusionar automáticamente |
| Fechas inválidas | Validar formato, rango y confirmación OCR | Rechazar o corregir en OLTP mediante proceso autorizado |
| Cantidades negativas | Admitir signo solo cuando el tipo de movimiento lo justifique | Rechazar registro incoherente y conservar error |
| Ventas sin detalle | Exigir al menos un detalle íntegro para una venta confirmada | Cuarentena y conciliación con fuente |
| Lotes sin producto | Validar relación producto-lote dentro del mismo tenant | Rechazar carga del hecho dependiente |
| Clientes duplicados por teléfono | Buscar coincidencias dentro de la bodega sin cruzar tenants | Marcar para revisión; no fusionar identidades automáticamente |
| Unidades incompatibles | Contrastar modalidad, unidad base y tipo de medida | Rechazar transformación incompatible |
| Importes y costos inconsistentes | Conciliar bruto, descuento, neto, costo y margen según definición | Cuarentena o marca de calidad; no alterar OLTP |
| Venta por importe no medida | Exigir importe y lote; cantidad física debe permanecer ausente | Cargar importe y indicador de no medición, sin imputar cantidad |
| Tenants diferentes | Comparar tenant de venta, detalle, producto, lote y dimensiones | Rechazo crítico y alerta de seguridad/calidad |

## Perfiles de datos y umbrales

Cada carga debe calcular conteos de origen, aceptados, rechazados, duplicados y diferencias de
conciliación. Los umbrales cuantitativos para detener una carga no se inventan: quedan pendientes de
medición, criticidad y aprobación. Un incumplimiento crítico de tenant siempre bloquea el registro.

## Gobierno de datos

- **Propietario del dato:** el propietario de cada bodega decide usos comerciales autorizados de sus
  datos dentro de la plataforma y las reglas aplicables, sujeto a ley y constitución.
- **Responsable de calidad:** rol de negocio y analista BI revisan definiciones, incidencias y
  conciliaciones; la asignación nominal permanece pendiente.
- **Administrador técnico:** opera infraestructura y cargas con mínimo privilegio; no consulta
  información comercial por defecto.
- **Usuarios autorizados:** consumen solo indicadores necesarios de bodegas donde tienen pertenencia.
- **Privacidad:** se minimizan datos personales; el DataMart de Clientes completo queda fuera.
- **Auditoría:** operaciones OLTP y ejecuciones ETL conservan usuario o servicio, fecha, origen,
  resultado, conteos y errores.
- **Conservación:** hechos y linaje siguen la política aprobada; el plazo específico está pendiente.
- **Acceso analítico:** requiere autenticación, pertenencia, rol y filtros de seguridad autoritativos.

## Datos sensibles y Cliente general

DimCliente no debe exponer teléfono u otros datos personales si no son necesarios para el análisis.
Durante el MVP no se recopilan DNI, dirección domiciliaria, fecha de nacimiento ni correo. «Cliente
general» se representa como miembro especial no identificable y se excluye de clientes frecuentes.

## Gestión de incidencias

Una incidencia registra regla vulnerada, tenant, fuente, ejecución, severidad, tratamiento, responsable
y resolución. Corregir datos en staging o Data Warehouse no reemplaza corregir el origen cuando el
OLTP sea incorrecto; BI nunca escribe esa corrección directamente.

## Decisiones pendientes

Responsables nominales, catálogo formal de datos, umbrales de aceptación, plazos de conservación,
procedimiento legal de eliminación, niveles de severidad, SLA de calidad y herramienta de monitoreo.
