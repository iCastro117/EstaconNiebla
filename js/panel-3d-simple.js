// Panel 3D simple sin Three.js - usando Canvas 2D + CSS
function inicializarPanel3D(containerId, dataPath = 'panel_data.json') {
  const container = document.getElementById(containerId);
  if (!container) return;

  let panelData = {
    AVG_HUMIDITY: '59%',
    AVG_TEMP: '19.9°C',
    AVG_LITERS: '0.02 L'
  };

  fetch(dataPath)
    .then(r => r.json())
    .then(data => { panelData = data; renderPanel3D(); })
    .catch(() => renderPanel3D());

  function renderPanel3D() {
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = 'linear-gradient(135deg, rgba(100,50,150,0.1) 0%, rgba(50,100,150,0.1) 100%)';

    container.innerHTML = `
      <div style="text-align:center; width:80%; max-width:500px;">
        <div style="
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          border: 3px solid #8B7CF6;
        ">
          <div style="
            font-size: 48px;
            margin-bottom: 10px;
          ">🌫️</div>

          <h2 style="
            color: #2c2a45;
            margin: 0 0 30px 0;
            font-size: 24px;
            font-weight: 600;
          ">Panel 3D de Estación</h2>

          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            margin-top: 25px;
          ">
            <div style="
              background: linear-gradient(135deg, #F0A24B 0%, #E08340 100%);
              padding: 20px;
              border-radius: 15px;
              color: white;
              box-shadow: 0 8px 20px rgba(240,162,75,0.3);
            ">
              <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">TEMPERATURA</div>
              <div style="font-size: 28px; font-weight: 700;">${panelData.AVG_TEMP}</div>
            </div>

            <div style="
              background: linear-gradient(135deg, #4CA6E6 0%, #3A96D6 100%);
              padding: 20px;
              border-radius: 15px;
              color: white;
              box-shadow: 0 8px 20px rgba(76,166,230,0.3);
            ">
              <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">HUMEDAD</div>
              <div style="font-size: 28px; font-weight: 700;">${panelData.AVG_HUMIDITY}</div>
            </div>

            <div style="
              background: linear-gradient(135deg, #8B7CF6 0%, #7B6CE6 100%);
              padding: 20px;
              border-radius: 15px;
              color: white;
              box-shadow: 0 8px 20px rgba(139,124,246,0.3);
            ">
              <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">LITROS</div>
              <div style="font-size: 28px; font-weight: 700;">${panelData.AVG_LITERS}</div>
            </div>
          </div>

          <div style="
            margin-top: 25px;
            padding-top: 20px;
            border-top: 2px solid #E8E5F5;
            font-size: 12px;
            color: #7B7D95;
          ">
            <div>Estación de Niebla</div>
            <div style="margin-top: 5px; opacity: 0.7;">Promedio de mediciones</div>
          </div>
        </div>
      </div>
    `;

    // Agregar animación de entrada
    const styles = document.createElement('style');
    styles.textContent = `
      @keyframes fadeInScale {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      #${containerId} > div {
        animation: fadeInScale 0.6s ease-out;
      }
    `;
    document.head.appendChild(styles);
  }
}
