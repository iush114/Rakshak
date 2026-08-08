from fastapi import FastAPI

app = FastAPI(
    title="Rakshak",
    description="AI-Powered DevSecOps Threat Detection Platform",
    version="1.0.0"
)


@app.get("/")
def home():
    return {
        "message": "Rakshak DevSecOps Platform",
        "status": "running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }