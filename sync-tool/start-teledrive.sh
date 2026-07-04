#!/bin/bash
cd "$(dirname "$0")"
python3 daemon.py --folder ~/TeleDrive --url https://www.telebox.web.id --api-key 11235813 --interval 30 --log-file ~/teledrive-sync.log
