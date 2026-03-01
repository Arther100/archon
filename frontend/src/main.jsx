// main.jsx — React entry point
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './i18n'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <ThemeProvider>
                <LanguageProvider>
                    <App />
                </LanguageProvider>
            </ThemeProvider>
        </AuthProvider>
    </React.StrictMode>
)
