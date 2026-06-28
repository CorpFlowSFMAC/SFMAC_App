#!/bin/bash
# =============================================================================
# SCRIPT DE REINICIO DEL MICROSERVICIO WHATSAPP
# =============================================================================
# Este script debe ejecutarse en el servidor Hetzner (87.99.137.96)
# Ubicación sugerida: /opt/sinfimac/whatsapp-bridge/
#
# USO:
#   ./restart-whatsapp-service.sh [opcion]
#
# OPCIONES:
#   start     - Iniciar el servicio
#   stop      - Detener el servicio
#   restart   - Reiniciar el servicio
#   status    - Verificar estado
#   logs      - Ver logs recientes
#   qr        - Mostrar código QR actual
# =============================================================================

set -e

# Configuración
SERVICE_NAME="sinfimac-whatsapp"
SERVICE_DIR="/opt/sinfimac/whatsapp-bridge"
LOG_FILE="/var/log/whatsapp-bridge.log"
PID_FILE="/var/run/whatsapp-bridge.pid"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el servidor correcto
check_server() {
    if [ "$(hostname -I | awk '{print $1}')" != "87.99.137.96" ]; then
        log_warn "Este script está diseñado para ejecutarse en el servidor Hetzner (87.99.137.96)"
        log_warn "Servidor actual: $(hostname -I)"
    fi
}

# Verificar que el directorio del servicio existe
check_service_dir() {
    if [ ! -d "$SERVICE_DIR" ]; then
        log_error "Directorio de servicio no encontrado: $SERVICE_DIR"
        log_info "Creando directorio..."
        sudo mkdir -p "$SERVICE_DIR"
        log_info "Directorio creado. Asegúrate de copiar los archivos del servicio."
    fi
}

# Iniciar el servicio
start_service() {
    log_info "Iniciando servicio WhatsApp Bridge..."
    
    cd "$SERVICE_DIR"
    
    # Verificar si ya está corriendo
    if pgrep -f "whatsapp-bridge" > /dev/null; then
        log_warn "El servicio ya está corriendo"
        return 0
    fi
    
    # Iniciar con PM2 (preferido) o directamente
    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js --env production 2>/dev/null || \
        pm2 start "node src/index.js" --name "$SERVICE_NAME"
    else
        log_warn "PM2 no encontrado, iniciando directamente..."
        nohup node src/index.js > "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
    fi
    
    sleep 2
    
    # Verificar que está corriendo
    if pgrep -f "whatsapp-bridge" > /dev/null; then
        log_info "✅ Servicio iniciado exitosamente"
    else
        log_error "❌ Error al iniciar el servicio"
        exit 1
    fi
}

# Detener el servicio
stop_service() {
    log_info "Deteniendo servicio WhatsApp Bridge..."
    
    if pgrep -f "whatsapp-bridge" > /dev/null; then
        if command -v pm2 &> /dev/null; then
            pm2 stop "$SERVICE_NAME" 2>/dev/null || pm2 delete "$SERVICE_NAME" 2>/dev/null
        else
            pkill -f "whatsapp-bridge" || true
            rm -f "$PID_FILE"
        fi
        log_info "✅ Servicio detenido"
    else
        log_warn "El servicio no está corriendo"
    fi
}

# Reiniciar el servicio
restart_service() {
    log_info "Reiniciando servicio WhatsApp Bridge..."
    stop_service
    sleep 2
    start_service
    
    # Mostrar estado después de reiniciar
    sleep 3
    check_status
}

# Verificar estado del servicio
check_status() {
    log_info "Verificando estado del servicio..."
    
    # Verificar proceso
    if pgrep -f "whatsapp-bridge" > /dev/null; then
        log_info "✅ Proceso activo (PID: $(pgrep -f 'whatsapp-bridge' | head -1))"
    else
        log_error "❌ Proceso no encontrado"
    fi
    
    # Verificar endpoint de salud
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ | grep -q "200"; then
        STATUS=$(curl -s http://localhost:3001/ | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        log_info "✅ Endpoint de salud responde (status: $STATUS)"
    else
        log_error "❌ Endpoint de salud no responde"
    fi
}

# Ver logs recientes
show_logs() {
    log_info "Logs recientes (últimas 20 líneas)..."
    
    if [ -f "$LOG_FILE" ]; then
        tail -20 "$LOG_FILE"
    else
        if command -v pm2 &> /dev/null; then
            pm2 logs "$SERVICE_NAME" --lines 20 --nostream
        else
            log_warn "No se encontraron logs"
        fi
    fi
}

# Mostrar QR code
show_qr() {
    log_info "Obteniendo código QR..."
    
    QR_RESPONSE=$(curl -s http://localhost:3001/qr.png -o /tmp/whatsapp_qr.png -w "%{http_code}")
    
    if [ "$QR_RESPONSE" = "200" ]; then
        log_info "✅ QR code obtenido"
        log_info "El QR se ha guardado en: /tmp/whatsapp_qr.png"
        log_info ""
        log_info "Para ver el QR en la terminal (requiere programa de visualización):"
        log_info "  cat /tmp/whatsapp_qr.png | base64 | xclip -selection clipboard"
        log_info ""
        log_info "O transfiere el archivo a tu máquina local:"
        log_info "  scp root@87.99.137.96:/tmp/whatsapp_qr.png ./whatsapp_qr.png"
    else
        log_error "No se pudo obtener el QR code (HTTP $QR_RESPONSE)"
    fi
}

# Mostrar ayuda
show_help() {
    echo "Uso: $0 [opcion]"
    echo ""
    echo "Opciones:"
    echo "  start     - Iniciar el servicio"
    echo "  stop      - Detener el servicio"
    echo "  restart   - Reiniciar el servicio"
    echo "  status    - Verificar estado"
    echo "  logs      - Ver logs recientes"
    echo "  qr        - Mostrar código QR actual"
    echo "  help      - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 restart     # Reiniciar el servicio"
    echo "  $0 status      # Verificar si está corriendo"
    echo "  $0 qr          # Obtener el código QR para escanear"
}

# =============================================================================
# MAIN
# =============================================================================

check_server

case "${1:-status}" in
    start)
        check_service_dir
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        check_service_dir
        restart_service
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    qr)
        show_qr
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Opción desconocida: $1"
        show_help
        exit 1
        ;;
esac