#!/usr/bin/env bash
# ===========================================
# AutoArt Database Management (Linux)
# ===========================================
# Usage:
#   ./scripts/db-verify.sh           - Interactive menu
#   ./scripts/db-verify.sh status    - Show database status
#   ./scripts/db-verify.sh reset     - Nuke and rebuild database
#   ./scripts/db-verify.sh repair    - Fix orphaned migrations
#   ./scripts/db-verify.sh verify    - Full verification test

set -euo pipefail

source "$(dirname "$0")/config.sh"

run_command() {
    local cmd="$1"
    cd "$BACKEND_DIR"

    case "$cmd" in
        status)
            echo -e "\nChecking database status..."
            pnpm db:status
            ;;
        migrate)
            echo -e "\nRunning migrations..."
            pnpm migrate
            ;;
        seed)
            echo -e "\nSeeding sample data..."
            pnpm seed:dev
            ;;
        reset)
            echo ""
            echo "WARNING: This will DESTROY ALL DATA!"
            echo ""
            read -rp "Type 'reset' to confirm: " confirm
            if [[ "$confirm" == "reset" ]]; then
                echo -e "\nNuking database..."
                pnpm db:nuke -- --force
                echo -e "\nRunning migrations..."
                pnpm migrate
                echo -e "\nSeeding data..."
                pnpm seed:dev
                echo -e "\nDatabase reset complete!"
            else
                echo "Aborted."
            fi
            ;;
        repair)
            echo -e "\nRepairing migrations..."
            pnpm db:repair
            ;;
        verify)
            echo ""
            echo "========================================"
            echo "  Full Verification Test"
            echo "========================================"
            echo ""
            echo "This will:"
            echo "  1. Drop all tables (destroy all data)"
            echo "  2. Re-run all migrations"
            echo "  3. Seed reference data"
            echo "  4. Verify the result"
            echo ""
            read -rp "Type 'verify' to continue: " confirm
            if [[ "$confirm" != "verify" ]]; then
                echo "Aborted."
                return
            fi

            echo -e "\n[1/4] Dropping all tables..."
            pnpm db:nuke -- --force

            echo -e "\n[2/4] Running migrations..."
            if ! pnpm migrate; then
                echo -e "\n[X] Migration failed!"
                return 1
            fi

            echo -e "\n[3/4] Seeding reference data..."
            if ! pnpm seed:dev; then
                echo -e "\n[X] Seeding failed!"
                return 1
            fi

            echo -e "\n[4/4] Verifying database..."
            pnpm db:status

            echo ""
            echo "========================================"
            echo "  Verification Complete!"
            echo "========================================"
            echo ""
            echo "Your database design is reproducible."
            echo "Ready for deployment to a fresh server."
            ;;
        *)
            echo "Unknown command: $cmd"
            return 1
            ;;
    esac

    cd "$PROJECT_DIR"
}

show_menu() {
    echo ""
    echo "========================================"
    echo "  AutoArt Database Management"
    echo "========================================"
    echo ""
    echo "  [1] status   - Show database status"
    echo "  [2] migrate  - Run pending migrations"
    echo "  [3] seed     - Seed sample data"
    echo "  [4] reset    - Nuke & rebuild (DESTROYS DATA)"
    echo "  [5] repair   - Fix orphaned migrations"
    echo "  [6] verify   - Full verification test"
    echo "  [q] quit"
    echo ""
}

# Direct command mode
if [[ $# -gt 0 ]]; then
    run_command "$1"
    exit $?
fi

# Interactive menu
while true; do
    show_menu
    read -rp "Select option: " choice
    case "$choice" in
        1|status)  run_command status ;;
        2|migrate) run_command migrate ;;
        3|seed)    run_command seed ;;
        4|reset)   run_command reset ;;
        5|repair)  run_command repair ;;
        6|verify)  run_command verify ;;
        q)         echo "Goodbye!"; exit 0 ;;
        *)         echo "Invalid option." ;;
    esac
done
