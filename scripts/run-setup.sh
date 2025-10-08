#!/bin/bash
set -a
source .env
set +a
node scripts/setup-database.js
