import os from 'node:os';

const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter(
    (address) =>
      address &&
      address.family === 'IPv4' &&
      !address.internal &&
      (/^10\./.test(address.address) ||
        /^192\.168\./.test(address.address) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(address.address)),
  )
  .map((address) => address.address);

if (addresses.length === 0) {
  console.log('[LAN] No private IPv4 address was found. Connect to Wi-Fi and try again.');
} else {
  for (const address of [...new Set(addresses)]) {
    console.log(`[LAN] Friends on the same Wi-Fi can open http://${address}:5173`);
  }
}

console.log('[LAN] If Windows asks, allow Node.js on Private networks only.');
