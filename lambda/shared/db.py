"""
Shared PostgreSQL helper for FieldSightAI Lambda functions.

Connection string is read from the DB_CONNECTION_STRING environment variable,
which is injected at runtime from SSM Parameter Store.
"""
import os
import psycopg2
import psycopg2.extras
from typing import Any

_conn = None


def get_connection() -> psycopg2.extensions.connection:
    """Return a cached DB connection, reconnecting if necessary."""
    global _conn
    if _conn is None or _conn.closed:
        dsn = os.environ["DB_CONNECTION_STRING"]
        _conn = psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor)
        _conn.autocommit = False
    return _conn


def execute(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    """Run a query and return all rows as dicts."""
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        conn.commit()
        try:
            return cur.fetchall()
        except psycopg2.ProgrammingError:
            return []


def execute_one(sql: str, params: tuple = ()) -> dict[str, Any] | None:
    """Run a query and return the first row or None."""
    rows = execute(sql, params)
    return rows[0] if rows else None
