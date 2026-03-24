#!/bin/bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd "/Users/agustin/Desktop/Business/Gallego/Consultoria/Etapa 5 - Dashboard/ba-dental-gestion 2"
exec npx next dev --turbopack --port 3000
