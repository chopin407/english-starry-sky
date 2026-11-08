"""Account and progress storage for the LAN release."""

from collections import defaultdict
from contextlib import contextmanager
import hashlib
import hmac
import json
import re
import secrets
import threading
import time


MAX_BYTES = 2 * 1024 * 1024
NAME = re.compile(r"[0-9A-Za-z\u4e00-\u9fa5]{2,12}")
TOKEN = re.compile(r"[a-f0-9]{64}")
MUTATION = re.compile(r"[a-f0-9]{32}")
FREE = "自由学习"
SESSION_MS = 90 * 24 * 60 * 60 * 1000

SCHEMA = (
    """CREATE TABLE IF NOT EXISTS accounts (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(12) NOT NULL UNIQUE,
        salt CHAR(32) NOT NULL,
        password_hash CHAR(64) NOT NULL,
        revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated BIGINT UNSIGNED NOT NULL DEFAULT 0,
        progress JSON
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS sessions (
        token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        account_id INT UNSIGNED NOT NULL,
        expires BIGINT UNSIGNED NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS sync_receipts (
        account_id INT UNSIGNED NOT NULL,
        mutation CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        revision BIGINT UNSIGNED NOT NULL,
        updated BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (account_id, mutation),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB""",
)


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


def now_ms():
    return time.time_ns() // 1_000_000


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1, dklen=32).hex()


def new_password(body):
    password = body.get("pass")
    if not isinstance(password, str) or not 4 <= len(password) <= 128 or password == "123456":
        raise ApiError(400, "密码需为 4 至 128 个字符，且不能用 123456")
    salt = secrets.token_hex(16)
    return salt, password_hash(password, salt)


def snapshot(data):
    if (not isinstance(data, dict) or data.get("app") != "word-atlas" or data.get("version") != 2
            or not isinstance(data.get("progress"), dict)
            or data["progress"].get("datasetId") != "pep-7a" or data["progress"].get("version") != 2
            or not isinstance(data.get("settings"), dict) or not isinstance(data.get("qa"), dict)):
        raise ApiError(400, "学习存档格式无效")
    try:
        return json.dumps(data, ensure_ascii=True, allow_nan=False, separators=(",", ":"))
    except (ValueError, RecursionError):
        raise ApiError(400, "学习存档格式无效") from None


def token_hash(token):
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def connect(config):
    import pymysql

    return pymysql.connect(**config, charset="utf8mb4", connect_timeout=4, read_timeout=8, write_timeout=8,
                           cursorclass=pymysql.cursors.DictCursor)


