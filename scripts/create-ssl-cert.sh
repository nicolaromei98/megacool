#!/bin/bash

# Create certs directory if it doesn't exist
mkdir -p certs

# Create a config file for the certificate
cat > certs/localhost.conf << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=Local
L=Local
O=Local Development
OU=IT Department
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate the private key
openssl genrsa -out certs/localhost-key.pem 2048

# Generate the certificate with the config
openssl req -new -x509 -key certs/localhost-key.pem -out certs/localhost.pem -days 365 -config certs/localhost.conf -extensions v3_req

echo "✅ SSL certificates generated successfully!"
echo "📋 To trust the certificate in Safari:"
echo "   1. Open Keychain Access"
echo "   2. Drag 'certs/localhost.pem' into the 'System' keychain"
echo "   3. Double-click the certificate and set it to 'Always Trust'"
echo "   4. Restart Safari"
echo ""
echo "Alternatively, you can run:"
echo "   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/localhost.pem" 