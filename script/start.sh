#!/bin/bash

# ===========================================
# Alien Fit Backend - Docker Startup Script
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default environment
ENV_FILE=".env"

# ===========================================
# Functions
# ===========================================

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════╗"
    echo "║        Alien Fit Backend Launcher        ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"
    
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    print_success "Docker Compose is installed"
}

check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found!"
        if [ -f ".env.example" ]; then
            print_info "Creating .env from .env.example..."
            cp .env.example .env
            print_warning "Please edit .env file with your actual configuration values!"
            exit 1
        else
            print_error "No .env.example file found. Please create a .env file."
            exit 1
        fi
    fi
    print_success "Environment file found: $ENV_FILE"
}

show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start       Start all services (default)"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  build       Build/rebuild the application"
    echo "  logs        Show logs (use -f for follow)"
    echo "  status      Show status of all services"
    echo "  clean       Stop and remove all containers, volumes, and images"
    echo "  db-shell    Open PostgreSQL shell"
    echo "  app-shell   Open shell in app container"
    echo "  migrate     Run database migrations"
    echo "  migrate:down Revert last migration"
    echo "  migrate:status Show migration status"
    echo ""
    echo "Options:"
    echo "  -e, --env FILE    Use specified env file (default: .env)"
    echo "  -d, --detach      Run in detached mode"
    echo "  -f, --follow      Follow log output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start with default .env"
    echo "  $0 start -e .env.prod       # Start with production env"
    echo "  $0 logs -f                  # Follow logs"
    echo "  $0 build                    # Rebuild application"
    echo "  $0 migrate                  # Run migrations"
}

start_services() {
    local detach_flag=""
    if [ "$DETACH" = true ]; then
        detach_flag="-d"
    fi
    
    print_info "Starting services with $ENV_FILE..."
    docker compose --env-file "$ENV_FILE" up $detach_flag --build
    
    if [ "$DETACH" = true ]; then
        print_success "Services started in background"
        echo ""
        print_info "Useful commands:"
        echo "  ./start.sh logs -f     # View logs"
        echo "  ./start.sh status      # Check status"
        echo "  ./start.sh stop        # Stop services"
    fi
}

stop_services() {
    print_info "Stopping services..."
    docker compose --env-file "$ENV_FILE" down
    print_success "Services stopped"
}

restart_services() {
    print_info "Restarting services..."
    docker compose --env-file "$ENV_FILE" restart
    print_success "Services restarted"
}

build_services() {
    print_info "Building services..."
    docker compose --env-file "$ENV_FILE" build --no-cache
    print_success "Build complete"
}

show_logs() {
    local follow_flag=""
    if [ "$FOLLOW" = true ]; then
        follow_flag="-f"
    fi
    docker compose --env-file "$ENV_FILE" logs $follow_flag
}

show_status() {
    print_info "Service Status:"
    docker compose --env-file "$ENV_FILE" ps
}

clean_all() {
    print_warning "This will remove all containers, volumes, and images!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cleaning up..."
        docker compose --env-file "$ENV_FILE" down -v --rmi all
        print_success "Cleanup complete"
    else
        print_info "Cleanup cancelled"
    fi
}

db_shell() {
    print_info "Connecting to PostgreSQL..."
    docker compose --env-file "$ENV_FILE" exec db psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-alien-fit}"
}

app_shell() {
    print_info "Opening shell in app container..."
    docker compose --env-file "$ENV_FILE" exec app sh
}

run_migrations() {
    print_info "Running database migrations..."
    docker compose --env-file "$ENV_FILE" exec app npm run migration:up
    print_success "Migrations completed"
}

revert_migration() {
    print_info "Reverting last migration..."
    docker compose --env-file "$ENV_FILE" exec app npm run migration:down
    print_success "Migration reverted"
}

migration_status() {
    print_info "Migration status:"
    docker compose --env-file "$ENV_FILE" exec app npm run migration:status
}

# ===========================================
# Main Script
# ===========================================

# Parse arguments
COMMAND="start"
DETACH=true
FOLLOW=false

while [[ $# -gt 0 ]]; do
    case $1 in
        start|stop|restart|build|logs|status|clean|db-shell|app-shell)
            COMMAND="$1"
            shift
            ;;
        -e|--env)
            ENV_FILE="$2"
            shift 2
            ;;
        -d|--detach)
            DETACH=true
            shift
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run
print_banner
check_dependencies
check_env_file

case $COMMAND in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    build)
        build_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    clean)
        clean_all
        ;;
    db-shell)
        db_shell
        ;;
    app-shell)
        app_shell
        ;;
    migrate)
        run_migrations
        ;;
    migrate:down)
        revert_migration
        ;;
    migrate:status)
        migration_status
        ;;
esac
