/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // This workspace's jsdom environment initialises slowly (Windows); keep a
    // generous per-test budget to avoid spurious timeouts.
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        // Only source files are instrumented — non-TS artifacts (README.md,
        // .json, docs) are never matched, so coverage runs cannot fail on
        // parsing Markdown as source.
        'src/components/common/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/components/patients/**/*.{ts,tsx}',
        'src/pages/patients/**/*.{ts,tsx}',
        'src/components/appointments/**/*.{ts,tsx}',
        'src/pages/appointments/**/*.{ts,tsx}',
        'src/services/patientService.ts',
        'src/services/appointmentService.ts',
        'src/services/doctorService.ts',
        'src/services/apiError.ts',
        'src/constants/appointment.ts',
        'src/constants/patient.ts',
        'src/types/appointment.ts',
        'src/types/patient.ts',
        'src/types/doctor.ts',
        'src/utils/date.ts',
      ],
      exclude: ['src/components/common/**/index.ts'],
    },
  },
})
