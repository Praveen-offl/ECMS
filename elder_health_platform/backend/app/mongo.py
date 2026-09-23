"""
mongo.py
========
Async MongoDB client (via Motor) used exclusively by the caregiver
auth module (app/auth/). Kept separate from database.py, which owns the
Postgres/SQLAlchemy engine for the vitals telemetry schema — auth
credentials live in their own Mongo collection rather than a Postgres
table.
"""

from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger("mongo")

_client: AsyncIOMotorClient | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URI)
    return _client


def get_mongo_db() -> AsyncIOMotorDatabase:
    return get_mongo_client()[settings.MONGO_DB_NAME]


def get_users_collection():
    return get_mongo_db()[settings.MONGO_USERS_COLLECTION]


async def init_mongo_indexes() -> None:
    """Ensure the caregiver email index exists. Called once on app startup."""
    users = get_users_collection()
    await users.create_index("email", unique=True)
    logger.info("MongoDB ready at %s (db=%s)", settings.MONGO_URI, settings.MONGO_DB_NAME)


async def close_mongo_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
