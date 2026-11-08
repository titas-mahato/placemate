"""Entry point. Run with:  python app.py   (development)  or  gunicorn "app:app"  (production).
Configuration comes from environment variables / backend/.env — see .env.example."""
import os

from sau_hub import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=os.getenv("APP_ENV", "development") == "development" and os.getenv("FLASK_DEBUG", "0") == "1",
            host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")))
