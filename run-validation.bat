@echo off
echo Starting Dental Backend...
cd /d "d:\treatmentPlan\dental-backend"

rem Kill any existing Node.js processes that might be running on port 1337
for /f "tokens=5" %%a in ('netstat -ano ^| find "1337" ^| find "LISTENING"') do taskkill /f /pid %%a 2>nul

rem Start backend in background
start /b npm run develop

echo Waiting for backend to initialize...
timeout /t 10 /nobreak > nul

echo Running fullstack validator...
node fullstack-validator.js

pause