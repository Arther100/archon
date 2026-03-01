// app.js — Single source of truth for app-wide constants
// Import this wherever you need app name, tagline, URLs, etc.
import { APP_VERSION, APP_CODENAME } from './version'
import { ENV } from './env'

export const APP = {
    // Identity
    name: APP_CODENAME || 'Archon',
    tagline: 'From Requirements to Architecture. With Precision.',
    description:
        'Archon transforms complex requirement documents into structured system blueprints — exposing gaps, mapping module connectivity, and generating API-ready architecture without assumptions.',
    version: APP_VERSION || '3.0.0',

    // URLs
    siteUrl: import.meta.env.VITE_SITE_URL || 'https://archon-frontend-bukh.onrender.com',
    apiUrl: ENV.API_URL,

    // Branding
    faviconUrl: '/favicon.svg',
    logoUrl: '/logo.png',

    // Footer
    footer: `Archon · From Requirements to Architecture. With Precision.`,
    copyright: `© ${new Date().getFullYear()} Archon. All rights reserved.`,
}
