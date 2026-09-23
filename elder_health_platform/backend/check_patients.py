import asyncio
from sqlalchemy import text
from app.database import engine


async def check():
    async with engine.begin() as conn:
        result = await conn.execute(
            text("""
                SELECT external_id, full_name, invite_code
                FROM patients
                ORDER BY external_id
            """)
        )

        rows = result.fetchall()

        print("\nPATIENTS:")
        for row in rows:
            print(
                "External ID:", row.external_id,
                "| Name:", row.full_name,
                "| Invite Code:", row.invite_code
            )

    await engine.dispose()


asyncio.run(check())