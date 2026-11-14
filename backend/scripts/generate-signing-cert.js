'use strict';

/**
 * Generates the signing key pair and a self-signed X.509 certificate for RupeeRise.
 *
 *   npm run gen:cert
 *
 * Output:
 *   backend/certs/signing.key.pem   PRIVATE key  - never commit, never share
 *   backend/certs/signing.cert.pem  public certificate (safe to publish)
 *
 * It also prints one-line values you can paste into Render / .env:
 *   SIGN_PRIVATE_KEY=<base64>   SIGN_CERT_PEM=<base64>
 *
 * Options (environment variables):
 *   CERT_KEY_TYPE=rsa|ec   (default rsa)      CERT_DAYS=730 (validity, default 730)
 */

const fs = require('fs');
const path = require('path');

async function generateSigningMaterial(options = {}) {
  const selfsigned = require('selfsigned'); // devDependency - only needed to create a certificate
  const keyType = options.keyType || process.env.CERT_KEY_TYPE || 'rsa';
  const days = Number(options.days || process.env.CERT_DAYS || 730);
  const notBeforeDate = new Date();
  const notAfterDate = new Date(notBeforeDate.getTime() + days * 24 * 60 * 60 * 1000);

  const attrs = [
    { name: 'commonName', value: 'RupeeRise Document Signing' },
    { name: 'organizationName', value: 'RupeeRise' },
    { name: 'countryName', value: 'IN' },
  ];

  const pems = await selfsigned.generate(attrs, {
    keyType,
    keySize: 2048,
    curve: 'P-256',
    algorithm: 'sha256', // selfsigned defaults to SHA-1, so SHA-256 is requested explicitly
    notBeforeDate,
    notAfterDate,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
    ],
  });

  return { privateKeyPem: pems.private, certPem: pems.cert, fingerprint: pems.fingerprint, notAfterDate };
}

async function main() {
  const dir = path.join(__dirname, '..', 'certs');
  const keyFile = path.join(dir, 'signing.key.pem');
  const certFile = path.join(dir, 'signing.cert.pem');

  if ((fs.existsSync(keyFile) || fs.existsSync(certFile)) && process.argv[2] !== '--force') {
    console.error('A signing key/certificate already exists in backend/certs/.');
    console.error('Re-generating would make every previously signed document fail verification.');
    console.error('Run again with --force only if you really want to replace them.');
    process.exit(1);
  }

  const { privateKeyPem, certPem, notAfterDate } = await generateSigningMaterial();
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(keyFile, privateKeyPem, { mode: 0o600 });
  fs.writeFileSync(certFile, certPem);

  const { X509Certificate } = require('crypto');
  const x509 = new X509Certificate(certPem);

  console.log('Signing certificate created');
  console.log('  Private key : ' + keyFile + '   (keep secret)');
  console.log('  Certificate : ' + certFile);
  console.log('  Valid until : ' + notAfterDate.toISOString().split('T')[0]);
  console.log('  SHA-256 fingerprint: ' + x509.fingerprint256);
  console.log('');
  console.log('For Render / production, add these environment variables (single-line base64):');
  console.log('SIGN_PRIVATE_KEY=' + Buffer.from(privateKeyPem).toString('base64'));
  console.log('SIGN_CERT_PEM=' + Buffer.from(certPem).toString('base64'));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to generate certificate:', err.message);
    process.exit(1);
  });
}

module.exports = { generateSigningMaterial };
