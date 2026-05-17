# backend/app/services/email_service.py
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional
import requests

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Kōkua")


def enviar_email(
    destinatarios: List[str],
    asunto: str,
    cuerpo_html: str,
    archivo_url: Optional[str] = None,
    nombre_archivo: Optional[str] = None,
):
    """Envía email a uno o varios destinatarios. Opcionalmente adjunta un archivo desde URL."""
    if not SMTP_USER or not SMTP_PASSWORD:
        raise Exception("SMTP no configurado. Revisá tu .env")

    msg = MIMEMultipart()
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg["To"] = ", ".join(destinatarios)
    msg["Subject"] = asunto
    msg.attach(MIMEText(cuerpo_html, "html"))

    # Adjuntar archivo si vino una URL
    if archivo_url and nombre_archivo:
        try:
            r = requests.get(archivo_url, timeout=30)
            if r.status_code == 200:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(r.content)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{nombre_archivo}"')
                msg.attach(part)
        except Exception as e:
            print(f"⚠️ No pude adjuntar archivo: {e}")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, destinatarios, msg.as_string())

    print(f"✉️  Email enviado a {len(destinatarios)} destinatarios: {asunto}")
    return True