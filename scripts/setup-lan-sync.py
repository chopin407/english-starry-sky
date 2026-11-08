"""Run on the LAN web server to initialize an isolated MySQL database and service user."""

import argparse
import getpass
import json
import os
from pathlib import Path
import secrets
import tempfile

from lan_sync import SCHEMA, LanSync, connect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="192.168.1.74")
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--admin", default="root")
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()
    if args.config.exists() or args.config.is_symlink():
        parser.error("Configuration already exists. Keep it for future releases.")
    password = getpass.getpass("MySQL administrator password: ")
    server = {"host": args.host, "port": args.port}
    conn = connect({**server, "user": args.admin, "password": password})
    config = {**server, "database": "english_starry_sky", "user": "english_sync_" + secrets.token_hex(4),
              "password": secrets.token_urlsafe(32)}
    created = False
    try:
        with conn.cursor() as db:
            db.execute("SELECT SUBSTRING_INDEX(USER(),'@',-1) AS host")
            grant_host = db.fetchone()["host"]
            db.execute("CREATE DATABASE IF NOT EXISTS english_starry_sky CHARACTER SET utf8mb4")
            db.execute("USE english_starry_sky")
            for sql in SCHEMA:
                db.execute(sql)
            db.execute("CREATE USER %s@%s IDENTIFIED BY %s", (config["user"], grant_host, config["password"]))
            created = True
            db.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON english_starry_sky.* TO %s@%s",
                       (config["user"], grant_host))
        LanSync(config).healthy()
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=args.config.parent, delete=False) as temp:
            path = Path(temp.name)
            try:
                json.dump(config, temp)
            except BaseException:
                path.unlink()
                raise
        try:
            os.link(path, args.config)
        finally:
            path.unlink()
    except BaseException:
        if created:
            with conn.cursor() as db:
                db.execute("DROP USER %s@%s", (config["user"], grant_host))
        raise
    finally:
        conn.close()
    print(f"MySQL sync configuration saved to {args.config}")


if __name__ == "__main__":
    main()
