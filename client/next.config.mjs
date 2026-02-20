/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // Allow GitHub avatar images served by avatars.githubusercontent.com
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
            },
        ],
    },
};

export default nextConfig;
