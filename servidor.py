"""
servidor.py — abre el dashboard en http://localhost:8000

Siempre sirve la carpeta donde está este archivo (aunque lo lances desde otra)
y no arranca si ya hay otro servidor en el puerto: en Windows dos servidores
pueden compartir el puerto 8000 y la página lee datos del equivocado.

Usar:  python servidor.py
"""

import http.server
import socket
import sys
import webbrowser
from functools import partial
from pathlib import Path

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
CARPETA = Path(__file__).resolve().parent


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass  # la página consulta excel/ cada 4 s; no llenar la ventana de líneas


class Servidor(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = False

    def server_bind(self):
        # IPv4 e IPv6 a la vez, para que "localhost" no pueda caer en otro servidor
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    try:
        servidor = Servidor(("::", PUERTO), partial(SinCache, directory=str(CARPETA)))
    except OSError:
        print(f"\nEl puerto {PUERTO} ya está ocupado: hay otro servidor abierto.")
        print("Cierra las otras ventanas de CMD donde corriste un servidor y vuelve a intentar.")
        sys.exit(1)

    url = f"http://localhost:{PUERTO}"
    print(f"Dashboard en {url}")
    print(f"Sirviendo: {CARPETA}")
    print("Deja esta ventana abierta. Para apagar: Ctrl+C o cerrar la ventana.")
    webbrowser.open(url)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
