import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // මෙන්න මේ පේළිය තමයි වැදගත්ම. 
        // ඔයාගේ electron folder එකේ තියෙන file එකේ නම මෙතනට දෙන්න.
        entry: 'electron/main.js', 
      },
    ]),
    renderer(),
  ],
})