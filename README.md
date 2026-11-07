# Economía familiar

Aplicación React + Vite + TypeScript para un hogar compartido. Incluye autenticación Supabase, RLS, alta de movimientos, resumen mensual, exportación CSV y cola local IndexedDB para altas sin conexión.

## Puesta en marcha

1. Copia `.env.example` como `.env.local` e indica URL y clave pública de Supabase.
2. En el editor SQL de Supabase ejecuta `supabase/migrations/20261107_000001_family_finance.sql` una única vez, en un proyecto nuevo o tras revisarlo. La migración no altera tablas no definidas en ella.
3. Ejecuta `npm install` y `npm run dev`.
4. Crea dos usuarios por separado. La primera persona crea el hogar desde la pantalla inicial; comparte el código que aparece en Ajustes y la segunda se incorpora desde su propia pantalla inicial.

## Vercel

Importa el repositorio, usa el preset **Vite** y añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en Environment Variables. Build command: `npm run build`; output: `dist`. `vercel.json` permite rutas de SPA.

## Seguridad y modelo

- Solo la clave pública se distribuye al navegador; nunca `service_role`.
- Las tablas usan RLS y `is_household_member`; las transacciones solo las actualiza su creador.
- Las cantidades son enteros en céntimos. Las bajas son lógicas (`deleted_at`) para permitir sincronización.
- `scope=shared` identifica movimientos comunes; `split_method` prepara reparto igual o proporcional. El cálculo y liquidación de aportaciones aún no se presentan en la interfaz.

## Implementado y verificado localmente

- Estructura Vite/React/TypeScript, pantalla de acceso Supabase y configuración por variables de entorno.
- Esquema SQL/RLS, creación y unión de hogar, autenticación individual, alta de movimientos, CSV, PWA y cola IndexedDB para altas offline.

## Pendiente de interfaz y pruebas de integración

- Categorías, recurrentes, presupuestos, objetivos, deudas, reparto proporcional y previsión detallada.
- Pruebas contra un proyecto Supabase real, prueba multiusuario/RLS y despliegue Vercel. No se han ejecutado sin credenciales del proyecto.
- El paquete HTML anterior y su SQL no estaban disponibles en este espacio; no se ha migrado ningún contrato histórico.
