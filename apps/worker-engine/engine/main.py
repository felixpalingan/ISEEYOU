from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from engine.config import settings
from engine.api.routes import router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Asynchronous OSINT and External Attack Surface Intelligence Worker Mesh",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "ISEEYOU OSINT Engine Active",
        "docs_url": "/docs",
        "health_url": "/api/v1/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("engine.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
