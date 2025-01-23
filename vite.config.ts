import { defineConfig } from 'vite'
import singleFileCompression from 'vite-plugin-singlefile-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [singleFileCompression()],
})
