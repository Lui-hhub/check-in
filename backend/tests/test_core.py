import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from app.db import Base
from app.main import create_student, distance, parse_embedding

def test_distance_calculates_euclidean_distance():
    assert distance([0.0, 0.0], [3.0, 4.0]) == 5.0

def test_parse_embedding_requires_128_numbers():
    vector = parse_embedding("[" + ",".join(["0"] * 128) + "]")
    assert len(vector) == 128
    assert all(isinstance(value, float) for value in vector)

@pytest.mark.parametrize("raw", ["not-json", "[]", "[\"x\"]"])
def test_parse_embedding_rejects_invalid_data(raw):
    with pytest.raises(HTTPException):
        parse_embedding(raw)

def test_duplicate_student_names_get_stable_numeric_suffixes():
    import asyncio

    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with sessions() as session:
            embedding = [0.0] * 128
            first = await create_student(session, "五年级", "小明", "数学", embedding, None)
            second = await create_student(session, "五年级", "小明", "数学", embedding, None)
            third = await create_student(session, "五年级", "小明", "数学", embedding, None)
            assert [first.display_name, second.display_name, third.display_name] == ["小明", "小明-2", "小明-3"]
        await engine.dispose()

    asyncio.run(run())
