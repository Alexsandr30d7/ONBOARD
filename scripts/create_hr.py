# create_hr.py
import asyncio
import argparse
import sys
import os
from getpass import getpass

from email_validator import validate_email, EmailNotValidError

# Добавляем корень проекта в PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import User


async def create_hr_user(email: str, password: str):
    print(f"Создание HR-пользователя с email: {email}")
    print(f"Подключение к БД: {settings.DATABASE_URL}")

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with AsyncSessionLocal() as session:
        # Проверка: не существует ли уже пользователь с таким email
        result = await session.execute(
            select(User).filter(User.email == email)
        )
        existing_user = result.scalars().first()

        if existing_user:
            print(f"❌ Пользователь с email '{email}' уже существует.")
            await engine.dispose()
            return

        # Создание HR
        hashed_password = get_password_hash(password)
        hr_user = User(
            email=email,
            password_hash=hashed_password,
            role="hr",
            is_active=True
        )
        session.add(hr_user)
        await session.commit()
        await session.refresh(hr_user)

        print(f"✅ HR-пользователь успешно создан!")
        print(f"   ID: {hr_user.user_id}")
        print(f"   Email: {hr_user.email}")
        print(f"   Роль: {hr_user.role}")

    await engine.dispose()


def validate_and_normalize_email(email: str) -> str:
    try:
        valid = validate_email(email)
        return valid.email
    except EmailNotValidError as e:
        raise ValueError(f"Некорректный email: {str(e)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Создать HR-пользователя в системе адаптации"
    )
    parser.add_argument("email", help="Email HR-специалиста")
    args = parser.parse_args()

    try:
        normalized_email = validate_and_normalize_email(args.email)
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)

    password = getpass(f"Введите пароль для {normalized_email}: ")
    password_confirm = getpass("Повторите пароль: ")

    if password != password_confirm:
        print("❌ Ошибка: пароли не совпадают.")
        sys.exit(1)

    if len(password) < 6:
        print("❌ Ошибка: пароль должен содержать не менее 6 символов.")
        sys.exit(1)

    if not password.strip():
        print("❌ Ошибка: пароль не может быть пустым.")
        sys.exit(1)

    try:
        asyncio.run(create_hr_user(normalized_email, password))
    except KeyboardInterrupt:
        print("\n❌ Отменено пользователем.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❗ Произошла ошибка: {e}")
        print("Проверьте подключение к БД и наличие файла .env")
        sys.exit(1)