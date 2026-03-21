#!/bin/bash
set -e

echo "Starting Easy Control..."

# Use Java 17 if available
if [ -d "/Users/rainman/Library/Java/JavaVirtualMachines/oracle_open_jdk-17/Contents/Home" ]; then
  export JAVA_HOME="/Users/rainman/Library/Java/JavaVirtualMachines/oracle_open_jdk-17/Contents/Home"
fi

# Start backend
echo "[Backend] Starting Spring Boot..."
cd backend
mvn spring-boot:run -q &
BACKEND_PID=$!
cd ..

# Wait for backend
echo "[Backend] Waiting for startup..."
for i in {1..30}; do
  if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo "[Backend] Ready!"
    break
  fi
  sleep 1
done

# Start frontend
echo "[Frontend] Starting Vite..."
cd frontend
npm install -q
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Easy Control is running:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
