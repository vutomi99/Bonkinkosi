/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16 blocks dev-server resources (JS chunks, HMR) for any origin other
  // than localhost. Allow this machine's LAN IP and its VirtualBox host-only
  // IP so `npm run dev:lan` works when opened via either address.
  allowedDevOrigins: ["192.168.18.25", "192.168.56.1"],
};

module.exports = nextConfig;
