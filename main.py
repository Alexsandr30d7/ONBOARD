from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.routers import auth, admin, hr, onboarding
from app.database import Base, engine 
from app.core.config import settings

app = FastAPI(
    title="Onboarding API",
    description="API для адаптации сотрудников",
    version="1.0.0",
    openapi_url="/api/v1/openapi.json", 
    docs_url="/api/v1/docs",           
    redoc_url="/api/v1/redoc"          
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,       
    allow_methods=["*"],          
    allow_headers=["*"],          
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )

@app.exception_handler(ValidationError) 
async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
     return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

api_prefix = "/api/v1"
app.include_router(auth.router, prefix=f"{api_prefix}/auth")
app.include_router(admin.router, prefix=f"{api_prefix}")
app.include_router(onboarding.router, prefix=f"{api_prefix}/onboarding")
app.include_router(hr.router, prefix=f"{api_prefix}")

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Onboarding API. Документация: /api/v1/docs. UI: http://localhost:5173 (npm run dev в папке frontend)."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)