from diagrams import Cluster, Diagram, Edge
from diagrams.programming.framework import React, FastAPI
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.client import User
from diagrams.programming.language import Python
from diagrams.onprem.compute import Server
from diagrams.onprem.network import Nginx
import os

# Configuracion del estilo
graph_attr = {
    "fontsize": "20",
    "bgcolor": "white"
}

# Forzamos que se guarde en la carpeta de la tesis
output_file = "e:/TESIS/diagrama_bloques_daniela"

with Diagram("Arquitectura de N-Capas - Tesis Daniela", 
             filename=output_file, 
             show=False, 
             direction="LR", 
             graph_attr=graph_attr):
    
    user = User("Docente")

    with Cluster("Capa de Presentacion (Frontend)"):
        frontend = React("React + Vite\n(Escritorio)")

    with Cluster("Capa de Logica (Backend)"):
        api = FastAPI("FastAPI\n(Gateway)")
        
        with Cluster("Procesamiento"):
            logic = Python("Orquestador\n(LangChain)")
            engine = Python("File Engine\n(pptx/docx)")

    with Cluster("Servicios Externos e IA"):
        gemini = Nginx("Google Gemini API")
        vector_db = PostgreSQL("Vector Store (RAG)")

    with Cluster("Capa de Datos"):
        db = PostgreSQL("PostgreSQL\n(Metricas BI)")
        storage = Server("Storage\nLocal/Cloud")

    # Flujo de comunicaciones
    user >> Edge(label="HTTPS/JSON") >> frontend
    frontend >> Edge(color="darkgreen") >> api
    api >> logic
    logic >> Edge(color="blue", style="dashed") >> gemini
    logic >> vector_db
    logic >> engine
    engine >> db
    engine >> storage

print(f"Proceso finalizado. Busca el archivo en: {output_file}.png")