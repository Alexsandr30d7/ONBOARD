# create_first_admin.py
import asyncio
import argparse
import sys
import os
from getpass import getpass

# Добавляем корень проекта в PYTHONPATH, чтобы импортировать из app.*
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import User


async def create_admin_user(email: str, password: str):
    print(f"Создание администратора с email: {email}")
    print(f"Подключение к БД: {settings.DATABASE_URL}")

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with AsyncSessionLocal() as session:
        # Проверка, существует ли уже админ
        result = await session.execute(
            select(User).filter(User.email == email)
        )
        existing_user = result.scalars().first()

        if existing_user:
            print(f"❌ Пользователь с email '{email}' уже существует.")
            await engine.dispose()
            return

        # Создание нового админа
        hashed_password = get_password_hash(password)
        admin_user = User(
            email=email,
            password_hash=hashed_password,
            role="admin",
            is_active=True
        )
        session.add(admin_user)
        await session.commit()
        await session.refresh(admin_user)

        print(f"✅ Администратор успешно создан! ID: {admin_user.user_id}")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Создать первого администратора системы адаптации")
    parser.add_argument("email", help="Email администратора (должен быть уникальным)")
    args = parser.parse_args()

    password = getpass(f"Введите пароль для {args.email}: ")
    password_confirm = getpass("Повторите пароль: ")

    if password != password_confirm:
        print("❌ Ошибка: пароли не совпадают.")
        sys.exit(1)

    if len(password) < 6:
        print("❌ Ошибка: пароль должен содержать не менее 6 символов.")
        sys.exit(1)

    if not password:
        print("❌ Ошибка: пароль не может быть пустым.")
        sys.exit(1)

    try:
        asyncio.run(create_admin_user(args.email, password))
    except Exception as e:
        print(f"\n❗ Произошла ошибка: {e}")
        print("Проверьте подключение к базе данных и наличие файла .env")
        sys.exit(1)