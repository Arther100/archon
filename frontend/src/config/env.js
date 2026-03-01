// All env variable access — never use import.meta.env directly in components
export const ENV = {
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
}
