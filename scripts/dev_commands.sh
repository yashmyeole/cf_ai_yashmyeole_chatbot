#!/bin/bash
# cf_ai_chatbot - Useful development and deployment commands
# Run from project root: bash scripts/dev_commands.sh

set -e

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to print section headers
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Helper function to print success messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Helper function to print warnings
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Display menu
show_menu() {
    echo ""
    echo -e "${BLUE}cf_ai_chatbot - Development Commands${NC}"
    echo "Choose an option:"
    echo "  1. Start local development server (wrangler dev)"
    echo "  2. Set OPENAI_API_KEY secret (local)"
    echo "  3. Set OPENAI_API_KEY secret (production)"
    echo "  4. Test /api/chat endpoint with cURL"
    echo "  5. Test /api/history endpoint with cURL"
    echo "  6. Deploy Worker to production"
    echo "  7. Deploy Pages to production"
    echo "  8. View Worker logs"
    echo "  9. Install dependencies"
    echo "  10. Run all tests (curl)"
    echo "  0. Exit"
    echo ""
}

# 1. Start local dev server
dev_start() {
    print_header "Starting local development server"
    echo "Note: The app will be available at http://localhost:8787"
    echo "Press Ctrl+C to stop."
    echo ""
    wrangler dev
}

# 2. Set OpenAI secret locally
set_secret_local() {
    print_header "Setting OPENAI_API_KEY (local development)"
    print_warning "This secret will only be available during local development"
    wrangler secret put OPENAI_API_KEY --local
    print_success "Secret set for local development"
}

# 3. Set OpenAI secret for production
set_secret_prod() {
    print_header "Setting OPENAI_API_KEY (production)"
    print_warning "This secret will be available in your deployed Worker"
    echo "You will be prompted to paste your OpenAI API key."
    echo "The key will not be displayed for security."
    wrangler secret put OPENAI_API_KEY
    print_success "Secret set for production"
}

# 4. Test chat endpoint
test_chat() {
    print_header "Testing POST /api/chat"
    echo "Sending a test message..."
    echo ""

    RESPONSE=$(curl -s -X POST http://localhost:8787/api/chat \
        -H "Content-Type: application/json" \
        -d '{"userId":"test_user","message":"Hello! Tell me a short joke."}')

    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""
}

# 5. Test history endpoint
test_history() {
    print_header "Testing GET /api/history"
    echo "Fetching conversation history for test_user..."
    echo ""

    RESPONSE=$(curl -s -X GET "http://localhost:8787/api/history?userId=test_user")

    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""
}

# 6. Deploy Worker
deploy_worker() {
    print_header "Deploying Worker to production"
    print_warning "Make sure OPENAI_API_KEY is set: wrangler secret put OPENAI_API_KEY"
    echo "Deploying..."
    wrangler publish
    print_success "Worker deployed!"
    echo "Check your Cloudflare dashboard for the deployed Worker URL."
}

# 7. Deploy Pages
deploy_pages() {
    print_header "Deploying Pages static site"
    echo "Deploying frontend from pages/ directory..."
    wrangler pages deploy pages/
    print_success "Pages deployed!"
}

# 8. View logs
view_logs() {
    print_header "Viewing recent Worker logs"
    wrangler logs
}

# 9. Install dependencies
install_deps() {
    print_header "Installing npm dependencies"
    npm install
    print_success "Dependencies installed"
}

# 10. Run all tests
run_all_tests() {
    print_header "Running all API tests"
    echo ""
    echo "Note: Make sure 'wrangler dev' is running in another terminal"
    echo ""

    # Give user time to confirm
    echo -n "Press Enter to continue, or Ctrl+C to cancel..."
    read

    echo ""
    test_chat
    echo ""
    test_history
    echo ""
    print_success "All tests completed"
}

# Main loop
if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read -p "Select option: " choice

        case $choice in
            1)
                dev_start
                ;;
            2)
                set_secret_local
                ;;
            3)
                set_secret_prod
                ;;
            4)
                test_chat
                ;;
            5)
                test_history
                ;;
            6)
                deploy_worker
                ;;
            7)
                deploy_pages
                ;;
            8)
                view_logs
                ;;
            9)
                install_deps
                ;;
            10)
                run_all_tests
                ;;
            0)
                echo "Exiting..."
                exit 0
                ;;
            *)
                print_warning "Invalid option. Please try again."
                ;;
        esac
    done
else
    # Command line mode
    case "$1" in
        dev)
            dev_start
            ;;
        secret:local)
            set_secret_local
            ;;
        secret:prod)
            set_secret_prod
            ;;
        test:chat)
            test_chat
            ;;
        test:history)
            test_history
            ;;
        deploy:worker)
            deploy_worker
            ;;
        deploy:pages)
            deploy_pages
            ;;
        logs)
            view_logs
            ;;
        install)
            install_deps
            ;;
        test:all)
            run_all_tests
            ;;
        *)
            echo "Usage: $0 [dev|secret:local|secret:prod|test:chat|test:history|deploy:worker|deploy:pages|logs|install|test:all]"
            echo "Or run without arguments for interactive menu"
            exit 1
            ;;
    esac
fi
