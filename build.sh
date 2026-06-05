#!/bin/bash
NODE='/mnt/c/Program Files/nodejs/node.exe'
cd /home/pc-ubuntu/projects/user-service
"$NODE" ./node_modules/typescript/lib/tsc.js -p tsconfig.build.json 2>&1
echo 'BUILD_EXIT:'$?