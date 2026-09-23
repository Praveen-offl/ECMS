import asyncio
from sqlalchemy import text
from app.database import engine


async def check():
    async with engine.begin() as conn:

        database = await conn.execute(
            text("SELECT current_database()")
        )

        tables = await conn.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
        )

        print("DATABASE:", database.scalar())
        print("TABLES:", tables.scalars().all())

    await engine.dispose()


asyncio.run(check())