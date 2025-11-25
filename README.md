# Normalizador-Geolocalizador PTEL Andalucía

[![Deploy](https://github.com/luismgarcia/normalizador-geolocalizador-ptel/actions/workflows/deploy.yml/badge.svg)](https://github.com/luismgarcia/normalizador-geolocalizador-ptel/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Sistema integral de **normalización de coordenadas** y **geocodificación tipológica** para Planes Territoriales de Emergencias Locales (PTEL) de los **786 municipios andaluces**.

## 🎯 Características Principales

### Normalización de Coordenadas (v2.0)
- **52 patrones** de coordenadas detectados en documentos PTEL reales
- Corrección automática de **errores P0** (Y truncada, intercambio X↔Y)
- Normalización de **mojibake UTF-8/Windows-1252**
- Conversión de formatos europeos (punto miles, coma decimal)
- **Scoring 0-100** con niveles de confianza (ALTA/MEDIA/BAJA/CRÍTICA)

### Geocodificación Tipológica WFS
- **4 geocodificadores especializados**:
  - 🏥 Salud: Hospitales, centros de salud, consultorios
  - 🎓 Educación: Colegios, institutos, universidades
  - 🏛️ Cultural: Patrimonio histórico, museos, yacimientos
  - 🚔 Seguridad: Comisarías, cuarteles, bomberos
- Fuentes oficiales: DERA, ISE, IAPH, IDE Andalucía
- Precisión: **≤25 metros**

### Procesamiento Multi-formato
- CSV, XLSX, ODS (hojas de cálculo)
- DOCX, ODT (documentos de texto)
- DBF (bases de datos)
- GeoJSON, KML (geoespaciales)
- ZIP (múltiples archivos)

### Wizard Profesional de 3 Pasos
1. **Carga**: Drag & drop con validación automática
2. **Análisis**: Estadísticas, comparación antes/después, 8 estrategias de validación
3. **Exportación**: CSV, XLSX, GeoJSON, KML compatibles con QGIS

## 🚀 Inicio Rápido

```bash
# Clonar repositorio
git clone https://github.com/luismgarcia/normalizador-geolocalizador-ptel.git
cd normalizador-geolocalizador-ptel

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

## 📦 Dependencias Principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| React | 18.3+ | UI Framework |
| TypeScript | 5.0+ | Tipado estático |
| Vite | 5.0+ | Build tool |
| Tailwind CSS | 3.4+ | Estilos |
| shadcn/ui | - | Componentes UI |
| proj4 | 2.11+ | Transformaciones CRS |
| xlsx | 0.18+ | Procesamiento Excel |
| framer-motion | 11+ | Animaciones |

## 🗺️ Sistema de Coordenadas

**Entrada soportada:**
- UTM30 ETRS89 (EPSG:25830)
- UTM30 ED50 (EPSG:23030)
- WGS84 Geográficas (EPSG:4326)
- Formatos mixtos en mismo documento

**Salida estándar:**
- **EPSG:25830** (UTM Zona 30N, ETRS89)
- Coordenadas redondeadas a metros
- Compatible con QGIS, ArcGIS, gvSIG

## 📊 Rangos Válidos Andalucía

| Coordenada | Rango | Unidad |
|------------|-------|--------|
| X (Este) | 100,000 - 620,000 | metros |
| Y (Norte) | 3,980,000 - 4,290,000 | metros |
| Latitud | 36.0° - 38.75° | grados |
| Longitud | -7.55° - -1.60° | grados |

## 📁 Estructura del Proyecto

```
normalizador-geolocalizador-ptel/
├── src/
│   ├── components/           # Componentes React
│   │   ├── Step1.tsx        # Paso 1: Carga de archivos
│   │   ├── Step2.tsx        # Paso 2: Análisis
│   │   ├── Step3.tsx        # Paso 3: Exportación
│   │   ├── step2/           # Subcomponentes análisis
│   │   └── ui/              # shadcn/ui components
│   ├── lib/                  # Lógica de negocio
│   │   ├── coordinateNormalizer.ts  # Normalizador v2.0
│   │   ├── coordinateUtils.ts       # Utilidades coordenadas
│   │   ├── fileProcessor.ts         # Procesador archivos
│   │   ├── validation.ts            # Validación 8 estrategias
│   │   └── exportUtils.ts           # Exportación multi-formato
│   ├── services/             # Servicios externos
│   │   ├── geocoding/        # Geocodificación WFS
│   │   │   ├── GeocodingOrchestrator.ts
│   │   │   └── specialized/  # Geocodificadores tipológicos
│   │   └── classification/   # Clasificador infraestructuras
│   └── types/                # Tipos TypeScript
├── docs/                     # Documentación técnica
└── public/                   # Assets estáticos
```

## 🔧 Scripts Disponibles

```bash
npm run dev      # Servidor desarrollo
npm run build    # Build producción
npm run preview  # Preview build
npm run lint     # ESLint
npm run test     # Tests (cuando estén configurados)
```

## 📖 Documentación

| Documento | Descripción |
|-----------|-------------|
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | Referencia API completa |
| [ARQUITECTURA_COMPONENTES.md](./ARQUITECTURA_COMPONENTES.md) | Arquitectura del sistema |
| [FAQ_TECNICO.md](./FAQ_TECNICO.md) | Preguntas frecuentes |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Guía de despliegue |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Guía de testing |
| [ROADMAP_EJECUTIVO_PTEL_2025.md](./ROADMAP_EJECUTIVO_PTEL_2025.md) | Roadmap desarrollo |

## 🤝 Contribuir

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'feat: añadir nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para más detalles.

## 📄 Licencia

MIT License - ver [LICENSE](./LICENSE) para detalles.

## 🏛️ Contexto

Este proyecto forma parte del esfuerzo de digitalización y normalización de los Planes Territoriales de Emergencias Locales (PTEL) de Andalucía, en cumplimiento del **Decreto 197/2024** que establece los requisitos para planes de emergencia municipales.

## 📧 Contacto

- **Autor**: Luis M. García
- **Ámbito**: Protección Civil, Andalucía
- **Propósito**: Herramienta técnica municipal

---

<p align="center">
  <strong>786 municipios · 52 patrones · Precisión ≤25m</strong>
  <br>
  <sub>Sistema PTEL Andalucía · EPSG:25830</sub>
</p>
