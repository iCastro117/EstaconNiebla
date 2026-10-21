"""
registro_estacion.py
Escucha al Arduino (código estacion_ambiental_v3) por USB y cada minuto
actualiza un Excel con los datos y un resumen en la carpeta excel/
(la misma que lee el dashboard, que se refresca solo). Para terminar:
desconecta el USB o presiona Ctrl+C.

Instalar una vez:   pip install pyserial openpyxl
Usar:               python registro_estacion.py

═══════════════════════════════════════════════════════════════════════════════
CONEXIONES DEL ARDUINO (estacion_ambiental_v3)
═══════════════════════════════════════════════════════════════════════════════

[SENSORES] — Según estacion_ambiental.ino v5

1. DHT11 (Temperatura + Humedad)
   ├─ DATA  → Pin 7
   ├─ VCC   → 5V
   └─ GND   → GND

2. HX711 + Celda de Carga (Peso del agua en gramos)
   ├─ DT (Data)  → Pin 4
   ├─ SCK (Clock) → Pin 5
   ├─ VCC → 5V
   └─ GND → GND

   Celda: Rojo E+, Negro E-, Blanco A-, Verde A+ (en HX711)

3. LCD 16x2 I2C (Pantalla — muestra T, H, y agua en GRAMOS)
   ├─ SDA → A4 (Pin 18)
   ├─ SCL → A5 (Pin 19)
   ├─ VCC → 5V
   └─ GND → GND

[FLUJO DE DATOS]

Arduino envía cada minuto → "minuto,temp_C,hum_%,gramos_totales,gramos_este_minuto"
                         ↓
                    Excel en excel/
                         ↓
                  Dashboard http://8000
                    ├─ Panel 3D
                    ├─ Gráficos
                    └─ Estadísticas

[UNIDADES EN EL DISPLAY]

Dashboard + Panel 3D: Gramos (números enteros, sin decimales)
  - 325 g (más legible que 0.325 L)
Excel: Ambos gramos y litros (precisión)
  - Columna 5: Gramos acumulados (g)
  - Columna 6: Litros acumulados (L)

═══════════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import time
from datetime import datetime
from pathlib import Path

import serial
import serial.tools.list_ports
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

VELOCIDAD = 9600
# Guarda los Excel en la carpeta excel/ que está junto a este script
CARPETA_SALIDA = Path(__file__).resolve().parent / "excel"


# ---------------------------------------------------------------------------
# 1. Encontrar el Arduino
# ---------------------------------------------------------------------------
def buscar_puerto():
    puertos = list(serial.tools.list_ports.comports())
    if not puertos:
        return None
    # Primero busca uno que parezca Arduino/CH340
    for p in puertos:
        texto = f"{p.description} {p.manufacturer or ''}".lower()
        if any(k in texto for k in ("arduino", "ch340", "usb-serial", "usb serial", "wch")):
            return p.device
    # Si hay uno solo, usa ese
    if len(puertos) == 1:
        return puertos[0].device
    # Si hay varios, pregunta
    print("Encontré varios puertos. ¿Cuál es el Arduino?")
    for i, p in enumerate(puertos, 1):
        print(f"  {i}. {p.device}  ({p.description})")
    while True:
        try:
            n = int(input("Escribe el número: "))
            if 1 <= n <= len(puertos):
                return puertos[n - 1].device
        except ValueError:
            pass


# ---------------------------------------------------------------------------
# 2. Crear el Excel
# ---------------------------------------------------------------------------
def crear_excel(filas, inicio, fin):
    wb = Workbook()

    # ----- Hoja 1: Datos -----
    ws = wb.active
    ws.title = "Datos"
    encabezados = ["Minuto", "Hora", "Temperatura (°C)", "Humedad (%)",
                   "Gramos acumulados (g)", "Litros acumulados (L)",
                   "Gramos en este minuto (g)", "Litros en este minuto (L)"]
    ws.append(encabezados)
    for f in filas:
        ws.append([f["minuto"], f["hora"], f["temp"], f["hum"],
                   f["ml"], round(f["ml"] / 1000, 3),
                   f["ml_min"], round(f["ml_min"] / 1000, 4)])

    estilo_encabezado(ws, len(encabezados))
    for col in range(1, len(encabezados) + 1):
        ws.column_dimensions[get_column_letter(col)].width = 18
    ws.freeze_panes = "A2"

    # ----- Hoja 2: Resumen -----
    rs = wb.create_sheet("Resumen")
    rs.append(["Concepto", "Valor"])
    estilo_encabezado(rs, 2)

    if filas:
        temps = [f["temp"] for f in filas]
        hums = [f["hum"] for f in filas]
        ml_final = filas[-1]["ml"]
        minutos = filas[-1]["minuto"]
        promedio_ml_min = ml_final / minutos if minutos else 0
        resumen = [
            ("Inicio", inicio.strftime("%Y-%m-%d %H:%M:%S")),
            ("Fin", fin.strftime("%Y-%m-%d %H:%M:%S")),
            ("Duración (minutos)", minutos),
            ("Gramos totales (g)", round(ml_final, 1)),
            ("Litros totales (L)", round(ml_final / 1000, 3)),
            ("Velocidad promedio (g/min)", round(promedio_ml_min, 2)),
            ("Velocidad promedio (L/hora)", round(promedio_ml_min * 60 / 1000, 3)),
            ("Tiempo estimado para 1 L (horas)",
             round(1000 / promedio_ml_min / 60, 2) if promedio_ml_min > 0 else "—"),
            ("Temperatura promedio (°C)", round(sum(temps) / len(temps), 1)),
            ("Temperatura mínima (°C)", min(temps)),
            ("Temperatura máxima (°C)", max(temps)),
            ("Humedad promedio (%)", round(sum(hums) / len(hums), 1)),
            ("Humedad mínima (%)", min(hums)),
            ("Humedad máxima (%)", max(hums)),
        ]
    else:
        resumen = [("Sin datos", "No llegó ningún minuto completo desde el Arduino")]

    for fila in resumen:
        rs.append(list(fila))
    rs.column_dimensions["A"].width = 36
    rs.column_dimensions["B"].width = 24

    nombre = f"estacion_{inicio.strftime('%Y-%m-%d_%H-%M')}.xlsx"
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    ruta = CARPETA_SALIDA / nombre
    # Se escribe aparte y se reemplaza de golpe: el dashboard nunca lee un Excel a medias
    temporal = ruta.with_suffix(".tmp")
    wb.save(temporal)
    os.replace(temporal, ruta)
    return ruta


def guardar_excel(filas, inicio, fin):
    # Reintenta: OneDrive o el dashboard pueden tener el archivo abierto un instante
    for _ in range(4):
        try:
            return crear_excel(filas, inicio, fin)
        except PermissionError:
            time.sleep(0.5)
    print("     (No pude actualizar el Excel: ¿lo tienes abierto en Excel? Ciérralo."
          " Los datos no se pierden, se guardan en el siguiente minuto.)")
    return None


def estilo_encabezado(ws, ncols):
    relleno = PatternFill("solid", fgColor="1F4E78")
    for col in range(1, ncols + 1):
        c = ws.cell(row=1, column=col)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = relleno
        c.alignment = Alignment(horizontal="center")


# ---------------------------------------------------------------------------
# 3. Leer una línea del Arduino y convertirla en datos
# ---------------------------------------------------------------------------
def interpretar(linea):
    """Espera: minuto,temp_C,hum_%,agua_total_mL,mL_por_minuto"""
    partes = linea.strip().split(",")
    if len(partes) != 5:
        return None
    try:
        return {
            "minuto": int(partes[0]),
            "temp": float(partes[1]),
            "hum": float(partes[2]),
            "ml": float(partes[3]),
            "ml_min": float(partes[4]),
            "hora": datetime.now().strftime("%H:%M:%S"),
        }
    except ValueError:
        return None   # era el encabezado u otra cosa


# ---------------------------------------------------------------------------
# 4. Programa principal
# ---------------------------------------------------------------------------
def main():
    puerto = buscar_puerto()
    if not puerto:
        print("No encontré el Arduino. Conéctalo por USB y cierra el Monitor Serie del IDE.")
        sys.exit(1)

    print(f"Conectando a {puerto}...")
    try:
        arduino = serial.Serial(puerto, VELOCIDAD, timeout=2)
    except serial.SerialException as e:
        print(f"No pude abrir {puerto}: {e}")
        print("¿Está abierto el Monitor Serie del Arduino IDE? Ciérralo e intenta de nuevo.")
        sys.exit(1)

    time.sleep(2)   # el Arduino se reinicia al abrir el puerto
    inicio = datetime.now()
    filas = []

    print("Grabando. Cada minuto verás una línea aquí y se actualiza el Excel en:")
    print(f"  {CARPETA_SALIDA}")
    print("Para terminar: desconecta el USB o presiona Ctrl+C.\n")
    print(f"{'Min':>4} {'Hora':>9} {'Temp':>6} {'Hum':>5} {'Gramos':>8} {'Litros':>8}")

    try:
        while True:
            try:
                cruda = arduino.readline()
            except (serial.SerialException, OSError):
                print("\nArduino desconectado.")
                break
            if not cruda:
                continue
            linea = cruda.decode("utf-8", errors="ignore")
            dato = interpretar(linea)
            if dato:
                filas.append(dato)
                print(f"{dato['minuto']:>4} {dato['hora']:>9} {dato['temp']:>6.1f} "
                      f"{dato['hum']:>5.0f} {dato['ml']:>8.1f} {dato['ml']/1000:>8.3f}")
                guardar_excel(filas, inicio, datetime.now())
    except KeyboardInterrupt:
        print("\nDetenido por el usuario.")
    finally:
        try:
            arduino.close()
        except Exception:
            pass

    fin = datetime.now()
    ruta = guardar_excel(filas, inicio, fin)
    if not ruta:
        return
    print(f"\nExcel creado: {ruta}")

    # Abrir el archivo automáticamente
    try:
        if sys.platform.startswith("win"):
            os.startfile(ruta)
        elif sys.platform == "darwin":
            os.system(f'open "{ruta}"')
        else:
            os.system(f'xdg-open "{ruta}"')
    except Exception:
        pass


if __name__ == "__main__":
    main()