class LanSync:
    def __init__(self, config):
        self.config = config
        self.lock = threading.Lock()
        self.limits = defaultdict(int)
        self.window = 0

    @contextmanager
    def transaction(self):
        conn = connect(self.config)
        try:
            with conn.cursor() as db:
                yield db
            conn.commit()
        finally:
            conn.close()

    def healthy(self):
        with self.transaction() as db:
            for table in ("accounts", "sessions", "sync_receipts"):
                db.execute(f"SELECT 1 FROM {table} LIMIT 0")

    def throttle(self, action, ip, name):
        with self.lock:
            window = int(time.monotonic() // 600)
            if self.window != window:
                self.limits.clear()
                self.window = window
            key = (action, ip)
            limit = 30 if action == "register" else 120
            if self.limits[key] >= limit:
                raise ApiError(429, "请求过于频繁，请稍后再试")
            self.limits[key] += 1
            if action == "login":
                user_key = (action, ip, name.casefold())
                if self.limits[user_key] >= 12:
                    raise ApiError(429, "尝试次数过多，请稍后再试")
                self.limits[user_key] += 1

    @staticmethod
    def issue_session(db, user_id):
        token = secrets.token_hex(32)
        db.execute("DELETE FROM sessions WHERE account_id=%s AND expires<=%s", (user_id, now_ms()))
        db.execute("INSERT INTO sessions (token_hash, account_id, expires) VALUES (%s,%s,%s)",
                   (token_hash(token), user_id, now_ms() + SESSION_MS))
        return token

    @staticmethod
    def response(account, *, data=True):
        result = {
            "cls": FREE, "code": str(account["id"]), "name": account["name"], "mustChange": False,
            "revision": account["revision"], "updated": account["updated"],
        }
        if data:
            result["data"] = json.loads(account["progress"]) if account["progress"] else None
        return result

    def handle(self, body, ip):
        if not isinstance(body, dict):
            raise ApiError(400, "请求格式无效")
        action = body.get("action")
        if action == "ping":
            return {"ok": True}
        if action not in ("register", "login", "sync", "save", "password", "logout"):
            raise ApiError(400, "局域网账号暂不支持此操作")

        if action in ("login", "register"):
            return self.sign_in(body, ip, action)

        token = body.get("token")
        code = body.get("code")
        if (not isinstance(token, str) or not TOKEN.fullmatch(token) or not isinstance(code, str)
                or not re.fullmatch(r"[1-9][0-9]{0,9}", code) or body.get("cls") != FREE):
            raise ApiError(403, "请重新登录")
        digest = token_hash(token)
        with self.transaction() as db:
            # Serialize writes for this account, including session revocation and progress revisions.
            locking = "" if action == "sync" else " FOR UPDATE"
            db.execute("SELECT * FROM accounts WHERE id=%s" + locking, (code,))
            account = db.fetchone()
            db.execute("SELECT 1 FROM sessions WHERE token_hash=%s AND account_id=%s AND expires>%s",
                       (digest, code, now_ms()))
            if not account or not db.fetchone():
                raise ApiError(403, "请重新登录")
            if action == "sync":
                if body.get("revision") == account["revision"]:
                    return self.response(account, data=False)
                return self.response(account)
            if action == "logout":
                db.execute("DELETE FROM sessions WHERE token_hash=%s", (digest,))
                return {"ok": True}
            if action == "password":
                salt, hashed = new_password(body)
                db.execute("UPDATE accounts SET salt=%s,password_hash=%s WHERE id=%s", (salt, hashed, code))
                db.execute("DELETE FROM sessions WHERE account_id=%s", (code,))
                return {"token": self.issue_session(db, code)}
            return self.save(db, account, body)

    def sign_in(self, body, ip, action):
        import pymysql

        name = body.get("name")
        password = body.get("pass")
        if not isinstance(name, str) or not NAME.fullmatch(name):
            raise ApiError(400, "名字要 2 到 12 个字，只能用汉字、字母和数字")
        self.throttle(action, ip, name)
        with self.transaction() as db:
            if action == "register":
                salt, hashed = new_password(body)
                data = snapshot(body.get("data"))
                updated = now_ms()
                try:
                    db.execute(
                        "INSERT INTO accounts (name,salt,password_hash,revision,updated,progress) VALUES (%s,%s,%s,1,%s,%s)",
                        (name, salt, hashed, updated, data),
                    )
                except pymysql.err.IntegrityError as error:
                    if error.args[0] != 1062:
                        raise
                    raise ApiError(409, "这个名字已注册，请登录或换一个名字") from None
                code = db.lastrowid
                return {"cls": FREE, "code": str(code), "name": name, "mustChange": False,
                        "revision": 1, "updated": updated, "token": self.issue_session(db, code)}
            db.execute("SELECT * FROM accounts WHERE name=%s FOR UPDATE", (name,))
            account = db.fetchone()
            if not isinstance(password, str) or not 1 <= len(password) <= 128:
                raise ApiError(401, "名字或密码不正确")
            # Run the same password derivation for unknown names.
            actual = password_hash(password, account["salt"] if account else "00" * 16)
            if not account or not hmac.compare_digest(actual, account["password_hash"]):
                raise ApiError(401, "名字或密码不正确")
            return {**self.response(account, data=False), "token": self.issue_session(db, account["id"])}

    def save(self, db, account, body):
        revision = body.get("revision")
        mutation = body.get("mutation")
        if type(revision) is not int or revision < 0 or not isinstance(mutation, str) or not MUTATION.fullmatch(mutation):
            raise ApiError(400, "同步版本无效")
        code = account["id"]
        db.execute("SELECT revision,updated FROM sync_receipts WHERE account_id=%s AND mutation=%s", (code, mutation))
        existing = db.fetchone()
        if existing:
            return existing
        if revision != account["revision"]:
            return {**self.response(account), "conflict": True}
        data = snapshot(body.get("data"))
        updated = now_ms()
        db.execute("UPDATE accounts SET revision=%s,updated=%s,progress=%s WHERE id=%s",
                   (revision + 1, updated, data, code))
        db.execute("INSERT INTO sync_receipts (account_id,mutation,revision,updated) VALUES (%s,%s,%s,%s)",
                   (code, mutation, revision + 1, updated))
        return {"revision": revision + 1, "updated": updated}
