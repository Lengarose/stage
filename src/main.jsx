import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/registerFonts.js'
import App from '@/App.jsx'
import '@/index.css'
import 'sweetalert2/dist/sweetalert2.min.css'

const STAGE_THEME_IDS = ['theme-dark', 'theme-light', 'theme-video', 'theme-white', 'theme-red', 'theme-custom']
const savedTheme = localStorage.getItem('stage-theme') || 'theme-dark'
const html = document.documentElement
STAGE_THEME_IDS.forEach((id) => html.classList.remove(id))
html.classList.add(savedTheme)
if (['theme-dark', 'theme-red', 'theme-video'].includes(savedTheme)) html.classList.add('dark')
else html.classList.remove('dark')

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
