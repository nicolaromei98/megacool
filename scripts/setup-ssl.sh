#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔧 Setting up SSL certificates with mkcert...${NC}"

# Check if mkcert is installed
if ! pnpm list mkcert > /dev/null; then
    echo -e "${RED}❌ mkcert is not installed.${NC}"
    echo -e "${YELLOW}Installing mkcert...${NC}"
    pnpm install
fi

# Debug: Show mkcert version
echo -e "${YELLOW}Using mkcert version:${NC}"
pnpm exec mkcert --version

# Create certs directory
mkdir -p certs

# Create and install the local CA (this makes certificates trusted by browsers)
echo -e "${YELLOW}🔐 Creating and installing local Certificate Authority...${NC}"
pnpm exec mkcert create-ca

# Move CA files to certs directory
mv ca.key certs/
mv ca.crt certs/

# Install the CA certificate into the system trust store
echo -e "${YELLOW}🔐 Installing CA certificate into system trust store...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/ca.crt
    
    # Also install for Chrome on macOS
    echo -e "${YELLOW}🔐 Installing CA certificate for Chrome...${NC}"
    sudo security add-trusted-cert -d -r trustRoot -k ~/Library/Application\ Support/Google/Chrome/Certificates/ca.crt certs/ca.crt
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    sudo cp certs/ca.crt /usr/local/share/ca-certificates/
    sudo update-ca-certificates
else
    echo -e "${RED}❌ Unsupported operating system for automatic CA installation${NC}"
    echo -e "${YELLOW}Please install the CA certificate manually:${NC}"
    echo -e "${YELLOW}1. Open certs/ca.crt in your browser${NC}"
    echo -e "${YELLOW}2. Install it as a trusted root certificate${NC}"
fi

# Generate certificates for localhost
echo -e "${YELLOW}📜 Generating certificates for localhost...${NC}"
pnpm exec mkcert create-cert --key certs/localhost-key.pem --cert certs/localhost.pem --ca-key certs/ca.key --ca-cert certs/ca.crt localhost 127.0.0.1 ::1

# Verify the certificates
echo -e "${YELLOW}🔍 Verifying certificates...${NC}"
openssl verify -CAfile certs/ca.crt certs/localhost.pem

echo -e "${GREEN}✅ SSL certificates generated successfully!${NC}"
echo -e "${GREEN}🎉 Your development server will now work with HTTPS in Safari and all other browsers.${NC}"
echo ""
echo -e "${YELLOW}Note: The certificates are automatically trusted by your system.${NC}"
echo -e "${YELLOW}If you ever need to remove the CA, you'll need to remove it from your system's trust store manually.${NC}"
echo ""
echo -e "${YELLOW}If you still have issues with Chrome:${NC}"
echo -e "${YELLOW}1. Open Chrome and go to chrome://settings/security${NC}"
echo -e "${YELLOW}2. Click on 'Manage certificates'${NC}"
echo -e "${YELLOW}3. Go to the 'Authorities' tab${NC}"
echo -e "${YELLOW}4. Click 'Import' and select certs/ca.crt${NC}"
echo -e "${YELLOW}5. Check 'Trust this certificate for identifying websites'${NC}" 