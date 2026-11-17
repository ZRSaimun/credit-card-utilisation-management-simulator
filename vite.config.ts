import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/credit-card-utilisation-management-simulator/',plugins:[react()],server:{proxy:{'/api':'http://localhost:4173'}}});
