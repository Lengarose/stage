import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

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
