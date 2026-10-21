# Panel 3D - Guía de Uso

## ¿Qué es?

El Panel 3D es una visualización interactiva en 3D de tu estación de niebla que **automaticamente se actualiza** con los promedios de todos tus archivos Excel.

En lugar de mostrar una foto estática del panel, ahora hay un modelo 3D que:
- ✨ Se actualiza automáticamente con nuevos datos Excel
- 🔄 Procesa TODOS los archivos Excel de la carpeta `excel/`
- 📊 Muestra promedios globales de: Temperatura, Humedad y Litros
- 🖱️ Es interactivo: Puedes rotar, zoom con el mouse

## Cómo funciona

### 1. **Archivos generados/modificados:**

```
📁 estacion-niebla/
├── procesar_excel.py          ← Script que procesa TODOS los Excel
├── actualizar_datos.ps1       ← Script que monitorea cambios
├── iniciar.bat                ← Actualizado para iniciar todo
├── panel_data.json            ← Datos generados (se actualiza automáticamente)
├── js/
│   └── panel-3d.js            ← Código del panel 3D (visualización)
└── index.html                 ← Actualizado (agregar script panel-3d.js)
```

### 2. **Flujo de datos:**

```
Excel files en excel/ 
        ↓
procesar_excel.py (Python)
        ↓
panel_data.json (JSON con promedios)
        ↓
panel-3d.js (carga JSON y renderiza)
        ↓
Dashboard (muestra panel 3D)
```

### 3. **Automatización:**

Cuando ejecutas `iniciar.bat`:

1. ✅ Inicia el **monitor de datos** (PowerShell script)
   - Vigila la carpeta `excel/` cada 5 segundos
   - Cuando detecta cambios, ejecuta `procesar_excel.py`
   - Actualiza `panel_data.json`

2. ✅ Inicia el **servidor web** (Python)
   - Sirve la página en http://localhost:8000
   - El panel 3D carga `panel_data.json` automáticamente

3. ✅ Abre el **navegador** en http://localhost:8000

## Cómo usar

### Opción 1: Inicio automático (recomendado)

```batch
# Hacer doble clic en:
iniciar.bat
```

Esto inicia todo automáticamente. El panel 3D se actualizará cada vez que agregues Excel files.

### Opción 2: Manual

```bash

# Terminal 2: Servidor web
# En archivos abrir: 

# En cmd Abierto como Adminsitardos hacer: 
cd C:\Users\isabe\OneDrive\Documentos\estacion-niebla\
python -m http.server 8000

# ir a la web: http://localhost:8000/
# ir a esta carpeta:

```
# cmd ---> nueva cmd comoa dministrador --> 
cd C:\Users\isabe\OneDrive\Documentos\estacion-niebla\
python registro_estacion.py

