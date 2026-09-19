FROM aquasec/trivy:0.74.0 AS trivy-bin
FROM zricethezav/gitleaks:v8.30.1 AS gitleaks-bin

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=trivy-bin /usr/local/bin/trivy /usr/local/bin/trivy
COPY --from=gitleaks-bin /usr/bin/gitleaks /usr/local/bin/gitleaks

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY reports ./reports

RUN addgroup --system rakshak && adduser --system --ingroup rakshak rakshak \
	&& chown -R rakshak:rakshak /app

USER rakshak

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]