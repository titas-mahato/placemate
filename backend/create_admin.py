"""Create (or reset) a placement administrator. There is deliberately NO default admin account.

    python create_admin.py                      # prompts for name, email and password
    ADMIN_NAME=.. ADMIN_EMAIL=.. ADMIN_PASSWORD=.. python create_admin.py   # non-interactive

The password is hashed before it is stored and is never printed."""
import getpass
import os
import sys

from sau_hub import create_app
from sau_hub.db import commit, execute, query_one
from sau_hub.errors import ApiError
from sau_hub.security import hash_password
from sau_hub.validation import Fields


def main():
    name = os.getenv("ADMIN_NAME") or input("Admin name: ").strip()
    email = os.getenv("ADMIN_EMAIL") or input("Admin email: ").strip()
    pw = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Password (min 8 chars, letters + numbers): ")
    f = Fields({"name": name, "email": email, "password": pw})
    f.text("name", required=True, max_len=100)
    email = f.email()
    f.password()
    try:
        f.check()
    except ApiError as e:
        sys.exit("Invalid input: " + "; ".join(f"{k}: {v}" for k, v in e.errors.items()))
    app = create_app()
    with app.app_context():
        existing = query_one("SELECT admin_id FROM admins WHERE email = %s", (email,))
        if existing:
            if input("An admin with this email exists. Reset its password? [y/N] ").strip().lower() != "y":
                sys.exit("Nothing changed.")
            execute("UPDATE admins SET password_hash = %s, is_active = 1 WHERE admin_id = %s", (hash_password(pw), existing["admin_id"]))
        else:
            execute("INSERT INTO admins (name, email, password_hash) VALUES (%s, %s, %s)", (name, email, hash_password(pw)))
        commit()
    print("Administrator saved.")


if __name__ == "__main__":
    main()
