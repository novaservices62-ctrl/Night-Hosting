#!/bin/bash
cd /home/connect/nighthost
git pull
cd frontend && npm install && npm run build
cd ..
pm2 restart nighthost-panel --update-env
