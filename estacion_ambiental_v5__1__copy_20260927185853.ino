/*
  ESTACIÓN v5: Temperatura + Humedad + Agua en GRAMOS (por peso)
  Pantalla LCD 16x2 con módulo I2C

  CONEXIONES:
    DHT11      -> DATA en pin 7, VCC en 5V, GND en GND
    HX711      -> DT en pin 4, SCK en pin 5, VCC en 5V, GND en GND
    Celda      -> rojo E+, negro E-, blanco A-, verde A+ (en el HX711)
    LCD I2C    -> SDA en A4, SCL en A5, VCC en 5V, GND en GND

  LIBRERÍAS (Administrar bibliotecas):
    - DHT sensor library (Adafruit) + Adafruit Unified Sensor
    - LiquidCrystal I2C (Frank de Brabander)
    - HX711 Arduino Library (Bogdan Necula)

  AL ENCENDER: deja el vaso VACÍO sobre la balanza y no lo toques
  durante 3 segundos. Ahí se pone en cero (tara).

  PANTALLA:
    Línea 1: T:22.5C H:65%
    Línea 2: Agua: 325 g
    
    1 gramo de agua = 1 mL = 0,001 L
*/

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include "HX711.h"

// ---------- Pines ----------
#define PIN_DHT    7
#define TIPO_DHT   DHT11
#define PIN_HX_DT  4
#define PIN_HX_SCK 5

// ---------- Calibración de la balanza ----------
// Si con 200 g (200 mL) de agua marca 260, el nuevo factor es 420 * (260 / 200)
float FACTOR_CALIBRACION = 420.0;

// Si la pantalla no muestra nada, cambia 0x27 por 0x3F
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(PIN_DHT, TIPO_DHT);
HX711 balanza;

// ---------- Variables ----------
float gramos       = 0;   // lo que mide la celda
float temperatura  = 0;
float humedad      = 0;

float gramosHaceUnMinuto = 0;
float gramosEnEsteminuto = 0;
unsigned int minutos     = 0;

unsigned long ultimaLectura = 0;
unsigned long ultimoMinuto  = 0;
const unsigned long UN_SEGUNDO = 1000;
const unsigned long UN_MINUTO  = 60000;

void setup() {
  Serial.begin(9600);
  dht.begin();

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Vaso vacio...");
  lcd.setCursor(0, 1);
  lcd.print("no tocar");

  balanza.begin(PIN_HX_DT, PIN_HX_SCK);
  delay(3000);
  balanza.set_scale(FACTOR_CALIBRACION);
  balanza.tare();                       // cero con el vaso vacío

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Listo!");
  delay(1000);
  lcd.clear();

  ultimoMinuto = millis();
  Serial.println("minuto,temp_C,hum_%,agua_total_mL,mL_por_minuto");
}

void loop() {
  unsigned long ahora = millis();

  // ---------- Cada segundo: leer y mostrar ----------
  if (ahora - ultimaLectura >= UN_SEGUNDO) {
    ultimaLectura = ahora;

    // Peso en gramos
    if (balanza.is_ready()) {
      float g = balanza.get_units(5);   // promedio de 5 lecturas
      if (g < 0) g = 0;
      gramos = g;
    }

    // Temperatura y humedad
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
      humedad = h;
      temperatura = t;
    }

    // Pantalla: TEMPERATURA Y HUMEDAD en línea 1
    lcd.setCursor(0, 0);
    lcd.print("T:");
    lcd.print(temperatura, 1);
    lcd.print("C H:");
    lcd.print(humedad, 0);
    lcd.print("%   ");

    // Pantalla: AGUA EN GRAMOS en línea 2
    lcd.setCursor(0, 1);
    lcd.print("Agua:");
    if (gramos < 10) {
      lcd.print("  ");  // 2 espacios si es de 1 dígito (0-9)
    } else if (gramos < 100) {
      lcd.print(" ");   // 1 espacio si es de 2 dígitos (10-99)
    }
    lcd.print((int)gramos);    // imprime solo la parte entera (sin decimales)
    lcd.print(" g    ");       // "g" de gramos
  }

  // ---------- Cada minuto: enviar al PC (para el Excel) ----------
  if (ahora - ultimoMinuto >= UN_MINUTO) {
    ultimoMinuto = ahora;
    minutos++;

    gramosEnEsteminuto = gramos - gramosHaceUnMinuto;
    if (gramosEnEsteminuto < 0) gramosEnEsteminuto = 0;
    gramosHaceUnMinuto = gramos;

    Serial.print(minutos);
    Serial.print(",");
    Serial.print(temperatura, 1);
    Serial.print(",");
    Serial.print(humedad, 0);
    Serial.print(",");
    Serial.print(gramos, 1);              // total en mL (= gramos)
    Serial.print(",");
    Serial.println(gramosEnEsteminuto, 1);  // gramos que entraron este minuto
  }
}
