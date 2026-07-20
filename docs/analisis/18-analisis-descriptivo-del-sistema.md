# Análisis descriptivo del sistema BodegIA

## 1. ¿Qué problema está solucionando?

BodegIA aborda una necesidad común en bodegas familiares: la operación diaria suele gestionarse con cuadernos, memoria y archivos no integrados, lo que dificulta:

- conocer el stock real disponible;
- controlar lotes y vencimientos con trazabilidad;
- evitar quiebres o sobrestock;
- mantener consistencia entre ventas e inventario;
- tomar decisiones de reposición, precios y promociones con datos confiables.

El sistema propone una fuente única de información operativa por bodega, con controles de seguridad, auditoría y aislamiento de datos.

## 2. ¿De qué trata el sistema?

BodegIA es una plataforma de gestión para bodegas familiares, diseñada con dos superficies:

- **Móvil**: para operación en campo (venta, escaneo, captura, registro rápido).
- **Web**: para administración, control y análisis.

Su diseño es **multi-tenant**: múltiples bodegas comparten plataforma, pero cada una mantiene su información y configuración separadas.

## 3. ¿Para qué sirve?

Permite centralizar y controlar procesos clave de negocio:

- gestión de productos, categorías y presentaciones;
- registro de lotes, costos y vencimientos;
- control de inventario con entradas, salidas, ajustes, mermas y cierres;
- ventas por unidad, por peso ingresado manualmente y por importe;
- gestión mínima de clientes y proveedores;
- reglas FEFO, alertas de stock/vencimiento y análisis inicial;
- trazabilidad y auditoría de operaciones críticas.

En términos prácticos, sirve para operar mejor, reducir errores y mejorar la toma de decisiones en la bodega.

## 4. ¿Cómo está estructurado el sistema?

El sistema está concebido en capas:

1. **Capa de interacción**
   - Aplicación móvil para operación diaria.
   - Plataforma web para administración y análisis.

2. **Capa de negocio (backend)**
   - API REST autoritativa.
   - Validación de entradas y reglas de negocio.
   - Resolución de pertenencia, roles y permisos por tenant.
   - Transacciones atómicas para ventas e inventario.

3. **Capa de datos operacional (OLTP)**
   - Persistencia transaccional de ventas, inventario, lotes, clientes, proveedores y auditoría.

4. **Capa analítica (OLAP/BI)**
   - Extracción ETL de solo lectura desde OLTP.
   - Staging, Data Warehouse y DataMarts (Ventas e Inventario).
   - Consumo posterior en Power BI para indicadores y storytelling.

## 5. Tecnologías definidas para la implementación

El proyecto establece como stack objetivo:

- **TypeScript estricto**.
- **Backend:** NestJS.
- **Web:** React + Vite.
- **Móvil:** React Native + Expo.
- **Base de datos:** PostgreSQL (Supabase).
- **Acceso y migraciones:** Prisma.
- **Analítica y visualización BI:** Power BI (lectura sobre entorno analítico).

## 6. Reglas de negocio principales

Entre las reglas más relevantes del sistema:

- **Tenant obligatorio** para toda entidad y operación.
- **Autorización por pertenencia**: roles y permisos dependen de la relación persona–bodega.
- **Aislamiento estricto**: no hay acceso cruzado entre bodegas.
- **Configuración por bodega**: parámetros no son globales.
- **Inventario por lotes** con vencimientos asociados al lote.
- **Aplicación de FEFO** con excepciones autorizadas y auditadas.
- **Venta atómica**: venta + movimientos indispensables se confirman o revierten juntos.
- **Auditoría inmutable** en eventos críticos.
- **OCR con confirmación humana obligatoria** antes de persistir vencimientos.
- **Privacidad y minimización de datos de cliente**.
- **Sin machine learning predictivo en el MVP**; solo reglas determinísticas y explicables.

## 7. Enfoques utilizados en el proyecto

El proyecto combina varios enfoques:

- **Enfoque de arquitectura desacoplada** (móvil/web consumen backend, no tablas críticas).
- **Enfoque security-by-design** (mínimo privilegio, validación autoritativa, separación de ambientes).
- **Enfoque transaccional y de trazabilidad** (integridad, auditoría y conservación histórica).
- **Enfoque multi-tenant desde el inicio** (sin atajos mono-tenant en el piloto).
- **Enfoque data-driven con BI** (separación OLTP/OLAP, calidad de datos, ETL incremental).
- **Enfoque metodológico mixto**:
  - **Spec-driven development** para gobernanza funcional y técnica.
  - **Kimball** para modelado dimensional de DataMarts.
  - **PMI conceptual** para gestión de alcance, riesgos y control.

## 8. Estado actual del repositorio

El repositorio se encuentra principalmente en fase de **análisis, definición y arquitectura**. Contiene documentación funcional y de BI detallada, además de reglas, procesos y decisiones de diseño. La implementación técnica completa se plantea como fase posterior, siguiendo la constitución y los controles de calidad definidos.
