#!/usr/bin/env python3
"""
Procesa TODOS los archivos Excel de la carpeta excel/
Calcula promedios globales de temperatura, humedad y litros
Genera panel_data.json con los datos actualizados
"""

import openpyxl
import json
from pathlib import Path

excel_folder = Path(__file__).parent / "excel"
output_file = Path(__file__).parent / "panel_data.json"

print(f"📊 Buscando archivos Excel en: {excel_folder}")

# Recolectar todos los datos
all_temperatures = []
all_humidity = []
all_liters = []
files_count = 0

# Procesar todos los .xlsx
for xlsx_file in sorted(excel_folder.glob("*.xlsx")):
    if xlsx_file.name.startswith("~$"):  # Saltar archivos temporales
        continue

    try:
        print(f"  📁 Leyendo: {xlsx_file.name}")
        wb = openpyxl.load_workbook(xlsx_file)
        ws = wb.active

        file_temps = []
        file_hums = []
        file_liters = []

        # Saltar encabezados y leer datos
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            try:
                # Columna C (índice 2): Temperatura
                # Columna D (índice 3): Humedad
                # Columna H (índice 7): Litros en este minuto

                if row[2] is not None and isinstance(row[2], (int, float)):
                    val = float(row[2])
                    if -50 < val < 80:  # Validar rango razonable
                        all_temperatures.append(val)
                        file_temps.append(val)

                if row[3] is not None and isinstance(row[3], (int, float)):
                    val = float(row[3])
                    if 0 <= val <= 100:  # Validar rango de humedad
                        all_humidity.append(val)
                        file_hums.append(val)

                if row[7] is not None and isinstance(row[7], (int, float)):
                    val = float(row[7])
                    if val >= 0:  # Solo valores positivos
                        all_liters.append(val)
                        file_liters.append(val)
            except (IndexError, TypeError, ValueError):
                continue

        if file_temps or file_hums or file_liters:
            files_count += 1
            print(f"    ✓ {len(file_temps)} filas con datos")

    except Exception as e:
        print(f"    ⚠️  Error: {e}")

if files_count == 0:
    print("\n❌ No se encontraron datos válidos")
    exit(1)

# Calcular promedios
avg_temp = sum(all_temperatures) / len(all_temperatures) if all_temperatures else 0
avg_humidity = sum(all_humidity) / len(all_humidity) if all_humidity else 0
avg_liters = sum(all_liters) / len(all_liters) if all_liters else 0

# Formatear para mostrar
avg_temp_str = f"{avg_temp:.1f}°C"
avg_humidity_str = f"{int(round(avg_humidity))}%"
avg_liters_str = f"{avg_liters:.2f} L"

print(f"\n✅ Datos procesados:")
print(f"   Archivos: {files_count}")
print(f"   Muestras temperatura: {len(all_temperatures)}")
print(f"   Muestras humedad: {len(all_humidity)}")
print(f"   Muestras litros: {len(all_liters)}")
print(f"\n📈 Promedios globales:")
print(f"   Temperatura: {avg_temp_str}")
print(f"   Humedad: {avg_humidity_str}")
print(f"   Litros: {avg_liters_str}")

# Guardar JSON
config = {
    "AVG_TEMP": avg_temp_str,
    "AVG_HUMIDITY": avg_humidity_str,
    "AVG_LITERS": avg_liters_str,
    "timestamp": str(Path(__file__).stat().st_mtime),
    "samples": {
        "temperature": len(all_temperatures),
        "humidity": len(all_humidity),
        "liters": len(all_liters)
    }
}

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print(f"\n💾 Guardado en: {output_file}")
