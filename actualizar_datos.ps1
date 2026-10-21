# Script para monitorear la carpeta excel/ y actualizar panel_data.json
# Ejecutar: powershell -ExecutionPolicy Bypass -File actualizar_datos.ps1

$carpetaExcel = Join-Path $PSScriptRoot "excel"
$scriptPython = Join-Path $PSScriptRoot "procesar_excel.py"

Write-Host "🔄 Monitor de datos - Panel BioFog"
Write-Host "Carpeta monitoreada: $carpetaExcel"
Write-Host "Script Python: $scriptPython"
Write-Host ""

$ultimasModificaciones = @{}

while ($true) {
    try {
        # Obtener archivos Excel
        $archivos = Get-ChildItem -Path $carpetaExcel -Filter "*.xlsx" -ErrorAction SilentlyContinue |
                    Where-Object { -not $_.Name.StartsWith('~$') }

        $cambio = $false

        # Verificar si hay cambios
        foreach ($archivo in $archivos) {
            $tiempo = $archivo.LastWriteTime
            $clave = $archivo.Name

            if (-not $ultimasModificaciones.ContainsKey($clave) -or $ultimasModificaciones[$clave] -ne $tiempo) {
                $cambio = $true
                $ultimasModificaciones[$clave] = $tiempo
                Write-Host "📝 Detectado: $($archivo.Name)" -ForegroundColor Green
            }
        }

        # Si hay cambios, ejecutar Python
        if ($cambio) {
            Write-Host "⚙️  Procesando Excel files..." -ForegroundColor Yellow
            $output = python $scriptPython 2>&1
            Write-Host $output
            Write-Host "✅ Datos actualizados" -ForegroundColor Green
            Write-Host ""
        }
    }
    catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }

    # Esperar 5 segundos antes de revisar de nuevo
    Start-Sleep -Seconds 5
}
